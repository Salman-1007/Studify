import { prisma } from '../config/db.js';
import { ApiError } from './ApiError.js';
import { isApprovedTeacher } from '../middleware/auth.js';

export const requireAuthenticatedUser = (req) => {
  if (!req.user || !req.user.isActive) {
    throw new ApiError(401, 'Not authenticated');
  }
  return req.user;
};

export const requireTeacherUser = (user) => {
  if (!isApprovedTeacher(user)) {
    throw new ApiError(403, 'Verified teacher privileges required');
  }
  return user;
};

export const requireClassroomOwner = async (classroomId, user) => {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) throw new ApiError(404, 'Classroom not found');
  if (user.role !== 'ADMIN' && classroom.teacherId !== user.id) {
    throw new ApiError(403, 'Only the classroom owner can perform this action');
  }
  return classroom;
};

export const requireClassroomMember = async (classroomId, user) => {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) throw new ApiError(404, 'Classroom not found');

  if (user.role === 'ADMIN' || classroom.teacherId === user.id) {
    return { classroom, isOwner: classroom.teacherId === user.id || user.role === 'ADMIN', membership: null };
  }

  const membership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId, userId: user.id } },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new ApiError(403, 'You are not an active member of this classroom');
  }

  return { classroom, isOwner: false, membership };
};

export const requireQuizAccess = async (quizId, user) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new ApiError(404, 'Quiz not found');

  if (user.role === 'ADMIN' || quiz.creatorId === user.id) {
    return { quiz, isCreator: true };
  }

  // If it's a non-teacher student quiz (legacy behavior), allow taking if published
  if (!quiz.isTeacherQuiz && quiz.status !== 'DRAFT') {
    return { quiz, isCreator: false };
  }

  // Teacher quizzes: only accessible to enrolled students of an assigned active/published classroom
  const memberships = await prisma.classroomMembership.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { classroomId: true },
  });
  const classroomIds = memberships.map((m) => m.classroomId);
  if (classroomIds.length === 0) {
    throw new ApiError(403, 'You do not have access to this quiz');
  }

  const assignment = await prisma.classroomQuizAssignment.findFirst({
    where: {
      quizId,
      classroomId: { in: classroomIds },
      status: { in: ['PUBLISHED', 'ACTIVE'] },
    },
  });

  if (!assignment) {
    throw new ApiError(403, 'This quiz is not assigned to any of your classrooms');
  }

  return { quiz, isCreator: false, assignment };
};
