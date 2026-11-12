import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  requireTeacherUser,
  requireClassroomOwner,
  requireClassroomMember,
} from '../utils/authorization.js';
import { notifyUsers, createNotification, getSocketIo } from '../services/notificationService.js';
import { createScopedMessage } from '../services/messagingService.js';

const genClassroomCode = () => `CLS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const genGroupCode = () => `GRP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const genInviteToken = () => crypto.randomBytes(16).toString('hex');

const ensureGroupMembership = async (groupId, userId, role = 'MEMBER') => {
  if (!groupId) return;
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!existing) {
    await prisma.groupMember.create({
      data: { groupId, userId, role },
    });
  }
};

export const formatClassroom = (c) => {
  if (!c) return c;
  const gradeValue = c.classGrade || c.grade || null;
  return {
    ...c,
    grade: gradeValue,
    classGrade: gradeValue,
  };
};

export const createClassroom = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const { name, subject, description, grade, classGrade, board } = req.body;
  const resolvedGrade = classGrade !== undefined ? classGrade : grade;

  let joinCode = genClassroomCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.classroom.findUnique({ where: { joinCode } });
    if (!exists) break;
    joinCode = genClassroomCode();
  }

  const group = await prisma.studyGroup.create({
    data: {
      name: `${name.trim()} Chat`,
      description: `Classroom discussion channel for ${name.trim()}`,
      subject: subject || null,
      privacy: 'PRIVATE',
      joinCode: genGroupCode(),
      ownerId: req.user.id,
      members: { create: { userId: req.user.id, role: 'OWNER' } },
    },
  });

  const classroom = await prisma.classroom.create({
    data: {
      name: name.trim(),
      subject: subject ? subject.trim() : null,
      description: description ? description.trim() : null,
      classGrade: resolvedGrade ? String(resolvedGrade).trim() : null,
      board: board ? String(board).trim() : null,
      joinCode,
      teacherId: req.user.id,
      groupId: group.id,
    },
    include: {
      teacher: { select: { id: true, name: true, email: true, institution: true } },
    },
  });

  ok(res, { classroom: formatClassroom(classroom) }, 201);
});

export const listTeacherClassrooms = asyncHandler(async (req, res) => {
  requireTeacherUser(req.user);
  const where = req.user.role === 'ADMIN' && req.query.all === 'true' ? {} : { teacherId: req.user.id };

  const classrooms = await prisma.classroom.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
    },
  });

  const enriched = await Promise.all(
    classrooms.map(async (c) => {
      const [memberCount, assignmentCount, announcementCount] = await Promise.all([
        prisma.classroomMembership.count({ where: { classroomId: c.id, status: 'ACTIVE' } }),
        prisma.classroomQuizAssignment.count({ where: { classroomId: c.id } }),
        prisma.classroomAnnouncement.count({ where: { classroomId: c.id } }),
      ]);
      return formatClassroom({
        ...c,
        memberCount,
        assignmentCount,
        announcementCount,
      });
    })
  );

  ok(res, { classrooms: enriched });
});

export const listJoinedClassrooms = asyncHandler(async (req, res) => {
  const memberships = await prisma.classroomMembership.findMany({
    where: { userId: req.user.id, status: 'ACTIVE' },
    orderBy: { joinedAt: 'desc' },
    include: {
      classroom: {
        include: {
          teacher: { select: { id: true, name: true, email: true, institution: true } },
        },
      },
    },
  });

  const classrooms = [];
  for (const m of memberships) {
    const c = m.classroom;
    if (!c || c.isArchived) continue;
    const [memberCount, publishedAssignmentCount] = await Promise.all([
      prisma.classroomMembership.count({ where: { classroomId: c.id, status: 'ACTIVE' } }),
      prisma.classroomQuizAssignment.count({
        where: { classroomId: c.id, status: { in: ['PUBLISHED', 'ACTIVE', 'CLOSED'] } },
      }),
    ]);
    classrooms.push(
      formatClassroom({
        ...c,
        joinedAt: m.joinedAt,
        memberCount,
        assignmentCount: publishedAssignmentCount,
      })
    );
  }

  ok(res, { classrooms });
});

export const updateClassroom = asyncHandler(async (req, res) => {
  await requireClassroomOwner(req.params.id, req.user);
  const { name, subject, description, grade, classGrade, board, isArchived } = req.body;
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (subject !== undefined) data.subject = subject ? subject.trim() : null;
  if (description !== undefined) data.description = description ? description.trim() : null;
  const resolvedGrade = classGrade !== undefined ? classGrade : grade;
  if (resolvedGrade !== undefined) data.classGrade = resolvedGrade ? String(resolvedGrade).trim() : null;
  if (board !== undefined) data.board = board ? String(board).trim() : null;
  if (isArchived !== undefined) data.isArchived = Boolean(isArchived);

  const classroom = await prisma.classroom.update({
    where: { id: req.params.id },
    data,
    include: { teacher: { select: { id: true, name: true, email: true } } },
  });

  ok(res, { classroom: formatClassroom(classroom) });
});

export const regenerateJoinCode = asyncHandler(async (req, res) => {
  await requireClassroomOwner(req.params.id, req.user);
  const joinCode = genClassroomCode();
  const classroom = await prisma.classroom.update({
    where: { id: req.params.id },
    data: { joinCode },
  });
  ok(res, { classroom: formatClassroom(classroom) });
});

export const createInvitation = asyncHandler(async (req, res) => {
  const classroom = await requireClassroomOwner(req.params.id, req.user);
  const { email, expiresInDays = 14, maxUses = null } = req.body;

  const invitation = await prisma.classroomInvitation.create({
    data: {
      classroomId: classroom.id,
      token: genInviteToken(),
      email: email ? email.trim().toLowerCase() : null,
      createdById: req.user.id,
      expiresAt: expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 86400000) : null,
      maxUses: maxUses ? Number(maxUses) : null,
    },
  });

  ok(res, { invitation }, 201);
});

export const listInvitations = asyncHandler(async (req, res) => {
  await requireClassroomOwner(req.params.id, req.user);
  const invitations = await prisma.classroomInvitation.findMany({
    where: { classroomId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, { invitations });
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  await requireClassroomOwner(req.params.id, req.user);
  const inv = await prisma.classroomInvitation.findUnique({ where: { id: req.params.invitationId } });
  if (!inv || inv.classroomId !== req.params.id) {
    throw new ApiError(404, 'Invitation not found');
  }
  const invitation = await prisma.classroomInvitation.update({
    where: { id: inv.id },
    data: { isRevoked: true },
  });
  ok(res, { invitation });
});

export const previewInvitation = asyncHandler(async (req, res) => {
  const invitation = await prisma.classroomInvitation.findUnique({
    where: { token: req.params.token },
    include: {
      classroom: {
        include: {
          teacher: { select: { id: true, name: true, institution: true } },
        },
      },
    },
  });

  if (!invitation || !invitation.classroom) {
    throw new ApiError(404, 'Invitation link not found');
  }

  const isExpired = Boolean(invitation.expiresAt && new Date(invitation.expiresAt) < new Date());
  const isExhausted = Boolean(invitation.maxUses && invitation.usedCount >= invitation.maxUses);
  const isArchived = Boolean(invitation.classroom.isArchived);

  const memberCount = await prisma.classroomMembership.count({
    where: { classroomId: invitation.classroomId, status: 'ACTIVE' },
  });

  const existingMembership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId: invitation.classroomId, userId: req.user.id } },
  });

  const gradeValue = invitation.classroom.classGrade || invitation.classroom.grade || null;

  ok(res, {
    preview: {
      classroomId: invitation.classroom.id,
      name: invitation.classroom.name,
      subject: invitation.classroom.subject,
      grade: gradeValue,
      classGrade: gradeValue,
      description: invitation.classroom.description,
      teacher: invitation.classroom.teacher,
      memberCount,
      alreadyMember: existingMembership?.status === 'ACTIVE',
      isValid: !invitation.isRevoked && !isExpired && !isExhausted && !isArchived,
      invalidReason: invitation.isRevoked
        ? 'Invitation has been revoked'
        : isExpired
        ? 'Invitation has expired'
        : isExhausted
        ? 'Invitation usage limit reached'
        : isArchived
        ? 'Classroom is archived'
        : null,
    },
  });
});

const enrollStudentInClassroom = async ({ classroom, user }) => {
  if (classroom.isArchived) {
    throw new ApiError(400, 'This classroom is archived and no longer accepting enrollments');
  }
  if (classroom.teacherId === user.id) {
    throw new ApiError(400, 'You own this classroom already');
  }

  const existing = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId: classroom.id, userId: user.id } },
  });

  if (existing) {
    if (existing.status === 'ACTIVE') {
      throw new ApiError(409, 'You are already enrolled in this classroom');
    }
    if (existing.status === 'SUSPENDED') {
      throw new ApiError(403, 'Your enrollment in this classroom is suspended');
    }
    await prisma.classroomMembership.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', removedAt: null, joinedAt: new Date() },
    });
  } else {
    await prisma.classroomMembership.create({
      data: {
        classroomId: classroom.id,
        userId: user.id,
        status: 'ACTIVE',
      },
    });
  }

  await ensureGroupMembership(classroom.groupId, user.id, 'MEMBER');

  await createNotification({
    userId: classroom.teacherId,
    type: 'CLASSROOM_JOIN',
    title: 'New Student Enrolled',
    message: `${user.name} joined your classroom "${classroom.name}".`,
    link: `/teacher/classrooms/${classroom.id}`,
  });

  return prisma.classroom.findUnique({
    where: { id: classroom.id },
    include: { teacher: { select: { id: true, name: true, email: true } } },
  });
};

export const joinByCode = asyncHandler(async (req, res) => {
  const code = String(req.body.joinCode || '').trim().toUpperCase();
  const classroom = await prisma.classroom.findUnique({ where: { joinCode: code } });
  if (!classroom) {
    throw new ApiError(404, 'Invalid classroom join code');
  }

  const enrolled = await enrollStudentInClassroom({ classroom, user: req.user });
  ok(res, { classroom: formatClassroom(enrolled), joined: true }, 201);
});

export const joinByInvitationToken = asyncHandler(async (req, res) => {
  const invitation = await prisma.classroomInvitation.findUnique({
    where: { token: req.params.token },
    include: { classroom: true },
  });
  if (!invitation || !invitation.classroom) {
    throw new ApiError(404, 'Invitation link not found');
  }
  if (invitation.isRevoked) {
    throw new ApiError(400, 'This classroom invitation has been revoked');
  }
  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
    throw new ApiError(400, 'This classroom invitation has expired');
  }
  if (invitation.maxUses && invitation.usedCount >= invitation.maxUses) {
    throw new ApiError(400, 'This classroom invitation has reached its maximum uses');
  }
  if (invitation.email && invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
    throw new ApiError(403, 'This invitation was issued for a different email address');
  }

  const enrolled = await enrollStudentInClassroom({ classroom: invitation.classroom, user: req.user });
  await prisma.classroomInvitation.update({
    where: { id: invitation.id },
    data: { usedCount: { increment: 1 } },
  });

  ok(res, { classroom: formatClassroom(enrolled), joined: true }, 201);
});

export const leaveClassroom = asyncHandler(async (req, res) => {
  const { classroom, membership, isOwner } = await requireClassroomMember(req.params.id, req.user);
  if (isOwner) {
    throw new ApiError(400, 'Classroom owner cannot leave; archive the classroom instead');
  }
  if (membership) {
    await prisma.classroomMembership.update({
      where: { id: membership.id },
      data: { status: 'REMOVED', removedAt: new Date() },
    });
  }
  if (classroom.groupId) {
    await prisma.groupMember.deleteMany({
      where: { groupId: classroom.groupId, userId: req.user.id },
    });
  }
  ok(res, { left: true });
});

export const getClassroomDetail = asyncHandler(async (req, res) => {
  const { classroom, isOwner } = await requireClassroomMember(req.params.id, req.user);

  const [teacher, activeMembers, rawAnnouncements, rawAssignments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: classroom.teacherId },
      select: { id: true, name: true, email: true, institution: true },
    }),
    prisma.classroomMembership.findMany({
      where: { classroomId: classroom.id, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, email: true, grade: true, board: true, points: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'desc' },
    }),
    prisma.classroomAnnouncement.findMany({
      where: { classroomId: classroom.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.classroomQuizAssignment.findMany({
      where: isOwner || req.user.role === 'ADMIN'
        ? { classroomId: classroom.id }
        : { classroomId: classroom.id, status: { in: ['PUBLISHED', 'ACTIVE', 'CLOSED'] } },
      include: {
        quiz: { select: { id: true, title: true, topic: true, subject: true, difficulty: true, version: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const announcements = [...rawAnnouncements].sort(
    (a, b) => Number(b.isPinned) - Number(a.isPinned)
  );

  const assignments = await Promise.all(
    rawAssignments.map(async (a) => {
      const [submissionsCount, mySubmissions] = await Promise.all([
        prisma.quizSubmission.count({ where: { assignmentId: a.id, status: 'SUBMITTED' } }),
        prisma.quizSubmission.findMany({
          where: { assignmentId: a.id, userId: req.user.id, status: 'SUBMITTED' },
          orderBy: { score: 'desc' },
        }),
      ]);
      const snapshotCount = Array.isArray(a.questionSnapshot) ? a.questionSnapshot.length : null;
      return {
        ...a,
        questionCount: snapshotCount,
        submissionsCount,
        myAttemptsUsed: mySubmissions.length,
        myBestSubmission: mySubmissions[0] || null,
      };
    })
  );

  ok(res, {
    classroom: formatClassroom({
      ...classroom,
      teacher,
      memberCount: activeMembers.length,
      isOwner,
    }),
    members: activeMembers.map((m) => ({
      id: m.id,
      userId: m.userId,
      joinedAt: m.joinedAt,
      status: m.status,
      user: m.user,
    })),
    announcements,
    assignments,
  });
});

export const listClassroomMembers = asyncHandler(async (req, res) => {
  await requireClassroomMember(req.params.id, req.user);
  const members = await prisma.classroomMembership.findMany({
    where: { classroomId: req.params.id, status: 'ACTIVE' },
    include: {
      user: { select: { id: true, name: true, email: true, grade: true, points: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: 'desc' },
  });
  ok(res, { members });
});

export const removeStudentFromClassroom = asyncHandler(async (req, res) => {
  const classroom = await requireClassroomOwner(req.params.id, req.user);
  const { userId } = req.params;

  const membership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId: classroom.id, userId } },
  });
  if (!membership || membership.status !== 'ACTIVE') {
    throw new ApiError(404, 'Student is not an active member of this classroom');
  }

  await prisma.classroomMembership.update({
    where: { id: membership.id },
    data: { status: 'REMOVED', removedAt: new Date() },
  });

  if (classroom.groupId) {
    await prisma.groupMember.deleteMany({
      where: { groupId: classroom.groupId, userId },
    });
  }

  await createNotification({
    userId,
    type: 'CLASSROOM_REMOVED',
    title: 'Classroom Enrollment Updated',
    message: `You have been removed from "${classroom.name}".`,
    link: '/classrooms',
  });

  ok(res, { removed: true });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const classroom = await requireClassroomOwner(req.params.id, req.user);
  const { title, content, isPinned = false, postToChat = true } = req.body;

  const announcement = await prisma.classroomAnnouncement.create({
    data: {
      classroomId: classroom.id,
      authorId: req.user.id,
      title: title ? title.trim() : null,
      content: content.trim(),
      isPinned: Boolean(isPinned),
      pinnedAt: isPinned ? new Date() : null,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  if (postToChat && classroom.groupId) {
    try {
      const chatMsg = await createScopedMessage({
        scope: 'GROUP',
        targetId: classroom.groupId,
        senderId: req.user.id,
        content: title ? `${title.trim()}: ${content.trim()}` : content.trim(),
        messageType: 'ANNOUNCEMENT',
        attachment: { id: announcement.id },
      });
      const io = getSocketIo();
      if (io) {
        io.to(`group:${classroom.groupId}`).emit('group:message', chatMsg);
      }
    } catch {
      // Non-fatal if group chat sync fails
    }
  }

  const activeMembers = await prisma.classroomMembership.findMany({
    where: { classroomId: classroom.id, status: 'ACTIVE' },
  });
  await notifyUsers(
    activeMembers.map((m) => m.userId),
    () => ({
      type: 'CLASSROOM_ANNOUNCEMENT',
      title: announcement.title || `New Announcement in ${classroom.name}`,
      message: content.trim().slice(0, 140),
      link: `/classrooms/${classroom.id}`,
      dedupeKey: `announcement-${announcement.id}`,
    })
  );

  ok(res, { announcement }, 201);
});

export const togglePinAnnouncement = asyncHandler(async (req, res) => {
  const classroom = await requireClassroomOwner(req.params.id, req.user);
  const ann = await prisma.classroomAnnouncement.findUnique({ where: { id: req.params.announcementId } });
  if (!ann || ann.classroomId !== classroom.id) {
    throw new ApiError(404, 'Announcement not found');
  }
  const next = !ann.isPinned;
  const updated = await prisma.classroomAnnouncement.update({
    where: { id: ann.id },
    data: { isPinned: next, pinnedAt: next ? new Date() : null },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
  ok(res, { announcement: updated });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const classroom = await requireClassroomOwner(req.params.id, req.user);
  const ann = await prisma.classroomAnnouncement.findUnique({ where: { id: req.params.announcementId } });
  if (!ann || ann.classroomId !== classroom.id) {
    throw new ApiError(404, 'Announcement not found');
  }
  await prisma.classroomAnnouncement.delete({ where: { id: ann.id } });
  ok(res, { deleted: true });
});

export const getClassroomLeaderboard = asyncHandler(async (req, res) => {
  const { classroom } = await requireClassroomMember(req.params.id, req.user);

  const [memberships, assignments] = await Promise.all([
    prisma.classroomMembership.findMany({
      where: { classroomId: classroom.id, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.classroomQuizAssignment.findMany({
      where: { classroomId: classroom.id },
    }),
  ]);

  const assignmentIds = assignments.map((a) => a.id);
  const submissions = assignmentIds.length
    ? await prisma.quizSubmission.findMany({
        where: { assignmentId: { in: assignmentIds }, status: 'SUBMITTED' },
      })
    : [];

  // Aggregate best score per student per assignment for fair leaderboard scoring
  const bestByStudentAssignment = new Map();
  for (const sub of submissions) {
    const key = `${sub.userId}:${sub.assignmentId}`;
    const current = bestByStudentAssignment.get(key);
    if (
      !current ||
      sub.score > current.score ||
      (sub.score === current.score && sub.timeTakenSecs < current.timeTakenSecs)
    ) {
      bestByStudentAssignment.set(key, sub);
    }
  }

  const byUser = new Map();
  for (const m of memberships) {
    byUser.set(m.userId, {
      userId: m.userId,
      name: m.user?.name || 'Student',
      avatarUrl: m.user?.avatarUrl || null,
      totalScore: 0,
      totalQuestions: 0,
      quizzesCompleted: 0,
      totalTimeTakenSecs: 0,
      avgAccuracy: 0,
    });
  }

  for (const sub of bestByStudentAssignment.values()) {
    if (!byUser.has(sub.userId)) continue;
    const agg = byUser.get(sub.userId);
    agg.totalScore += sub.score || 0;
    agg.totalQuestions += sub.totalQuestions || 0;
    agg.quizzesCompleted += 1;
    agg.totalTimeTakenSecs += sub.timeTakenSecs || 0;
  }

  const rankings = Array.from(byUser.values())
    .map((entry) => ({
      ...entry,
      avgAccuracy:
        entry.totalQuestions > 0
          ? Number(((entry.totalScore / entry.totalQuestions) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.avgAccuracy !== a.avgAccuracy) return b.avgAccuracy - a.avgAccuracy;
      if (a.totalTimeTakenSecs !== b.totalTimeTakenSecs) {
        return a.totalTimeTakenSecs - b.totalTimeTakenSecs;
      }
      return a.userId.localeCompare(b.userId);
    })
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));

  ok(res, { classroomId: classroom.id, rankings });
});
