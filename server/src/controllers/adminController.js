import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createNotification } from '../services/notificationService.js';

export const listUsers = asyncHandler(async(req, res) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            teacherStatus: true,
            isActive: true,
            grade: true,
            board: true,
            points: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
    ok(res, { users });
});

export const deactivateUser = asyncHandler(async(req, res) => {
    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive: false },
    });
    ok(res, { user });
});

export const listGroups = asyncHandler(async(req, res) => {
    const groups = await prisma.studyGroup.findMany({
        include: {
            owner: { select: { id: true, name: true, email: true } },
            _count: { select: { members: true, messages: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    ok(res, { groups });
});

export const listMaterialsAudit = asyncHandler(async(req, res) => {
    const materials = await prisma.material.findMany({
        include: {
            user: { select: { id: true, name: true, email: true } },
            _count: { select: { chunks: true, conversations: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    ok(res, { materials });
});

export const deleteMaterial = asyncHandler(async(req, res) => {
    const { id } = req.params;
    await prisma.material.delete({ where: { id } });
    ok(res, { deleted: true });
});

export const listChatsAudit = asyncHandler(async(req, res) => {
    const [directChats, groupMessages] = await Promise.all([
        prisma.directChat.findMany({
            include: {
                user1: { select: { id: true, name: true, email: true } },
                user2: { select: { id: true, name: true, email: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: { sender: { select: { id: true, name: true } } },
                },
                _count: { select: { messages: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 25,
        }),
        prisma.groupMessage.findMany({
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: {
                sender: { select: { id: true, name: true, email: true } },
                group: { select: { id: true, name: true } },
            },
        }),
    ]);

    ok(res, { directChats, recentGroupMessages: groupMessages });
});

export const platformStats = asyncHandler(async(req, res) => {
    const [users, groups, quizzes, attempts, materials, bankQuestions, testAttempts, directChats] =
    await Promise.all([
        prisma.user.count(),
        prisma.studyGroup.count(),
        prisma.quiz.count(),
        prisma.quizAttempt.count(),
        prisma.material.count(),
        prisma.questionBankItem.count({ where: { status: 'APPROVED' } }),
        prisma.standardTestAttempt.count({ where: { isSubmitted: true } }),
        prisma.directChat.count(),
    ]);

    ok(res, {
        users,
        groups,
        quizzes,
        attempts,
        materials,
        bankQuestions,
        testAttempts,
        directChats,
    });
});

export const listPendingTeachers = asyncHandler(async(req, res) => {
    const teachers = await prisma.user.findMany({
        where: {
            OR: [
                { teacherStatus: 'PENDING' },
                { role: 'TEACHER' },
            ],
        },
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            teacherStatus: true,
            institution: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
    ok(res, { teachers });
});

export const approveTeacher = asyncHandler(async(req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new ApiError(404, 'User not found');

    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role: 'TEACHER', teacherStatus: 'APPROVED' },
        select: { id: true, name: true, email: true, role: true, teacherStatus: true },
    });

    await createNotification({
        userId: user.id,
        type: 'TEACHER_APPROVED',
        title: 'Educator Account Approved',
        message: 'Your educator verification has been approved! You can now create classrooms and assign quizzes.',
        link: '/teacher/dashboard',
        dedupeKey: `teacher-approved-${user.id}`,
    });

    ok(res, { user });
});

export const rejectTeacher = asyncHandler(async(req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new ApiError(404, 'User not found');

    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role: 'STUDENT', teacherStatus: 'REJECTED' },
        select: { id: true, name: true, email: true, role: true, teacherStatus: true },
    });

    await createNotification({
        userId: user.id,
        type: 'TEACHER_REJECTED',
        title: 'Educator Verification Update',
        message: 'Your educator verification request was declined. Contact an administrator if you need assistance.',
        link: '/settings',
    });

    ok(res, { user });
});

export const listTeacherInviteCodes = asyncHandler(async(req, res) => {
    const invites = await prisma.teacherInviteCode.findMany({
        orderBy: { createdAt: 'desc' },
    });
    ok(res, { invites });
});

export const createTeacherInviteCode = asyncHandler(async(req, res) => {
    const { email, maxUses = 1, expiresInDays = 14 } = req.body || {};
    const code = `EDU-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 86400000) : null;

    const invite = await prisma.teacherInviteCode.create({
        data: {
            code,
            email: email ? email.trim().toLowerCase() : null,
            maxUses: Math.max(1, Number(maxUses) || 1),
            expiresAt,
            createdById: req.user.id,
        },
    });
    ok(res, { invite }, 201);
});

export const revokeTeacherInviteCode = asyncHandler(async(req, res) => {
    const invite = await prisma.teacherInviteCode.update({
        where: { id: req.params.id },
        data: { isRevoked: true },
    });
    ok(res, { invite });
});