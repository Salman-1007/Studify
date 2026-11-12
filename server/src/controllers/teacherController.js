import fs from 'fs';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  requireTeacherUser,
  requireClassroomOwner,
  requireClassroomMember,
} from '../utils/authorization.js';
import {
  validateUploadedNoteFile,
  extractText,
} from '../services/documentService.js';
import { generateQuiz } from '../services/aiService.js';
import {
  notifyUsers,
  getSocketIo,
} from '../services/notificationService.js';
import { createScopedMessage } from '../services/messagingService.js';
import {
  evaluateAndAwardAchievements,
  applyStreak,
  POINTS,
} from '../services/gamificationService.js';

const shuffleArray = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildQuestionSnapshot = (questions = []) =>
  [...questions]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((q, idx) => ({
      id: q.id,
      question: q.question,
      type: q.type || 'MCQ',
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || null,
      order: q.order ?? idx,
    }));

const sanitizeQuestionsForStudent = (questions = []) =>
  questions.map(({ correctAnswer, explanation, ...rest }) => rest);

export const getTeacherDashboard = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);

  const [classrooms, quizzes] = await Promise.all([
    prisma.classroom.findMany({
      where: { teacherId: req.user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quiz.findMany({
      where: { creatorId: req.user.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const activeClassrooms = classrooms.filter((c) => !c.isArchived);
  const classroomIds = classrooms.map((c) => c.id);

  const [memberships, assignments] = await Promise.all([
    classroomIds.length
      ? prisma.classroomMembership.findMany({
          where: { classroomId: { in: classroomIds }, status: 'ACTIVE' },
        })
      : [],
    prisma.classroomQuizAssignment.findMany({
      where: { createdById: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        classroom: { select: { id: true, name: true, subject: true } },
        quiz: { select: { id: true, title: true, topic: true, difficulty: true } },
      },
    }),
  ]);

  const uniqueStudentIds = new Set(memberships.map((m) => m.userId));
  const assignmentIds = assignments.map((a) => a.id);

  const submissions = assignmentIds.length
    ? await prisma.quizSubmission.findMany({
        where: { assignmentId: { in: assignmentIds }, status: 'SUBMITTED' },
        orderBy: { submittedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          assignment: {
            include: {
              classroom: { select: { id: true, name: true } },
              quiz: { select: { id: true, title: true } },
            },
          },
        },
      })
    : [];

  // Calculate pending assessments across published/active assignments
  const activeAssignments = assignments.filter((a) =>
    ['PUBLISHED', 'ACTIVE'].includes(a.status)
  );
  const membersByClass = new Map();
  for (const m of memberships) {
    if (!membersByClass.has(m.classroomId)) membersByClass.set(m.classroomId, new Set());
    membersByClass.get(m.classroomId).add(m.userId);
  }
  const submittedPairSet = new Set(submissions.map((s) => `${s.assignmentId}:${s.userId}`));

  let pendingAssessments = 0;
  for (const a of activeAssignments) {
    const enrolledSet = membersByClass.get(a.classroomId);
    if (!enrolledSet) continue;
    for (const studentId of enrolledSet) {
      if (!submittedPairSet.has(`${a.id}:${studentId}`)) {
        pendingAssessments += 1;
      }
    }
  }

  const avgClassPerformance = submissions.length
    ? Number(
        (
          submissions.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0) /
          submissions.length
        ).toFixed(1)
      )
    : 0;

  ok(res, {
    stats: {
      totalClassrooms: activeClassrooms.length,
      totalStudents: uniqueStudentIds.size,
      publishedQuizzes: quizzes.filter((q) => ['PUBLISHED', 'ACTIVE'].includes(q.status)).length,
      draftQuizzes: quizzes.filter((q) => q.status === 'DRAFT').length,
      activeAssignments: activeAssignments.length,
      pendingAssessments,
      totalSubmissions: submissions.length,
      avgClassPerformance,
    },
    classrooms: activeClassrooms.slice(0, 6),
    recentAssignments: assignments.slice(0, 6),
    recentSubmissions: submissions.slice(0, 8),
  });
});

export const listTeacherQuizzes = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const quizzes = await prisma.quiz.findMany({
    where: { creatorId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      questions: { orderBy: { order: 'asc' } },
      assignments: {
        include: { classroom: { select: { id: true, name: true } } },
      },
    },
  });
  ok(res, { quizzes });
});

export const getTeacherQuiz = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: {
      questions: { orderBy: { order: 'asc' } },
      assignments: {
        include: { classroom: { select: { id: true, name: true } } },
      },
    },
  });
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  if (quiz.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Not authorized to access this quiz');
  }
  ok(res, { quiz });
});

export const createTeacherQuizManual = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const {
    title,
    description = null,
    topic = 'General',
    subject = 'General',
    difficulty = 'MEDIUM',
    questions = [],
  } = req.body;

  if (!title || !String(title).trim()) {
    throw new ApiError(400, 'Quiz title is required');
  }

  const quiz = await prisma.quiz.create({
    data: {
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      topic: String(topic || 'General').trim(),
      subject: subject ? String(subject).trim() : null,
      difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
      source: 'teacher_manual',
      status: 'DRAFT',
      isTeacherQuiz: true,
      creatorId: req.user.id,
      questions: questions.length
        ? {
            create: questions.map((q, idx) => ({
              question: q.question,
              type: q.type || 'MCQ',
              options: q.options || [],
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || null,
              order: idx,
            })),
          }
        : undefined,
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  ok(res, { quiz }, 201);
});

export const generateTeacherQuizFromBank = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const { chapterId, subjectId, topicId, count = 10, title, difficulty } = req.body;

  const where = { status: 'APPROVED' };
  if (chapterId) where.chapterId = chapterId;
  if (topicId) where.topicId = topicId;
  if (subjectId) where.subjectId = subjectId;
  if (difficulty && difficulty !== 'MIXED') where.difficulty = difficulty;

  const bankQuestions = await prisma.questionBankItem.findMany({
    where,
    include: { chapter: true, subject: true },
  });

  if (bankQuestions.length === 0) {
    throw new ApiError(404, 'No approved curriculum questions matched your filters');
  }

  const selected = shuffleArray(bankQuestions).slice(
    0,
    Math.min(Number(count) || 10, bankQuestions.length)
  );
  const firstQ = selected[0];
  const resolvedTitle =
    title?.trim() ||
    `${firstQ.subject?.subjectName || 'Curriculum'} - ${firstQ.chapter?.chapterName || 'Assessment'}`;

  const quiz = await prisma.quiz.create({
    data: {
      title: resolvedTitle,
      topic: firstQ.chapter?.chapterName || 'Curriculum',
      subject: firstQ.subject?.subjectName || 'General',
      difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
      source: 'question_bank',
      status: 'DRAFT',
      isTeacherQuiz: true,
      creatorId: req.user.id,
      questions: {
        create: selected.map((q, idx) => ({
          question: q.questionText,
          type: 'MCQ',
          options: [q.optionA, q.optionB, q.optionC, q.optionD],
          correctAnswer: q[`option${q.correctAnswer}`] || q.correctAnswer,
          explanation: q.explanation || null,
          order: idx,
        })),
      },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  ok(res, { quiz }, 201);
});

export const generateTeacherQuizFromNotes = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);

  let extractedNotes = String(req.body.materialText || '').trim();
  const topic = String(req.body.topic || '').trim();
  const subject = req.body.subject ? String(req.body.subject).trim() : null;
  const difficulty = ['EASY', 'MEDIUM', 'HARD'].includes(req.body.difficulty)
    ? req.body.difficulty
    : 'MEDIUM';
  const numQuestions = Math.min(Math.max(Number(req.body.numQuestions) || 10, 1), 30);
  const customTitle = req.body.title ? String(req.body.title).trim() : null;

  try {
    if (req.file) {
      validateUploadedNoteFile(req.file);
      const fromFile = await extractText(req.file.path, req.file.mimetype);
      if (!fromFile || fromFile.trim().length < 20) {
        throw new ApiError(
          400,
          'Could not extract readable text from the uploaded document. Please ensure the PDF/DOCX/TXT contains selectable text.'
        );
      }
      extractedNotes = extractedNotes
        ? `${extractedNotes}\n\n${fromFile.trim()}`
        : fromFile.trim();
    }

    if (!extractedNotes && !topic) {
      throw new ApiError(
        400,
        'Please upload a document (PDF/DOCX/TXT), paste lecture notes, or provide a topic.'
      );
    }

    const generated = await generateQuiz({
      topic: topic || subject || req.file?.originalname || 'Uploaded Notes',
      subject,
      difficulty,
      numQuestions,
      materialText: extractedNotes || undefined,
    });

    if (!generated || !Array.isArray(generated.questions) || generated.questions.length === 0) {
      throw new ApiError(
        502,
        'AI quiz generation returned no questions. Please refine your notes or try again.'
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        title: customTitle || generated.title || `${topic || subject || 'Notes'} Quiz`,
        topic: topic || subject || 'Teacher Notes',
        subject,
        difficulty,
        source: req.file ? 'ai_document' : 'ai_notes',
        status: 'DRAFT',
        isTeacherQuiz: true,
        creatorId: req.user.id,
        questions: {
          create: generated.questions.map((q, idx) => ({
            question: q.question,
            type: q.type || 'MCQ',
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || null,
            order: idx,
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    ok(res, { quiz, extractedLength: extractedNotes.length }, 201);
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // Best-effort cleanup
      }
    }
  }
});

export const updateTeacherQuiz = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: true },
  });
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  if (quiz.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Not authorized to edit this quiz');
  }

  const { title, description, topic, subject, difficulty, status, questions } = req.body;
  const updateData = {};
  if (title !== undefined) updateData.title = title.trim();
  if (description !== undefined) updateData.description = description ? description.trim() : null;
  if (topic !== undefined) updateData.topic = topic.trim();
  if (subject !== undefined) updateData.subject = subject ? subject.trim() : null;
  if (difficulty !== undefined) updateData.difficulty = difficulty;
  if (status !== undefined) updateData.status = status;
  if (questions !== undefined) {
    updateData.version = (quiz.version || 1) + 1;
  }

  await prisma.quiz.update({ where: { id: quiz.id }, data: updateData });

  if (Array.isArray(questions)) {
    await prisma.question.deleteMany({ where: { quizId: quiz.id } });
    await prisma.question.createMany({
      data: questions.map((q, idx) => ({
        quizId: quiz.id,
        question: q.question.trim(),
        type: q.type || 'MCQ',
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correctAnswer.trim(),
        explanation: q.explanation || null,
        order: idx,
      })),
    });
  }

  const updated = await prisma.quiz.findUnique({
    where: { id: quiz.id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  ok(res, { quiz: updated });
});

export const deleteTeacherQuiz = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  if (quiz.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Not authorized to delete this quiz');
  }
  await prisma.quiz.delete({ where: { id: quiz.id } });
  ok(res, { deleted: true });
});

export const assignQuizToClassrooms = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  if (quiz.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Not authorized to assign this quiz');
  }
  if (!quiz.questions || quiz.questions.length === 0) {
    throw new ApiError(400, 'Add at least one question before assigning a quiz');
  }

  const {
    classroomIds,
    title,
    instructions,
    startsAt,
    deadline,
    durationSecs,
    maxAttempts = 1,
    randomizeQuestions = false,
    publishNow = true,
  } = req.body;

  const classrooms = [];
  for (const classId of classroomIds) {
    const cls = await requireClassroomOwner(classId, req.user);
    classrooms.push(cls);
  }

  const snapshot = buildQuestionSnapshot(quiz.questions);
  const now = new Date();
  const assignmentStatus = publishNow ? 'ACTIVE' : 'DRAFT';

  if (publishNow && quiz.status !== 'PUBLISHED' && quiz.status !== 'ACTIVE') {
    await prisma.quiz.update({
      where: { id: quiz.id },
      data: { status: 'PUBLISHED' },
    });
  }

  const createdAssignments = [];
  for (const cls of classrooms) {
    const assignment = await prisma.classroomQuizAssignment.create({
      data: {
        classroomId: cls.id,
        quizId: quiz.id,
        createdById: req.user.id,
        title: title ? title.trim() : quiz.title,
        instructions: instructions ? instructions.trim() : null,
        status: assignmentStatus,
        quizVersion: quiz.version || 1,
        questionSnapshot: publishNow ? snapshot : null,
        startsAt: startsAt ? new Date(startsAt) : null,
        deadline: deadline ? new Date(deadline) : null,
        durationSecs: durationSecs ? Number(durationSecs) : null,
        maxAttempts: Math.max(1, Number(maxAttempts) || 1),
        randomizeQuestions: Boolean(randomizeQuestions),
        publishedAt: publishNow ? now : null,
      },
      include: {
        classroom: { select: { id: true, name: true, groupId: true } },
        quiz: { select: { id: true, title: true, topic: true, difficulty: true } },
      },
    });
    createdAssignments.push(assignment);

    if (publishNow) {
      if (cls.groupId) {
        try {
          const msg = await createScopedMessage({
            scope: 'GROUP',
            targetId: cls.groupId,
            senderId: req.user.id,
            content: `New quiz assigned: ${assignment.title}`,
            messageType: 'QUIZ_ASSIGNMENT',
            attachment: { id: assignment.id },
          });
          const io = getSocketIo();
          if (io) io.to(`group:${cls.groupId}`).emit('group:message', msg);
        } catch {
          // Non-fatal
        }
      }

      const activeMembers = await prisma.classroomMembership.findMany({
        where: { classroomId: cls.id, status: 'ACTIVE' },
      });
      await notifyUsers(
        activeMembers.map((m) => m.userId),
        () => ({
          type: 'QUIZ_ASSIGNED',
          title: `New Quiz in ${cls.name}`,
          message: `${assignment.title}${deadline ? ` — Due ${new Date(deadline).toLocaleDateString()}` : ''}`,
          link: `/classrooms/${cls.id}`,
          dedupeKey: `quiz-assigned-${assignment.id}`,
        })
      );
    }
  }

  ok(res, { assignments: createdAssignments }, 201);
});

export const updateAssignmentStatus = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const assignment = await prisma.classroomQuizAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: {
      quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
    },
  });
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  await requireClassroomOwner(assignment.classroomId, req.user);

  const nextStatus = req.body?.status;
  if (!['DRAFT', 'REVIEWED', 'PUBLISHED', 'ACTIVE', 'CLOSED'].includes(nextStatus)) {
    throw new ApiError(400, 'Invalid assignment status');
  }

  const data = { status: nextStatus };
  if (
    ['PUBLISHED', 'ACTIVE'].includes(nextStatus) &&
    !assignment.questionSnapshot &&
    assignment.quiz?.questions?.length
  ) {
    data.questionSnapshot = buildQuestionSnapshot(assignment.quiz.questions);
    data.publishedAt = new Date();
    data.quizVersion = assignment.quiz.version || 1;
  }

  const updated = await prisma.classroomQuizAssignment.update({
    where: { id: assignment.id },
    data,
  });
  ok(res, { assignment: updated });
});

export const getAssignmentDetail = asyncHandler(async (req, res) => {
  const assignment = await prisma.classroomQuizAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: {
      classroom: { select: { id: true, name: true, teacherId: true, subject: true } },
      quiz: { select: { id: true, title: true, topic: true, subject: true, difficulty: true } },
    },
  });
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  const { isOwner } = await requireClassroomMember(assignment.classroomId, req.user);
  if (!isOwner && req.user.role !== 'ADMIN' && assignment.status === 'DRAFT') {
    throw new ApiError(403, 'This quiz assignment has not been published yet');
  }

  const snapshot = Array.isArray(assignment.questionSnapshot) ? assignment.questionSnapshot : [];

  if (isOwner || req.user.role === 'ADMIN') {
    const [memberships, submissions] = await Promise.all([
      prisma.classroomMembership.findMany({
        where: { classroomId: assignment.classroomId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.quizSubmission.findMany({
        where: { assignmentId: assignment.id, status: 'SUBMITTED' },
        orderBy: { submittedAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const submittedUserIds = new Set(submissions.map((s) => s.userId));
    const avgScore = submissions.length
      ? Number(
          (submissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / submissions.length).toFixed(1)
        )
      : 0;

    // Question miss rates from answersSnapshot
    const questionStatsMap = new Map(
      snapshot.map((q) => [
        q.id,
        { questionId: q.id, question: q.question, totalAttempts: 0, wrongCount: 0 },
      ])
    );
    for (const sub of submissions) {
      if (!Array.isArray(sub.answersSnapshot)) continue;
      for (const ans of sub.answersSnapshot) {
        const entry = questionStatsMap.get(ans.questionId);
        if (!entry) continue;
        entry.totalAttempts += 1;
        if (!ans.isCorrect) entry.wrongCount += 1;
      }
    }
    const missedQuestions = Array.from(questionStatsMap.values())
      .map((item) => ({
        ...item,
        missRate: item.totalAttempts
          ? Number(((item.wrongCount / item.totalAttempts) * 100).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.missRate - a.missRate);

    return ok(res, {
      assignment: {
        ...assignment,
        questionSnapshot: snapshot,
      },
      analytics: {
        totalEnrolled: memberships.length,
        completedCount: submittedUserIds.size,
        pendingCount: Math.max(0, memberships.length - submittedUserIds.size),
        avgPercentage: avgScore,
        missedQuestions,
      },
      submissions,
      pendingStudents: memberships
        .filter((m) => !submittedUserIds.has(m.userId))
        .map((m) => m.user),
    });
  }

  const mySubmissions = await prisma.quizSubmission.findMany({
    where: { assignmentId: assignment.id, userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });

  ok(res, {
    assignment: {
      ...assignment,
      questionCount: snapshot.length,
      questionSnapshot: undefined,
    },
    mySubmissions,
  });
});

export const startAssignmentAttempt = asyncHandler(async (req, res) => {
  const assignment = await prisma.classroomQuizAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: {
      quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
    },
  });
  if (!assignment) throw new ApiError(404, 'Quiz assignment not found');

  await requireClassroomMember(assignment.classroomId, req.user);

  if (!['PUBLISHED', 'ACTIVE'].includes(assignment.status)) {
    throw new ApiError(400, 'This quiz assignment is not currently accepting submissions');
  }
  const now = new Date();
  if (assignment.startsAt && new Date(assignment.startsAt) > now) {
    throw new ApiError(400, 'This quiz assignment has not opened yet');
  }
  if (assignment.deadline && new Date(assignment.deadline) < now) {
    throw new ApiError(400, 'The deadline for this quiz assignment has passed');
  }

  const snapshot = Array.isArray(assignment.questionSnapshot) && assignment.questionSnapshot.length > 0
    ? assignment.questionSnapshot
    : buildQuestionSnapshot(assignment.quiz?.questions || []);

  if (snapshot.length === 0) {
    throw new ApiError(400, 'Assignment contains no questions');
  }

  const existingSubs = await prisma.quizSubmission.findMany({
    where: { assignmentId: assignment.id, userId: req.user.id },
    orderBy: { attemptNumber: 'desc' },
  });

  const inProgress = existingSubs.find((s) => s.status === 'IN_PROGRESS');
  if (inProgress) {
    const orderedIds = Array.isArray(inProgress.questionOrder)
      ? inProgress.questionOrder
      : snapshot.map((q) => q.id);
    const byId = new Map(snapshot.map((q) => [q.id, q]));
    const orderedQuestions = orderedIds.map((qid) => byId.get(qid)).filter(Boolean);
    return ok(res, {
      submission: inProgress,
      assignment: {
        id: assignment.id,
        title: assignment.title || assignment.quiz?.title,
        instructions: assignment.instructions,
        durationSecs: assignment.durationSecs,
        deadline: assignment.deadline,
        maxAttempts: assignment.maxAttempts,
      },
      questions: sanitizeQuestionsForStudent(orderedQuestions.length ? orderedQuestions : snapshot),
    });
  }

  const submittedCount = existingSubs.filter((s) => s.status === 'SUBMITTED').length;
  if (submittedCount >= (assignment.maxAttempts || 1)) {
    throw new ApiError(403, 'You have reached the maximum allowed attempts for this quiz');
  }

  const ordered = assignment.randomizeQuestions ? shuffleArray(snapshot) : snapshot;
  const submission = await prisma.quizSubmission.create({
    data: {
      assignmentId: assignment.id,
      quizId: assignment.quizId,
      userId: req.user.id,
      attemptNumber: existingSubs.length + 1,
      status: 'IN_PROGRESS',
      questionOrder: ordered.map((q) => q.id),
      totalQuestions: ordered.length,
    },
  });

  ok(
    res,
    {
      submission,
      assignment: {
        id: assignment.id,
        title: assignment.title || assignment.quiz?.title,
        instructions: assignment.instructions,
        durationSecs: assignment.durationSecs,
        deadline: assignment.deadline,
        maxAttempts: assignment.maxAttempts,
      },
      questions: sanitizeQuestionsForStudent(ordered),
    },
    201
  );
});

export const submitAssignmentAttempt = asyncHandler(async (req, res) => {
  const assignment = await prisma.classroomQuizAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: {
      quiz: { include: { questions: true } },
    },
  });
  if (!assignment) throw new ApiError(404, 'Quiz assignment not found');

  await requireClassroomMember(assignment.classroomId, req.user);

  if (!['PUBLISHED', 'ACTIVE'].includes(assignment.status)) {
    throw new ApiError(400, 'This quiz assignment is closed');
  }
  const now = new Date();
  // Allow 10s clock-skew grace on submission over network
  if (assignment.deadline && new Date(assignment.deadline).getTime() + 10000 < now.getTime()) {
    throw new ApiError(400, 'Submission rejected because the assignment deadline has passed');
  }

  const { submissionId, answers = [], timeTakenSecs = 0 } = req.body;

  let submission = submissionId
    ? await prisma.quizSubmission.findUnique({ where: { id: submissionId } })
    : null;

  if (!submission) {
    const subs = await prisma.quizSubmission.findMany({
      where: { assignmentId: assignment.id, userId: req.user.id, status: 'IN_PROGRESS' },
      orderBy: { createdAt: 'desc' },
    });
    submission = subs[0] || null;
  }

  if (submission && submission.userId !== req.user.id) {
    throw new ApiError(403, 'Unauthorized submission reference');
  }
  if (submission && submission.status === 'SUBMITTED') {
    throw new ApiError(409, 'This attempt has already been submitted');
  }

  const existingSubs = await prisma.quizSubmission.findMany({
    where: { assignmentId: assignment.id, userId: req.user.id, status: 'SUBMITTED' },
  });
  if (existingSubs.length >= (assignment.maxAttempts || 1)) {
    throw new ApiError(403, 'Maximum attempts exceeded');
  }

  const snapshot = Array.isArray(assignment.questionSnapshot) && assignment.questionSnapshot.length > 0
    ? assignment.questionSnapshot
    : buildQuestionSnapshot(assignment.quiz?.questions || []);

  let score = 0;
  const answersSnapshot = [];
  for (const q of snapshot) {
    const given = answers.find((a) => a.questionId === q.id);
    const givenText = String(given?.answer ?? '').trim();
    const expectedText = String(q.correctAnswer ?? '').trim();
    const isCorrect =
      givenText.length > 0 && givenText.toLowerCase() === expectedText.toLowerCase();
    if (isCorrect) score += 1;
    answersSnapshot.push({
      questionId: q.id,
      question: q.question,
      options: q.options || [],
      givenAnswer: given?.answer ?? '',
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || null,
      isCorrect,
    });
  }

  const totalQuestions = snapshot.length;
  const percentage = totalQuestions > 0 ? Number(((score / totalQuestions) * 100).toFixed(1)) : 0;

  let saved;
  if (submission) {
    saved = await prisma.quizSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'SUBMITTED',
        answersSnapshot,
        score,
        totalQuestions,
        percentage,
        accuracy: percentage,
        timeTakenSecs: Math.max(0, Number(timeTakenSecs) || 0),
        submittedAt: now,
      },
    });
  } else {
    saved = await prisma.quizSubmission.create({
      data: {
        assignmentId: assignment.id,
        quizId: assignment.quizId,
        userId: req.user.id,
        attemptNumber: existingSubs.length + 1,
        status: 'SUBMITTED',
        answersSnapshot,
        score,
        totalQuestions,
        percentage,
        accuracy: percentage,
        timeTakenSecs: Math.max(0, Number(timeTakenSecs) || 0),
        submittedAt: now,
      },
    });
  }

  // Also record gamification & standard attempt compatibility cleanly
  let pointsEarned = POINTS.QUIZ_COMPLETE;
  if (percentage >= 80) pointsEarned += POINTS.HIGH_SCORE_BONUS;
  const streakCount = await applyStreak(req.user.id);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { points: { increment: pointsEarned } },
  });
  await evaluateAndAwardAchievements(req.user.id, {
    quizzesCompleted: await prisma.quizAttempt.count({ where: { userId: req.user.id } }),
    streakCount,
    hasPerfectScore: percentage === 100,
    groupQuizzesJoined: await prisma.groupQuizParticipant.count({
      where: { userId: req.user.id, submittedAt: { not: null } },
    }),
  });

  ok(res, { submission: saved, pointsEarned }, 201);
});

export const getAssignmentLeaderboard = asyncHandler(async (req, res) => {
  const assignment = await prisma.classroomQuizAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: { classroom: { select: { id: true, name: true } } },
  });
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  await requireClassroomMember(assignment.classroomId, req.user);

  const submissions = await prisma.quizSubmission.findMany({
    where: { assignmentId: assignment.id, status: 'SUBMITTED' },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // Best attempt per student
  const bestByUser = new Map();
  for (const s of submissions) {
    const existing = bestByUser.get(s.userId);
    if (
      !existing ||
      s.score > existing.score ||
      (s.score === existing.score && s.timeTakenSecs < existing.timeTakenSecs)
    ) {
      bestByUser.set(s.userId, s);
    }
  }

  const rankings = Array.from(bestByUser.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (a.timeTakenSecs !== b.timeTakenSecs) return a.timeTakenSecs - b.timeTakenSecs;
      return a.userId.localeCompare(b.userId);
    })
    .map((s, idx) => ({
      rank: idx + 1,
      userId: s.userId,
      name: s.user?.name || 'Student',
      avatarUrl: s.user?.avatarUrl || null,
      score: s.score,
      totalQuestions: s.totalQuestions,
      accuracy: s.accuracy,
      percentage: s.percentage,
      timeTakenSecs: s.timeTakenSecs,
      submittedAt: s.submittedAt,
    }));

  ok(res, { assignmentId: assignment.id, classroom: assignment.classroom, rankings });
});

export const getTeacherAnalytics = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);

  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });

  const assignments = await prisma.classroomQuizAssignment.findMany({
    where: { createdById: req.user.id },
    include: {
      classroom: { select: { id: true, name: true } },
      quiz: { select: { id: true, title: true, topic: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const classroomStats = await Promise.all(
    classrooms.map(async (cls) => {
      const memberCount = await prisma.classroomMembership.count({
        where: { classroomId: cls.id, status: 'ACTIVE' },
      });
      const clsAssignments = assignments.filter((a) => a.classroomId === cls.id);
      const aIds = clsAssignments.map((a) => a.id);
      const subs = aIds.length
        ? await prisma.quizSubmission.findMany({
            where: { assignmentId: { in: aIds }, status: 'SUBMITTED' },
          })
        : [];
      const avgScore = subs.length
        ? Number((subs.reduce((acc, s) => acc + s.percentage, 0) / subs.length).toFixed(1))
        : 0;
      const expectedTotal = memberCount * clsAssignments.length;
      const uniquePairs = new Set(subs.map((s) => `${s.assignmentId}:${s.userId}`)).size;
      const completionRate =
        expectedTotal > 0 ? Number(((uniquePairs / expectedTotal) * 100).toFixed(1)) : 0;

      return {
        classroomId: cls.id,
        name: cls.name,
        subject: cls.subject,
        memberCount,
        assignmentsCount: clsAssignments.length,
        submissionsCount: subs.length,
        avgScore,
        completionRate,
      };
    })
  );

  ok(res, { classroomStats, totalAssignments: assignments.length });
});
