import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
    fetchScopedMessages,
    createScopedMessage,
    editScopedMessage,
    deleteScopedMessageForMe,
    deleteScopedMessageForEveryone,
    toggleScopedReaction,
    toggleScopedPin,
    markScopedMessagesRead,
    updateConversationPreference,
} from '../services/messagingService.js';
import { getSocketIo } from '../services/notificationService.js';

const genJoinCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const requireMembership = async(groupId, userId) => {
    const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!membership) throw new ApiError(403, 'You are not a member of this group');
    return membership;
};

export const createGroup = asyncHandler(async(req, res) => {
    const { name, description, subject, privacy, memberIds } = req.body;
    
    // Prepare initial members list (creator is OWNER, selected contacts are MEMBER)
    const membersCreate = [{ userId: req.user.id, role: 'OWNER' }];
    if (Array.isArray(memberIds)) {
        for (const uid of memberIds) {
            if (uid && uid !== req.user.id && !membersCreate.some((m) => m.userId === uid)) {
                membersCreate.push({ userId: uid, role: 'MEMBER' });
            }
        }
    }

    const group = await prisma.studyGroup.create({
        data: {
            name,
            description,
            subject,
            privacy: privacy || 'PRIVATE',
            joinCode: genJoinCode(),
            ownerId: req.user.id,
            members: { create: membersCreate },
        },
        include: {
            members: {
                include: {
                    user: { select: { id: true, name: true, username: true, avatarUrl: true } }
                }
            },
            _count: { select: { members: true } },
        },
    });
    ok(res, { group }, 201);
});

export const getMyGroups = asyncHandler(async(req, res) => {
    const q = req.query.q || '';
    const groups = await prisma.studyGroup.findMany({
        where: {
            members: {
                some: { userId: req.user.id }
            },
            ...(q ? { name: { contains: q, mode: 'insensitive' } } : {})
        },
        include: {
            members: {
                include: {
                    user: { select: { id: true, name: true, username: true, avatarUrl: true } }
                }
            },
            _count: { select: { members: true } },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                    sender: { select: { id: true, name: true, username: true } }
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });
    ok(res, { groups });
});

export const joinGroupByCode = asyncHandler(async(req, res) => {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
        throw new ApiError(400, 'Valid join code is required');
    }
    const cleanCode = code.trim().toUpperCase();
    const group = await prisma.studyGroup.findFirst({
        where: { joinCode: cleanCode },
        include: {
            members: {
                include: {
                    user: { select: { id: true, name: true, username: true, avatarUrl: true } }
                }
            },
            _count: { select: { members: true } }
        }
    });
    if (!group) {
        throw new ApiError(404, 'No group found with this invite code');
    }

    const isMember = group.members.some((m) => m.userId === req.user.id);
    if (!isMember) {
        await prisma.groupMember.create({
            data: {
                groupId: group.id,
                userId: req.user.id,
                role: 'MEMBER'
            }
        });
        await prisma.notification.create({
            data: {
                userId: group.ownerId,
                type: 'GROUP_JOIN',
                message: `${req.user.name || 'A student'} joined ${group.name} via invite code`
            }
        });
    }

    const updatedGroup = await prisma.studyGroup.findUnique({
        where: { id: group.id },
        include: {
            members: {
                include: {
                    user: { select: { id: true, name: true, username: true, avatarUrl: true } }
                }
            },
            _count: { select: { members: true } }
        }
    });

    ok(res, { group: updatedGroup, joined: !isMember });
});

export const addMembersToGroup = asyncHandler(async(req, res) => {
    const membership = await requireMembership(req.params.id, req.user.id);
    if (membership.role !== 'OWNER' && membership.role !== 'MODERATOR') {
        throw new ApiError(403, 'Only group owner or moderator can add members directly');
    }
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new ApiError(400, 'userIds array is required');
    }
    const added = [];
    for (const uid of userIds) {
        if (!uid) continue;
        const existing = await prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId: req.params.id, userId: uid } }
        });
        if (!existing) {
            const member = await prisma.groupMember.create({
                data: { groupId: req.params.id, userId: uid, role: 'MEMBER' },
                include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } }
            });
            added.push(member);
        }
    }
    ok(res, { added, count: added.length });
});

export const searchGroups = asyncHandler(async(req, res) => {
    const q = req.query.q || '';
    const groups = await prisma.studyGroup.findMany({
        where: { privacy: 'PUBLIC', name: { contains: q, mode: 'insensitive' } },
        include: { _count: { select: { members: true } } },
        take: 30,
    });
    ok(res, { groups });
});

export const getGroup = asyncHandler(async(req, res) => {
    const group = await prisma.studyGroup.findUnique({
        where: { id: req.params.id },
        include: { members: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } } },
    });
    if (!group) throw new ApiError(404, 'Group not found');
    if (group.privacy === 'PRIVATE') await requireMembership(group.id, req.user.id);
    ok(res, { group });
});

export const joinGroup = asyncHandler(async(req, res) => {
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

export const leaveGroup = asyncHandler(async(req, res) => {
    const membership = await requireMembership(req.params.id, req.user.id);
    if (membership.role === 'OWNER') throw new ApiError(400, 'Owner cannot leave; delete the group instead');
    await prisma.groupMember.delete({ where: { id: membership.id } });
    ok(res, { left: true });
});

export const listMembers = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const members = await prisma.groupMember.findMany({
        where: { groupId: req.params.id },
        include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    });
    ok(res, { members });
});

export const removeMember = asyncHandler(async(req, res) => {
    const membership = await requireMembership(req.params.id, req.user.id);
    if (membership.role === 'MEMBER') throw new ApiError(403, 'Only owner/moderator can remove members');
    const target = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } } });
    if (!target) throw new ApiError(404, 'Member not found');
    if (target.role === 'OWNER') throw new ApiError(400, 'Cannot remove the owner');
    await prisma.groupMember.delete({ where: { id: target.id } });
    ok(res, { removed: true });
});

export const setModerator = asyncHandler(async(req, res) => {
    const membership = await requireMembership(req.params.id, req.user.id);
    if (membership.role !== 'OWNER') throw new ApiError(403, 'Only the owner can change roles');
    const target = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } } });
    if (!target || target.role === 'OWNER') throw new ApiError(404, 'Member not found');
    const newRole = target.role === 'MODERATOR' ? 'MEMBER' : 'MODERATOR';
    const updated = await prisma.groupMember.update({ where: { id: target.id }, data: { role: newRole } });
    ok(res, { member: updated });
});

export const deleteGroup = asyncHandler(async(req, res) => {
    const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id } });
    if (!group) throw new ApiError(404, 'Group not found');
    if (group.ownerId !== req.user.id) throw new ApiError(403, 'Only the owner can delete this group');
    await prisma.studyGroup.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
});

export const getMessages = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const { search, limit } = req.query;
    const result = await fetchScopedMessages({
        scope: 'GROUP',
        targetId: req.params.id,
        viewerId: req.user.id,
        search,
        limit,
    });
    ok(res, result);
});

export const sendMessage = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const { content, messageType, attachment, replyToId } = req.body;
    const message = await createScopedMessage({
        scope: 'GROUP',
        targetId: req.params.id,
        senderId: req.user.id,
        content,
        messageType,
        attachment,
        replyToId,
    });

    const io = getSocketIo();
    if (io) {
        io.to(`group:${req.params.id}`).emit('group:message', message);
    }

    ok(res, { message }, 201);
});

export const unsendMessage = asyncHandler(async(req, res) => {
    const { messageId } = req.params;
    const message = await prisma.groupMessage.findUnique({
        where: { id: messageId },
        include: { group: true },
    });
    if (!message) throw new ApiError(404, 'Message not found');

    const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: message.groupId, userId: req.user.id } },
    });
    const isModeratorOrOwner = Boolean(
        message.group.ownerId === req.user.id ||
        membership?.role === 'OWNER' ||
        membership?.role === 'MODERATOR'
    );

    const updated = await deleteScopedMessageForEveryone({
        scope: 'GROUP',
        messageId,
        userId: req.user.id,
        userRole: req.user.role,
        isModeratorOrOwner,
    });

    const io = getSocketIo();
    if (io) {
        io.to(`group:${message.groupId}`).emit('group:message_unsent', {
            messageId,
            message: updated,
        });
    }

    ok(res, { message: updated });
});

export const editGroupMessage = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const { messageId } = req.params;
    const existing = await prisma.groupMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.groupId !== req.params.id) {
        throw new ApiError(404, 'Message not found in this group');
    }
    const updated = await editScopedMessage({
        scope: 'GROUP',
        messageId,
        userId: req.user.id,
        content: req.body?.content,
    });

    const io = getSocketIo();
    if (io) {
        io.to(`group:${req.params.id}`).emit('group:message_updated', updated);
    }
    ok(res, { message: updated });
});

export const deleteGroupMessageForMe = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const { messageId } = req.params;
    const existing = await prisma.groupMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.groupId !== req.params.id) {
        throw new ApiError(404, 'Message not found in this group');
    }
    const result = await deleteScopedMessageForMe({
        scope: 'GROUP',
        messageId,
        userId: req.user.id,
    });
    ok(res, result);
});

export const reactGroupMessage = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const { messageId } = req.params;
    const existing = await prisma.groupMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.groupId !== req.params.id) {
        throw new ApiError(404, 'Message not found in this group');
    }
    const result = await toggleScopedReaction({
        scope: 'GROUP',
        messageId,
        userId: req.user.id,
        emoji: req.body?.emoji,
    });
    const io = getSocketIo();
    if (io) {
        io.to(`group:${req.params.id}`).emit('group:message_updated', result.message);
    }
    ok(res, result);
});

export const pinGroupMessage = asyncHandler(async(req, res) => {
    const membership = await requireMembership(req.params.id, req.user.id);
    const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id } });
    const isAllowed = Boolean(
        req.user.role === 'ADMIN' ||
        group?.ownerId === req.user.id ||
        membership.role === 'OWNER' ||
        membership.role === 'MODERATOR'
    );
    const { messageId } = req.params;
    const existing = await prisma.groupMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.groupId !== req.params.id) {
        throw new ApiError(404, 'Message not found in this group');
    }
    const updated = await toggleScopedPin({
        scope: 'GROUP',
        messageId,
        userId: req.user.id,
        isAllowed,
    });
    const io = getSocketIo();
    if (io) {
        io.to(`group:${req.params.id}`).emit('group:message_updated', updated);
    }
    ok(res, { message: updated });
});

export const markGroupMessagesRead = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const result = await markScopedMessagesRead({
        scope: 'GROUP',
        targetId: req.params.id,
        userId: req.user.id,
        messageIds: req.body?.messageIds,
    });
    const io = getSocketIo();
    if (io && result.messageIds.length > 0) {
        io.to(`group:${req.params.id}`).emit('group:messages_seen', {
            groupId: req.params.id,
            userId: req.user.id,
            seenAt: result.seenAt,
            messageIds: result.messageIds,
        });
    }
    ok(res, result);
});

export const clearGroupConversation = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const action = req.body?.action === 'DELETE' ? 'DELETE' : 'CLEAR';
    const pref = await updateConversationPreference({
        userId: req.user.id,
        targetType: 'GROUP',
        targetId: req.params.id,
        action,
    });
    ok(res, { preference: pref });
});

export { requireMembership };