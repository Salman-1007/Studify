import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { sendPushToUser, sendPushToUsers } from './pushService.js';

export const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '🔥', '✅'];
export const ALLOWED_MESSAGE_TYPES = [
    'TEXT',
    'STUDY_NOTE',
    'MATERIAL',
    'QUIZ',
    'QUIZ_ASSIGNMENT',
    'ANNOUNCEMENT',
];
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

const onlineUserSockets = new Map();

const SCOPE_CONFIG = {
    GROUP: {
        msgModel: 'groupMessage',
        reactionModel: 'groupMessageReaction',
        deletionModel: 'groupMessageDeletion',
        receiptModel: 'groupMessageReceipt',
        fk: 'groupId',
        targetType: 'GROUP',
        senderSelect: { id: true, name: true, username: true, avatarUrl: true, role: true },
    },
    DIRECT: {
        msgModel: 'directMessage',
        reactionModel: 'directMessageReaction',
        deletionModel: 'directMessageDeletion',
        receiptModel: 'directMessageReceipt',
        fk: 'chatId',
        targetType: 'DIRECT',
        senderSelect: { id: true, name: true, username: true, email: true, avatarUrl: true, role: true },
    },
};

export const markUserOnline = (userId, socketId) => {
    if (!userId || !socketId) return;
    if (!onlineUserSockets.has(userId)) {
        onlineUserSockets.set(userId, new Set());
    }
    onlineUserSockets.get(userId).add(socketId);
};

export const markUserOffline = (userId, socketId) => {
    if (!userId || !socketId) return false;
    const set = onlineUserSockets.get(userId);
    if (!set) return true;
    set.delete(socketId);
    if (set.size === 0) {
        onlineUserSockets.delete(userId);
        return true;
    }
    return false;
};

export const isUserOnline = (userId) => {
    const set = onlineUserSockets.get(userId);
    return Boolean(set && set.size > 0);
};

export const formatPresence = (user) => {
    if (!user) return { online: false, lastSeenAt: null, showOnlineStatus: false };
    if (user.showOnlineStatus === false) {
        return { online: false, lastSeenAt: null, showOnlineStatus: false };
    }
    return {
        online: isUserOnline(user.id),
        lastSeenAt: user.lastSeenAt || null,
        showOnlineStatus: true,
    };
};

export const validateAndBuildAttachment = async({ messageType = 'TEXT', attachment = null, userId }) => {
    const normalizedType = ALLOWED_MESSAGE_TYPES.includes(messageType) ? messageType : 'TEXT';
    if (normalizedType === 'TEXT' || !attachment) {
        return { messageType: normalizedType, attachment: null };
    }

    if (normalizedType === 'MATERIAL' && attachment.id) {
        const mat = await prisma.material.findUnique({ where: { id: attachment.id } });
        if (!mat) throw new ApiError(404, 'Shared material not found');
        if (mat.userId !== userId) {
            throw new ApiError(403, 'You can only share study materials you uploaded');
        }
        return {
            messageType: 'MATERIAL',
            attachment: {
                id: mat.id,
                title: mat.title,
                fileType: mat.fileType,
                link: '/materials',
            },
        };
    }

    if (normalizedType === 'QUIZ' && attachment.id) {
        const quiz = await prisma.quiz.findUnique({
            where: { id: attachment.id },
            include: { questions: true },
        });
        if (!quiz) throw new ApiError(404, 'Shared quiz not found');
        return {
            messageType: 'QUIZ',
            attachment: {
                id: quiz.id,
                title: quiz.title,
                subject: quiz.subject,
                difficulty: quiz.difficulty,
                questionCount: quiz.questions?.length || 0,
                link: `/quizzes/${quiz.id}`,
            },
        };
    }

    if (normalizedType === 'QUIZ_ASSIGNMENT' && attachment.id) {
        const assignment = await prisma.classroomQuizAssignment.findUnique({
            where: { id: attachment.id },
            include: { quiz: true },
        });
        if (!assignment) throw new ApiError(404, 'Quiz assignment not found');
        const membership = await prisma.classroomMembership.findUnique({
            where: { classroomId_userId: { classroomId: assignment.classroomId, userId } },
        });
        if (assignment.createdById !== userId && (!membership || membership.status !== 'ACTIVE')) {
            throw new ApiError(403, 'You do not have access to share this quiz assignment');
        }
        return {
            messageType: 'QUIZ_ASSIGNMENT',
            attachment: {
                id: assignment.id,
                quizId: assignment.quizId,
                classroomId: assignment.classroomId,
                title: assignment.title || assignment.quiz?.title || 'Classroom Quiz',
                deadline: assignment.deadline || null,
                link: `/quizzes/${assignment.quizId}?assignmentId=${assignment.id}`,
            },
        };
    }

    if (normalizedType === 'ANNOUNCEMENT' && attachment.id) {
        const ann = await prisma.classroomAnnouncement.findUnique({
            where: { id: attachment.id },
        });
        if (!ann) throw new ApiError(404, 'Announcement not found');
        const membership = await prisma.classroomMembership.findUnique({
            where: { classroomId_userId: { classroomId: ann.classroomId, userId } },
        });
        if (ann.authorId !== userId && (!membership || membership.status !== 'ACTIVE')) {
            throw new ApiError(403, 'You do not have access to share this announcement');
        }
        return {
            messageType: 'ANNOUNCEMENT',
            attachment: {
                id: ann.id,
                classroomId: ann.classroomId,
                title: ann.title || 'Classroom Announcement',
                excerpt: String(ann.content || '').slice(0, 140),
                link: `/classrooms/${ann.classroomId}`,
            },
        };
    }

    if (normalizedType === 'STUDY_NOTE') {
        return {
            messageType: 'STUDY_NOTE',
            attachment: {
                title: String(attachment.title || 'Study Note').slice(0, 120),
                topic: attachment.topic ? String(attachment.topic).slice(0, 80) : null,
                excerpt: String(attachment.excerpt || '').slice(0, 300),
            },
        };
    }

    return { messageType: normalizedType, attachment };
};

export const summarizeReactions = (reactions = [], viewerId = null) => {
    const map = new Map();
    for (const r of reactions) {
        if (!map.has(r.emoji)) {
            map.set(r.emoji, { emoji: r.emoji, count: 0, reactedByMe: false, userIds: [] });
        }
        const entry = map.get(r.emoji);
        entry.count += 1;
        entry.userIds.push(r.userId);
        if (viewerId && r.userId === viewerId) entry.reactedByMe = true;
    }
    return Array.from(map.values());
};

export const computeDeliveryStatus = (msg, receipts = []) => {
    const peerReceipts = (receipts || []).filter((r) => r.userId !== msg.senderId);
    if (peerReceipts.some((r) => Boolean(r.seenAt))) return 'SEEN';
    if (peerReceipts.some((r) => Boolean(r.deliveredAt))) return 'DELIVERED';
    return 'SENT';
};

export const serializeMessage = (msg, viewerId = null) => {
    if (!msg) return null;
    const isDeletedForEveryone = Boolean(msg.isUnsent || msg.deletedForEveryoneAt);
    const replyIsDeleted = msg.replyTo && Boolean(msg.replyTo.isUnsent || msg.replyTo.deletedForEveryoneAt);

    return {
        ...msg,
        content: isDeletedForEveryone ? 'This message was unsent' : msg.content,
        attachment: isDeletedForEveryone ? null : msg.attachment || null,
        isDeletedForEveryone,
        replyTo: msg.replyTo
            ? {
                  id: msg.replyTo.id,
                  senderId: msg.replyTo.senderId,
                  sender: msg.replyTo.sender || null,
                  messageType: replyIsDeleted ? 'TEXT' : msg.replyTo.messageType || 'TEXT',
                  content: replyIsDeleted ? 'This message was unsent' : msg.replyTo.content,
                  isUnsent: replyIsDeleted,
              }
            : null,
        reactions: isDeletedForEveryone ? [] : msg.reactions || [],
        reactionSummary: isDeletedForEveryone ? [] : summarizeReactions(msg.reactions || [], viewerId),
        receipts: msg.receipts || [],
        deliveryStatus: computeDeliveryStatus(msg, msg.receipts || []),
    };
};

const messageIncludeForScope = (cfg) => ({
    sender: { select: cfg.senderSelect },
    replyTo: {
        include: {
            sender: { select: cfg.senderSelect },
        },
    },
    reactions: {
        include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
        },
    },
    receipts: true,
});

export const fetchScopedMessages = async({ scope, targetId, viewerId, search = '', limit = 100 }) => {
    const cfg = SCOPE_CONFIG[scope];
    if (!cfg) throw new ApiError(400, 'Invalid messaging scope');

    const pref = await prisma.conversationPreference.findUnique({
        where: { userId_targetType_targetId: { userId: viewerId, targetType: cfg.targetType, targetId } },
    });

    const clearedAt = pref?.clearedAt ? new Date(pref.clearedAt) : null;
    const where = { [cfg.fk]: targetId };
    if (clearedAt) {
        where.createdAt = { gt: clearedAt };
    }

    const rawMessages = await prisma[cfg.msgModel].findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 100, 200),
        include: messageIncludeForScope(cfg),
    });

    const deletions = await prisma[cfg.deletionModel].findMany({
        where: { userId: viewerId },
    });
    const deletedSet = new Set(deletions.map((d) => d.messageId));

    let visible = rawMessages
        .filter((m) => !deletedSet.has(m.id))
        .reverse()
        .map((m) => serializeMessage(m, viewerId));

    const trimmedSearch = String(search || '').trim().toLowerCase();
    if (trimmedSearch) {
        visible = visible.filter(
            (m) =>
                !m.isDeletedForEveryone &&
                ((m.content || '').toLowerCase().includes(trimmedSearch) ||
                    (m.attachment?.title || '').toLowerCase().includes(trimmedSearch))
        );
    }

    const pinnedMessages = visible.filter((m) => m.isPinned && !m.isDeletedForEveryone);
    const unreadCount = visible.filter(
        (m) =>
            m.senderId !== viewerId &&
            (!pref?.lastReadAt || new Date(m.createdAt) > new Date(pref.lastReadAt)) &&
            !(m.receipts || []).some((r) => r.userId === viewerId && r.seenAt)
    ).length;

    return { messages: visible, pinnedMessages, unreadCount, clearedAt };
};

export const createScopedMessage = async({
    scope,
    targetId,
    senderId,
    content,
    messageType = 'TEXT',
    attachment = null,
    replyToId = null,
}) => {
    const cfg = SCOPE_CONFIG[scope];
    if (!cfg) throw new ApiError(400, 'Invalid messaging scope');

    const text = String(content || '').trim();
    if (!text && !attachment) {
        throw new ApiError(400, 'Message cannot be empty');
    }

    if (replyToId) {
        const parent = await prisma[cfg.msgModel].findUnique({ where: { id: replyToId } });
        if (!parent || parent[cfg.fk] !== targetId) {
            throw new ApiError(400, 'Reply target message not found in this conversation');
        }
    }

    const built = await validateAndBuildAttachment({ messageType, attachment, userId: senderId });

    const message = await prisma[cfg.msgModel].create({
        data: {
            [cfg.fk]: targetId,
            senderId,
            content: text || built.attachment?.title || 'Shared study item',
            messageType: built.messageType,
            attachment: built.attachment,
            replyToId: replyToId || null,
        },
        include: messageIncludeForScope(cfg),
    });

    if (scope === 'DIRECT') {
        await prisma.directChat.update({
            where: { id: targetId },
            data: { updatedAt: new Date() },
        });
    }

    const serialized = serializeMessage(message, senderId);

    // Asynchronously dispatch mobile push notification
    (async () => {
        try {
            const senderName = message.sender?.name || 'Someone';
            const bodyPreview = (message.content || 'Sent an attachment').slice(0, 100);

            if (scope === 'DIRECT') {
                const chat = await prisma.directChat.findUnique({ where: { id: targetId } });
                if (chat) {
                    const recipientId = chat.user1Id === senderId ? chat.user2Id : chat.user1Id;
                    await sendPushToUser(recipientId, {
                        title: senderName,
                        body: bodyPreview,
                        type: 'CHAT_MESSAGE',
                        data: {
                            screen: 'ChatRoom',
                            scope: 'DIRECT',
                            chatId: targetId,
                            senderId,
                        },
                    });
                }
            } else if (scope === 'GROUP') {
                const members = await prisma.groupMember.findMany({
                    where: { groupId: targetId, userId: { not: senderId } },
                    select: { userId: true },
                });
                const group = await prisma.studyGroup.findUnique({
                    where: { id: targetId },
                    select: { name: true },
                });
                const groupName = group?.name || 'Study Group';
                const userIds = members.map((m) => m.userId);
                await sendPushToUsers(userIds, {
                    title: `${groupName}: ${senderName}`,
                    body: bodyPreview,
                    type: 'CHAT_MESSAGE',
                    data: {
                        screen: 'ChatRoom',
                        scope: 'GROUP',
                        groupId: targetId,
                        senderId,
                    },
                });
            }
        } catch (err) {
            // Mobile push should not fail socket message send
            console.warn('[MessagingService] Push dispatch notice:', err?.message || err);
        }
    })();

    return serialized;
};

export const editScopedMessage = async({ scope, messageId, userId, content }) => {
    const cfg = SCOPE_CONFIG[scope];
    const msg = await prisma[cfg.msgModel].findUnique({ where: { id: messageId } });
    if (!msg) throw new ApiError(404, 'Message not found');
    if (msg.senderId !== userId) throw new ApiError(403, 'You can only edit your own messages');
    if (msg.isUnsent || msg.deletedForEveryoneAt) {
        throw new ApiError(400, 'Deleted messages cannot be edited');
    }
    if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS) {
        throw new ApiError(400, 'Message edit window (15 minutes) has expired');
    }

    const trimmed = String(content || '').trim();
    if (!trimmed) throw new ApiError(400, 'Edited message cannot be empty');

    const updated = await prisma[cfg.msgModel].update({
        where: { id: messageId },
        data: { content: trimmed, editedAt: new Date() },
        include: messageIncludeForScope(cfg),
    });

    return serializeMessage(updated, userId);
};

export const deleteScopedMessageForMe = async({ scope, messageId, userId }) => {
    const cfg = SCOPE_CONFIG[scope];
    const msg = await prisma[cfg.msgModel].findUnique({ where: { id: messageId } });
    if (!msg) throw new ApiError(404, 'Message not found');

    const existing = await prisma[cfg.deletionModel].findUnique({
        where: { messageId_userId: { messageId, userId } },
    });
    if (!existing) {
        await prisma[cfg.deletionModel].create({
            data: { messageId, userId },
        });
    }
    return { messageId, deletedForMe: true };
};

export const deleteScopedMessageForEveryone = async({
    scope,
    messageId,
    userId,
    userRole,
    isModeratorOrOwner = false,
}) => {
    const cfg = SCOPE_CONFIG[scope];
    const msg = await prisma[cfg.msgModel].findUnique({ where: { id: messageId } });
    if (!msg) throw new ApiError(404, 'Message not found');

    if (msg.senderId !== userId && !isModeratorOrOwner && userRole !== 'ADMIN') {
        throw new ApiError(403, 'Not authorized to delete this message for everyone');
    }

    const now = new Date();
    const updated = await prisma[cfg.msgModel].update({
        where: { id: messageId },
        data: {
            isUnsent: true,
            unsentAt: now,
            deletedForEveryoneAt: now,
            deletedById: userId,
            content: 'This message was unsent',
            attachment: null,
            isPinned: false,
            pinnedAt: null,
        },
        include: messageIncludeForScope(cfg),
    });

    return serializeMessage(updated, userId);
};

export const toggleScopedReaction = async({ scope, messageId, userId, emoji }) => {
    if (!ALLOWED_EMOJIS.includes(emoji)) {
        throw new ApiError(400, `Unsupported reaction emoji. Allowed: ${ALLOWED_EMOJIS.join(' ')}`);
    }
    const cfg = SCOPE_CONFIG[scope];
    const msg = await prisma[cfg.msgModel].findUnique({ where: { id: messageId } });
    if (!msg) throw new ApiError(404, 'Message not found');
    if (msg.isUnsent || msg.deletedForEveryoneAt) {
        throw new ApiError(400, 'Cannot react to a deleted message');
    }

    const existing = await prisma[cfg.reactionModel].findUnique({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    let action = 'added';
    if (existing) {
        await prisma[cfg.reactionModel].delete({ where: { id: existing.id } });
        action = 'removed';
    } else {
        await prisma[cfg.reactionModel].create({ data: { messageId, userId, emoji } });
    }

    const updated = await prisma[cfg.msgModel].findUnique({
        where: { id: messageId },
        include: messageIncludeForScope(cfg),
    });

    return { action, message: serializeMessage(updated, userId) };
};

export const toggleScopedPin = async({ scope, messageId, userId, isAllowed }) => {
    if (!isAllowed) {
        throw new ApiError(403, 'You do not have permission to pin messages in this conversation');
    }
    const cfg = SCOPE_CONFIG[scope];
    const msg = await prisma[cfg.msgModel].findUnique({ where: { id: messageId } });
    if (!msg) throw new ApiError(404, 'Message not found');
    if (msg.isUnsent || msg.deletedForEveryoneAt) {
        throw new ApiError(400, 'Cannot pin a deleted message');
    }

    const nextPinned = !msg.isPinned;
    const updated = await prisma[cfg.msgModel].update({
        where: { id: messageId },
        data: {
            isPinned: nextPinned,
            pinnedAt: nextPinned ? new Date() : null,
            pinnedById: nextPinned ? userId : null,
        },
        include: messageIncludeForScope(cfg),
    });

    return serializeMessage(updated, userId);
};

export const markScopedMessagesRead = async({ scope, targetId, userId, messageIds = null }) => {
    const cfg = SCOPE_CONFIG[scope];
    const now = new Date();

    await prisma.conversationPreference.upsert({
        where: { userId_targetType_targetId: { userId, targetType: cfg.targetType, targetId } },
        update: { lastReadAt: now },
        create: { userId, targetType: cfg.targetType, targetId, lastReadAt: now },
    });

    const where = {
        [cfg.fk]: targetId,
        senderId: { not: userId },
    };
    if (Array.isArray(messageIds) && messageIds.length > 0) {
        where.id = { in: messageIds };
    }

    const candidateMsgs = await prisma[cfg.msgModel].findMany({ where, take: 100 });
    const updatedIds = [];

    for (const m of candidateMsgs) {
        await prisma[cfg.receiptModel].upsert({
            where: { messageId_userId: { messageId: m.id, userId } },
            update: { seenAt: now },
            create: { messageId: m.id, userId, deliveredAt: now, seenAt: now },
        });
        updatedIds.push(m.id);
    }

    return { seenAt: now, messageIds: updatedIds };
};

export const updateConversationPreference = async({ userId, targetType, targetId, action }) => {
    const now = new Date();
    const update = {};
    const create = { userId, targetType, targetId };

    if (action === 'CLEAR') {
        update.clearedAt = now;
        create.clearedAt = now;
    } else if (action === 'DELETE') {
        update.clearedAt = now;
        update.deletedAt = now;
        create.clearedAt = now;
        create.deletedAt = now;
    } else if (action === 'RESTORE') {
        update.deletedAt = null;
        create.deletedAt = null;
    } else if (action === 'ARCHIVE') {
        update.archivedAt = now;
        create.archivedAt = now;
    } else {
        throw new ApiError(400, 'Invalid conversation action');
    }

    return prisma.conversationPreference.upsert({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
        update,
        create,
    });
};

export const computeUnreadCount = async({ scope, targetId, userId, pref = null }) => {
    const cfg = SCOPE_CONFIG[scope];
    const cutoff = pref?.lastReadAt && pref?.clearedAt
        ? new Date(Math.max(new Date(pref.lastReadAt).getTime(), new Date(pref.clearedAt).getTime()))
        : pref?.lastReadAt || pref?.clearedAt || null;

    const where = {
        [cfg.fk]: targetId,
        senderId: { not: userId },
        isUnsent: false,
    };
    if (cutoff) {
        where.createdAt = { gt: new Date(cutoff) };
    }
    return prisma[cfg.msgModel].count({ where });
};
