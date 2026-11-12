import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
    formatPresence,
    fetchScopedMessages,
    createScopedMessage,
    editScopedMessage,
    deleteScopedMessageForMe,
    deleteScopedMessageForEveryone,
    toggleScopedReaction,
    toggleScopedPin,
    markScopedMessagesRead,
    updateConversationPreference,
    computeUnreadCount,
} from '../services/messagingService.js';
import { getSocketIo } from '../services/notificationService.js';

const requireDirectParticipant = async(chatId, userId, allowAdmin = false) => {
    const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new ApiError(404, 'Direct chat not found');
    const isParticipant = chat.user1Id === userId || chat.user2Id === userId;
    if (!isParticipant && !allowAdmin) {
        throw new ApiError(403, 'Unauthorized');
    }
    return chat;
};

export const listDirectChats = asyncHandler(async(req, res) => {
    const currentUserId = req.user.id;

    const [chats, prefs] = await Promise.all([
        prisma.directChat.findMany({
            where: {
                OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
            },
            include: {
                user1: {
                    select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true, points: true, lastSeenAt: true, showOnlineStatus: true },
                },
                user2: {
                    select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true, points: true, lastSeenAt: true, showOnlineStatus: true },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { updatedAt: 'desc' },
        }),
        prisma.conversationPreference.findMany({
            where: { userId: currentUserId, targetType: 'DIRECT' },
        }),
    ]);

    const prefMap = new Map(prefs.map((p) => [p.targetId, p]));

    const formattedChats = [];
    for (const chat of chats) {
        const pref = prefMap.get(chat.id);
        const lastMessage = chat.messages[0] || null;
        if (pref?.deletedAt) {
            const deletedTime = new Date(pref.deletedAt).getTime();
            const lastActivityTime = lastMessage
                ? new Date(lastMessage.createdAt).getTime()
                : new Date(chat.updatedAt || chat.createdAt).getTime();
            if (lastActivityTime <= deletedTime) {
                continue;
            }
        }

        const isUser1 = chat.user1Id === currentUserId;
        const partner = isUser1 ? chat.user2 : chat.user1;
        const isClearedLatest = Boolean(
            pref?.clearedAt && lastMessage && new Date(lastMessage.createdAt) <= new Date(pref.clearedAt)
        );
        const unreadCount = await computeUnreadCount({
            scope: 'DIRECT',
            targetId: chat.id,
            userId: currentUserId,
            pref,
        });

        formattedChats.push({
            id: chat.id,
            status: chat.status,
            initiatorId: chat.initiatorId,
            isInitiator: chat.initiatorId === currentUserId,
            partner: {
                ...partner,
                presence: formatPresence(partner),
            },
            unreadCount,
            lastMessage:
                lastMessage && !isClearedLatest
                    ? {
                          id: lastMessage.id,
                          content:
                              lastMessage.isUnsent || lastMessage.deletedForEveryoneAt
                                  ? 'This message was unsent'
                                  : lastMessage.content,
                          isUnsent: Boolean(lastMessage.isUnsent || lastMessage.deletedForEveryoneAt),
                          senderId: lastMessage.senderId,
                          createdAt: lastMessage.createdAt,
                      }
                    : null,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
        });
    }

    ok(res, { chats: formattedChats });
});

export const searchUsersForChat = asyncHandler(async(req, res) => {
    const query = (req.query.q || '').trim();
    const currentUserId = req.user.id;

    if (!query || query.length < 2) {
        return ok(res, { users: [] });
    }

    const users = await prisma.user.findMany({
        where: {
            id: { not: currentUserId },
            isActive: true,
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { username: { contains: query, mode: 'insensitive' } },
            ],
        },
        select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            grade: true,
            board: true,
            points: true,
        },
        take: 15,
    });

    // Attach existing chat status if any
    const userIds = users.map((u) => u.id);
    const existingChats = await prisma.directChat.findMany({
        where: {
            OR: [
                { user1Id: currentUserId, user2Id: { in: userIds } },
                { user2Id: currentUserId, user1Id: { in: userIds } },
            ],
        },
    });

    const chatMap = new Map();
    existingChats.forEach((c) => {
        const otherId = c.user1Id === currentUserId ? c.user2Id : c.user1Id;
        chatMap.set(otherId, c);
    });

    const results = users.map((u) => ({
        ...u,
        chat: chatMap.get(u.id) || null,
    }));

    ok(res, { users: results });
});

export const requestDirectChat = asyncHandler(async(req, res) => {
    const currentUserId = req.user.id;
    const { recipientId, recipientEmail } = req.body;

    let targetUserId = recipientId;
    if (!targetUserId && recipientEmail) {
        const targetUser = await prisma.user.findUnique({
            where: { email: recipientEmail.trim().toLowerCase() },
        });
        if (!targetUser) throw new ApiError(404, 'User not found with this email');
        targetUserId = targetUser.id;
    }

    if (!targetUserId) {
        throw new ApiError(400, 'recipientId or recipientEmail is required');
    }

    if (targetUserId === currentUserId) {
        throw new ApiError(400, 'Cannot start a direct chat with yourself');
    }

    // Ensure deterministic user ordering to enforce @@unique([user1Id, user2Id])
    const [user1Id, user2Id] = currentUserId < targetUserId ?
        [currentUserId, targetUserId] :
        [targetUserId, currentUserId];

    let chat = await prisma.directChat.findUnique({
        where: {
            user1Id_user2Id: { user1Id, user2Id },
        },
        include: {
            user1: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
            user2: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
        },
    });

    if (chat) {
        // If chat already exists and is pending, and current user is recipient, automatically accept it!
        if (chat.status === 'PENDING' && chat.initiatorId !== currentUserId) {
            chat = await prisma.directChat.update({
                where: { id: chat.id },
                data: { status: 'ACCEPTED' },
                include: {
                    user1: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
                    user2: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
                },
            });
        }
        return ok(res, { chat });
    }

    chat = await prisma.directChat.create({
        data: {
            user1Id,
            user2Id,
            status: 'PENDING',
            initiatorId: currentUserId,
        },
        include: {
            user1: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
            user2: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
        },
    });

    ok(res, { chat }, 201);
});

export const updateChatStatus = asyncHandler(async(req, res) => {
    const { chatId } = req.params;
    const { status } = req.body;
    const currentUserId = req.user.id;

    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
        throw new ApiError(400, 'Status must be ACCEPTED or REJECTED');
    }

    const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new ApiError(404, 'Direct chat not found');

    if (chat.user1Id !== currentUserId && chat.user2Id !== currentUserId) {
        throw new ApiError(403, 'Unauthorized');
    }

    const updatedChat = await prisma.directChat.update({
        where: { id: chatId },
        data: { status },
    });

    ok(res, { chat: updatedChat });
});

export const getDirectMessages = asyncHandler(async(req, res) => {
    const { chatId } = req.params;
    const currentUserId = req.user.id;

    const chat = await requireDirectParticipant(chatId, currentUserId, req.user.role === 'ADMIN');
    const result = await fetchScopedMessages({
        scope: 'DIRECT',
        targetId: chatId,
        viewerId: currentUserId,
        search: req.query.search,
        limit: req.query.limit,
    });

    const partnerId = chat.user1Id === currentUserId ? chat.user2Id : chat.user1Id;
    const partnerUser = await prisma.user.findUnique({
        where: { id: partnerId },
        select: { id: true, name: true, email: true, avatarUrl: true, lastSeenAt: true, showOnlineStatus: true },
    });

    ok(res, {
        ...result,
        chat,
        partnerPresence: formatPresence(partnerUser),
    });
});

export const sendDirectMessage = asyncHandler(async(req, res) => {
    const { chatId } = req.params;
    const { content, messageType, attachment, replyToId } = req.body;
    const currentUserId = req.user.id;

    const chat = await requireDirectParticipant(chatId, currentUserId);
    const message = await createScopedMessage({
        scope: 'DIRECT',
        targetId: chatId,
        senderId: currentUserId,
        content,
        messageType,
        attachment,
        replyToId,
    });

    const io = getSocketIo();
    if (io) {
        io.to(`direct:${chatId}`).emit('direct:message', message);
        const recipientId = chat.user1Id === currentUserId ? chat.user2Id : chat.user1Id;
        io.to(`user:${recipientId}`).emit('direct:notification', { chatId, message });
    }

    ok(res, { message }, 201);
});

export const unsendDirectMessage = asyncHandler(async(req, res) => {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new ApiError(404, 'Message not found');
    await requireDirectParticipant(msg.chatId, currentUserId, req.user.role === 'ADMIN');

    const updated = await deleteScopedMessageForEveryone({
        scope: 'DIRECT',
        messageId,
        userId: currentUserId,
        userRole: req.user.role,
    });

    const io = getSocketIo();
    if (io) {
        io.to(`direct:${msg.chatId}`).emit('direct:message_unsent', {
            messageId,
            message: updated,
        });
    }

    ok(res, { message: updated });
});

export const editDirectMessage = asyncHandler(async(req, res) => {
    const { chatId, messageId } = req.params;
    await requireDirectParticipant(chatId, req.user.id);
    const existing = await prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.chatId !== chatId) {
        throw new ApiError(404, 'Message not found in this chat');
    }

    const updated = await editScopedMessage({
        scope: 'DIRECT',
        messageId,
        userId: req.user.id,
        content: req.body?.content,
    });

    const io = getSocketIo();
    if (io) {
        io.to(`direct:${chatId}`).emit('direct:message_updated', updated);
    }
    ok(res, { message: updated });
});

export const deleteDirectMessageForMe = asyncHandler(async(req, res) => {
    const { chatId, messageId } = req.params;
    await requireDirectParticipant(chatId, req.user.id);
    const existing = await prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.chatId !== chatId) {
        throw new ApiError(404, 'Message not found in this chat');
    }

    const result = await deleteScopedMessageForMe({
        scope: 'DIRECT',
        messageId,
        userId: req.user.id,
    });
    ok(res, result);
});

export const reactDirectMessage = asyncHandler(async(req, res) => {
    const { chatId, messageId } = req.params;
    await requireDirectParticipant(chatId, req.user.id);
    const existing = await prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.chatId !== chatId) {
        throw new ApiError(404, 'Message not found in this chat');
    }

    const result = await toggleScopedReaction({
        scope: 'DIRECT',
        messageId,
        userId: req.user.id,
        emoji: req.body?.emoji,
    });

    const io = getSocketIo();
    if (io) {
        io.to(`direct:${chatId}`).emit('direct:message_updated', result.message);
    }
    ok(res, result);
});

export const pinDirectMessage = asyncHandler(async(req, res) => {
    const { chatId, messageId } = req.params;
    await requireDirectParticipant(chatId, req.user.id);
    const existing = await prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.chatId !== chatId) {
        throw new ApiError(404, 'Message not found in this chat');
    }

    const updated = await toggleScopedPin({
        scope: 'DIRECT',
        messageId,
        userId: req.user.id,
        isAllowed: true,
    });

    const io = getSocketIo();
    if (io) {
        io.to(`direct:${chatId}`).emit('direct:message_updated', updated);
    }
    ok(res, { message: updated });
});

export const markDirectChatRead = asyncHandler(async(req, res) => {
    const { chatId } = req.params;
    await requireDirectParticipant(chatId, req.user.id);
    const result = await markScopedMessagesRead({
        scope: 'DIRECT',
        targetId: chatId,
        userId: req.user.id,
        messageIds: req.body?.messageIds,
    });

    const io = getSocketIo();
    if (io && result.messageIds.length > 0) {
        io.to(`direct:${chatId}`).emit('direct:messages_seen', {
            chatId,
            userId: req.user.id,
            seenAt: result.seenAt,
            messageIds: result.messageIds,
        });
    }
    ok(res, result);
});

export const clearDirectConversation = asyncHandler(async(req, res) => {
    const { chatId } = req.params;
    await requireDirectParticipant(chatId, req.user.id);
    const action = req.method === 'DELETE' || req.body?.action === 'DELETE' ? 'DELETE' : 'CLEAR';
    const preference = await updateConversationPreference({
        userId: req.user.id,
        targetType: 'DIRECT',
        targetId: chatId,
        action,
    });
    ok(res, { preference });
});