import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const genJoinCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const requireMembership = async (groupId, userId) => {
  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!membership) throw new ApiError(403, 'You are not a member of this group');
  return membership;
};

export const createGroup = asyncHandler(async (req, res) => {
  const { name, description, subject, privacy } = req.body;
  const group = await prisma.studyGroup.create({
    data: {
      name, description, subject, privacy, joinCode: genJoinCode(), ownerId: req.user.id,
      members: { create: { userId: req.user.id, role: 'OWNER' } },
    },
    include: { members: true },
  });
  ok(res, { group }, 201);
});

export const searchGroups = asyncHandler(async (req, res) => {
  const q = req.query.q || '';
  const groups = await prisma.studyGroup.findMany({
    where: { privacy: 'PUBLIC', name: { contains: q, mode: 'insensitive' } },
    include: { _count: { select: { members: true } } },
    take: 30,
  });
  ok(res, { groups });
});

export const getGroup = asyncHandler(async (req, res) => {
  const group = await prisma.studyGroup.findUnique({
    where: { id: req.params.id },
    include: { members: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } } },
  });
  if (!group) throw new ApiError(404, 'Group not found');
  if (group.privacy === 'PRIVATE') await requireMembership(group.id, req.user.id);
  ok(res, { group });
});

export const joinGroup = asyncHandler(async (req, res) => {
  const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id } });
  if (!group) throw new ApiError(404, 'Group not found');

  if (group.privacy === 'PRIVATE') {
    if (!req.body.joinCode || req.body.joinCode.toUpperCase() !== group.joinCode) {
      throw new ApiError(403, 'Invalid join code');
    }
  }

  const existing = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.user.id } } });
  if (existing) throw new ApiError(409, 'Already a member');

  await prisma.groupMember.create({ data: { groupId: group.id, userId: req.user.id, role: 'MEMBER' } });
  await prisma.notification.create({ data: { userId: group.ownerId, type: 'GROUP_JOIN', message: `${req.user.name} joined ${group.name}` } });
  ok(res, { joined: true });
});

export const leaveGroup = asyncHandler(async (req, res) => {
  const membership = await requireMembership(req.params.id, req.user.id);
  if (membership.role === 'OWNER') throw new ApiError(400, 'Owner cannot leave; delete the group instead');
  await prisma.groupMember.delete({ where: { id: membership.id } });
  ok(res, { left: true });
});

export const listMembers = asyncHandler(async (req, res) => {
  await requireMembership(req.params.id, req.user.id);
  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id },
    include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
  });
  ok(res, { members });
});

export const removeMember = asyncHandler(async (req, res) => {
  const membership = await requireMembership(req.params.id, req.user.id);
  if (membership.role === 'MEMBER') throw new ApiError(403, 'Only owner/moderator can remove members');
  const target = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } } });
  if (!target) throw new ApiError(404, 'Member not found');
  if (target.role === 'OWNER') throw new ApiError(400, 'Cannot remove the owner');
  await prisma.groupMember.delete({ where: { id: target.id } });
  ok(res, { removed: true });
});

export const setModerator = asyncHandler(async (req, res) => {
  const membership = await requireMembership(req.params.id, req.user.id);
  if (membership.role !== 'OWNER') throw new ApiError(403, 'Only the owner can change roles');
  const target = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } } });
  if (!target || target.role === 'OWNER') throw new ApiError(404, 'Member not found');
  const newRole = target.role === 'MODERATOR' ? 'MEMBER' : 'MODERATOR';
  const updated = await prisma.groupMember.update({ where: { id: target.id }, data: { role: newRole } });
  ok(res, { member: updated });
});

export const deleteGroup = asyncHandler(async (req, res) => {
  const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id } });
  if (!group) throw new ApiError(404, 'Group not found');
  if (group.ownerId !== req.user.id) throw new ApiError(403, 'Only the owner can delete this group');
  await prisma.studyGroup.delete({ where: { id: req.params.id } });
  ok(res, { deleted: true });
});

export const getMessages = asyncHandler(async (req, res) => {
  await requireMembership(req.params.id, req.user.id);
  const cursor = req.query.cursor;
  const messages = await prisma.groupMessage.findMany({
    where: { groupId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
  });
  const sanitized = messages.map((m) => ({
    ...m,
    content: m.isUnsent ? 'This message was unsent' : m.content,
  }));
  ok(res, { messages: sanitized.reverse() });
});

export const sendMessage = asyncHandler(async (req, res) => {
  await requireMembership(req.params.id, req.user.id);
  const { content } = req.body;
  if (!content || !content.trim()) throw new ApiError(400, 'Content cannot be empty');

  const message = await prisma.groupMessage.create({
    data: {
      groupId: req.params.id,
      senderId: req.user.id,
      content: content.trim(),
    },
    include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
  });

  ok(res, { message }, 201);
});

export const unsendMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const message = await prisma.groupMessage.findUnique({
    where: { id: messageId },
    include: { group: true },
  });
  if (!message) throw new ApiError(404, 'Message not found');

  if (
    message.senderId !== req.user.id &&
    message.group.ownerId !== req.user.id &&
    req.user.role !== 'ADMIN'
  ) {
    throw new ApiError(403, 'Unauthorized to unsend this message');
  }

  const updated = await prisma.groupMessage.update({
    where: { id: messageId },
    data: {
      isUnsent: true,
      unsentAt: new Date(),
      content: 'This message was unsent',
    },
    include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
  });

  ok(res, { message: updated });
});

export { requireMembership };

