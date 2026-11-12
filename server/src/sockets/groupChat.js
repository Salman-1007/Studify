import { verifyAccessToken } from '../utils/tokens.js';
import { prisma } from '../config/db.js';
import { setNotificationIo } from '../services/notificationService.js';
import {
    markUserOnline,
    markUserOffline,
    createScopedMessage,
    editScopedMessage,
    deleteScopedMessageForMe,
    deleteScopedMessageForEveryone,
    toggleScopedReaction,
    toggleScopedPin,
    markScopedMessagesRead,
} from '../services/messagingService.js';

export const registerGroupChat = (io) => {
    setNotificationIo(io);

    io.use(async(socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error('Not authenticated'));
            const payload = verifyAccessToken(token);
            const user = await prisma.user.findUnique({ where: { id: payload.sub } });
            if (!user || !user.isActive) return next(new Error('Not authenticated'));
            socket.user = user;
            next();
        } catch {
            next(new Error('Not authenticated'));
        }
    });

    io.on('connection', async(socket) => {
        socket.join(`user:${socket.user.id}`);
        markUserOnline(socket.user.id, socket.id);

        try {
            await prisma.user.update({
                where: { id: socket.user.id },
                data: { lastSeenAt: new Date() },
            });
            if (socket.user.showOnlineStatus !== false) {
                io.emit('presence:update', {
                    userId: socket.user.id,
                    online: true,
                    lastSeenAt: new Date().toISOString(),
                });
            }
        } catch {
            // Best-effort presence update
        }

        // --- Study Group Events ---
        socket.on('group:join', async({ groupId }, cb) => {
            try {
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                if (!membership) return cb?.({ success: false, message: 'Not a member of this group' });
                socket.join(`group:${groupId}`);
                cb?.({ success: true });
            } catch {
                cb?.({ success: false, message: 'Failed to join group room' });
            }
        });

        socket.on('group:typing', async({ groupId, isTyping }) => {
            if (!groupId) return;
            socket.to(`group:${groupId}`).emit('group:typing', {
                groupId,
                userId: socket.user.id,
                name: socket.user.name,
                isTyping: Boolean(isTyping),
            });
        });

        socket.on('group:message', async({ groupId, content, messageType, attachment, replyToId }, cb) => {
            try {
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                if (!membership) return cb?.({ success: false, message: 'Not a member of this group' });

                const message = await createScopedMessage({
                    scope: 'GROUP',
                    targetId: groupId,
                    senderId: socket.user.id,
                    content,
                    messageType,
                    attachment,
                    replyToId,
                });

                io.to(`group:${groupId}`).emit('group:message', message);
                cb?.({ success: true, message });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to send message' });
            }
        });

        socket.on('group:edit', async({ groupId, messageId, content }, cb) => {
            try {
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                if (!membership) return cb?.({ success: false, message: 'Not a member of this group' });
                const msg = await prisma.groupMessage.findUnique({ where: { id: messageId } });
                if (!msg || msg.groupId !== groupId) return cb?.({ success: false, message: 'Message not found' });

                const updated = await editScopedMessage({
                    scope: 'GROUP',
                    messageId,
                    userId: socket.user.id,
                    content,
                });
                io.to(`group:${groupId}`).emit('group:message_updated', updated);
                cb?.({ success: true, message: updated });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to edit message' });
            }
        });

        socket.on('group:delete_for_me', async({ groupId, messageId }, cb) => {
            try {
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                if (!membership) return cb?.({ success: false, message: 'Not a member of this group' });
                const result = await deleteScopedMessageForMe({
                    scope: 'GROUP',
                    messageId,
                    userId: socket.user.id,
                });
                cb?.({ success: true, ...result });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to delete message' });
            }
        });

        socket.on('group:unsend', async({ groupId, messageId }, cb) => {
            try {
                const msg = await prisma.groupMessage.findUnique({
                    where: { id: messageId },
                    include: { group: true },
                });
                if (!msg || msg.groupId !== groupId) {
                    return cb?.({ success: false, message: 'Message not found' });
                }
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                const isModeratorOrOwner = Boolean(
                    msg.group.ownerId === socket.user.id ||
                    membership?.role === 'OWNER' ||
                    membership?.role === 'MODERATOR'
                );

                const updated = await deleteScopedMessageForEveryone({
                    scope: 'GROUP',
                    messageId,
                    userId: socket.user.id,
                    userRole: socket.user.role,
                    isModeratorOrOwner,
                });

                io.to(`group:${groupId}`).emit('group:message_unsent', {
                    messageId,
                    message: updated,
                });
                cb?.({ success: true, message: updated });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to unsend message' });
            }
        });

        socket.on('group:react', async({ groupId, messageId, emoji }, cb) => {
            try {
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                if (!membership) return cb?.({ success: false, message: 'Not a member of this group' });
                const result = await toggleScopedReaction({
                    scope: 'GROUP',
                    messageId,
                    userId: socket.user.id,
                    emoji,
                });
                io.to(`group:${groupId}`).emit('group:message_updated', result.message);
                cb?.({ success: true, ...result });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to update reaction' });
            }
        });

        socket.on('group:pin', async({ groupId, messageId }, cb) => {
            try {
                const [membership, group] = await Promise.all([
                    prisma.groupMember.findUnique({
                        where: { groupId_userId: { groupId, userId: socket.user.id } },
                    }),
                    prisma.studyGroup.findUnique({ where: { id: groupId } }),
                ]);
                if (!membership) return cb?.({ success: false, message: 'Not a member' });
                const isAllowed = Boolean(
                    socket.user.role === 'ADMIN' ||
                    group?.ownerId === socket.user.id ||
                    membership.role === 'OWNER' ||
                    membership.role === 'MODERATOR'
                );
                const updated = await toggleScopedPin({
                    scope: 'GROUP',
                    messageId,
                    userId: socket.user.id,
                    isAllowed,
                });
                io.to(`group:${groupId}`).emit('group:message_updated', updated);
                cb?.({ success: true, message: updated });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to pin message' });
            }
        });

        socket.on('group:seen', async({ groupId, messageIds }, cb) => {
            try {
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                if (!membership) return cb?.({ success: false });
                const result = await markScopedMessagesRead({
                    scope: 'GROUP',
                    targetId: groupId,
                    userId: socket.user.id,
                    messageIds,
                });
                if (result.messageIds.length > 0) {
                    io.to(`group:${groupId}`).emit('group:messages_seen', {
                        groupId,
                        userId: socket.user.id,
                        seenAt: result.seenAt,
                        messageIds: result.messageIds,
                    });
                }
                cb?.({ success: true, ...result });
            } catch {
                cb?.({ success: false });
            }
        });

        // --- 1-on-1 Direct Chat Events ---
        socket.on('direct:join', async({ chatId }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id && socket.user.role !== 'ADMIN')) {
                    return cb?.({ success: false, message: 'Not authorized for this chat' });
                }
                socket.join(`direct:${chatId}`);
                cb?.({ success: true });
            } catch {
                cb?.({ success: false, message: 'Failed to join chat room' });
            }
        });

        socket.on('direct:typing', async({ chatId, isTyping }) => {
            if (!chatId) return;
            socket.to(`direct:${chatId}`).emit('direct:typing', {
                chatId,
                userId: socket.user.id,
                name: socket.user.name,
                isTyping: Boolean(isTyping),
            });
        });

        socket.on('direct:message', async({ chatId, content, messageType, attachment, replyToId }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id)) {
                    return cb?.({ success: false, message: 'Not authorized' });
                }

                const message = await createScopedMessage({
                    scope: 'DIRECT',
                    targetId: chatId,
                    senderId: socket.user.id,
                    content,
                    messageType,
                    attachment,
                    replyToId,
                });

                io.to(`direct:${chatId}`).emit('direct:message', message);

                const recipientId = chat.user1Id === socket.user.id ? chat.user2Id : chat.user1Id;
                io.to(`user:${recipientId}`).emit('direct:notification', {
                    chatId,
                    message,
                });

                cb?.({ success: true, message });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to send message' });
            }
        });

        socket.on('direct:edit', async({ chatId, messageId, content }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id)) {
                    return cb?.({ success: false, message: 'Not authorized' });
                }
                const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
                if (!msg || msg.chatId !== chatId) return cb?.({ success: false, message: 'Message not found' });

                const updated = await editScopedMessage({
                    scope: 'DIRECT',
                    messageId,
                    userId: socket.user.id,
                    content,
                });
                io.to(`direct:${chatId}`).emit('direct:message_updated', updated);
                cb?.({ success: true, message: updated });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to edit message' });
            }
        });

        socket.on('direct:delete_for_me', async({ chatId, messageId }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id)) {
                    return cb?.({ success: false, message: 'Not authorized' });
                }
                const result = await deleteScopedMessageForMe({
                    scope: 'DIRECT',
                    messageId,
                    userId: socket.user.id,
                });
                cb?.({ success: true, ...result });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to delete message' });
            }
        });

        socket.on('direct:unsend', async({ chatId, messageId }, cb) => {
            try {
                const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
                if (!msg || msg.chatId !== chatId) {
                    return cb?.({ success: false, message: 'Message not found' });
                }
                const updated = await deleteScopedMessageForEveryone({
                    scope: 'DIRECT',
                    messageId,
                    userId: socket.user.id,
                    userRole: socket.user.role,
                });

                io.to(`direct:${chatId}`).emit('direct:message_unsent', {
                    messageId,
                    message: updated,
                });
                cb?.({ success: true, message: updated });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to unsend message' });
            }
        });

        socket.on('direct:react', async({ chatId, messageId, emoji }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id)) {
                    return cb?.({ success: false, message: 'Not authorized' });
                }
                const result = await toggleScopedReaction({
                    scope: 'DIRECT',
                    messageId,
                    userId: socket.user.id,
                    emoji,
                });
                io.to(`direct:${chatId}`).emit('direct:message_updated', result.message);
                cb?.({ success: true, ...result });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to react' });
            }
        });

        socket.on('direct:pin', async({ chatId, messageId }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id)) {
                    return cb?.({ success: false, message: 'Not authorized' });
                }
                const updated = await toggleScopedPin({
                    scope: 'DIRECT',
                    messageId,
                    userId: socket.user.id,
                    isAllowed: true,
                });
                io.to(`direct:${chatId}`).emit('direct:message_updated', updated);
                cb?.({ success: true, message: updated });
            } catch (err) {
                cb?.({ success: false, message: err.message || 'Failed to pin' });
            }
        });

        socket.on('direct:seen', async({ chatId, messageIds }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id)) {
                    return cb?.({ success: false });
                }
                const result = await markScopedMessagesRead({
                    scope: 'DIRECT',
                    targetId: chatId,
                    userId: socket.user.id,
                    messageIds,
                });
                if (result.messageIds.length > 0) {
                    io.to(`direct:${chatId}`).emit('direct:messages_seen', {
                        chatId,
                        userId: socket.user.id,
                        seenAt: result.seenAt,
                        messageIds: result.messageIds,
                    });
                }
                cb?.({ success: true, ...result });
            } catch {
                cb?.({ success: false });
            }
        });

        socket.on('disconnect', async() => {
            const fullyOffline = markUserOffline(socket.user.id, socket.id);
            if (fullyOffline) {
                const now = new Date();
                try {
                    await prisma.user.update({
                        where: { id: socket.user.id },
                        data: { lastSeenAt: now },
                    });
                    if (socket.user.showOnlineStatus !== false) {
                        io.emit('presence:update', {
                            userId: socket.user.id,
                            online: false,
                            lastSeenAt: now.toISOString(),
                        });
                    }
                } catch {
                    // Best-effort offline update
                }
            }
        });
    });
};
