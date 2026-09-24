import { verifyAccessToken } from '../utils/tokens.js';
import { prisma } from '../config/db.js';

export const registerGroupChat = (io) => {
    io.use(async(socket, next) => {
        try {
            const token = socket.handshake.auth ?.token;
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

    io.on('connection', (socket) => {
        // Join personal room for notifications
        socket.join(`user:${socket.user.id}`);

        // --- Study Group Events ---
        socket.on('group:join', async({ groupId }, cb) => {
            const membership = await prisma.groupMember.findUnique({
                where: { groupId_userId: { groupId, userId: socket.user.id } },
            });
            if (!membership) return cb ?.({ success: false, message: 'Not a member of this group' });
            socket.join(`group:${groupId}`);
            cb ?.({ success: true });
        });

        socket.on('group:message', async({ groupId, content }, cb) => {
            try {
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                if (!membership) return cb ?.({ success: false, message: 'Not a member of this group' });
                if (!content || !content.trim()) return cb ?.({ success: false, message: 'Empty message' });

                const message = await prisma.groupMessage.create({
                    data: { groupId, senderId: socket.user.id, content: content.trim() },
                    include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
                });
                io.to(`group:${groupId}`).emit('group:message', message);
                cb ?.({ success: true, message });
            } catch (err) {
                cb ?.({ success: false, message: 'Failed to send message' });
            }
        });

        socket.on('group:unsend', async({ groupId, messageId }, cb) => {
            try {
                const msg = await prisma.groupMessage.findUnique({
                    where: { id: messageId },
                    include: { group: true },
                });
                if (!msg || msg.groupId !== groupId) {
                    return cb ?.({ success: false, message: 'Message not found' });
                }
                if (
                    msg.senderId !== socket.user.id &&
                    msg.group.ownerId !== socket.user.id &&
                    socket.user.role !== 'ADMIN'
                ) {
                    return cb ?.({ success: false, message: 'Not authorized to unsend' });
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

                io.to(`group:${groupId}`).emit('group:message_unsent', {
                    messageId,
                    message: updated,
                });
                cb ?.({ success: true, message: updated });
            } catch (err) {
                cb ?.({ success: false, message: 'Failed to unsend message' });
            }
        });

        // --- 1-on-1 Direct Chat Events ---
        socket.on('direct:join', async({ chatId }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id && socket.user.role !== 'ADMIN')) {
                    return cb ?.({ success: false, message: 'Not authorized for this chat' });
                }
                socket.join(`direct:${chatId}`);
                cb ?.({ success: true });
            } catch {
                cb ?.({ success: false, message: 'Failed to join chat room' });
            }
        });

        socket.on('direct:message', async({ chatId, content }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id)) {
                    return cb ?.({ success: false, message: 'Not authorized' });
                }
                if (!content || !content.trim()) {
                    return cb ?.({ success: false, message: 'Message cannot be empty' });
                }

                const message = await prisma.directMessage.create({
                    data: {
                        chatId,
                        senderId: socket.user.id,
                        content: content.trim(),
                    },
                    include: {
                        sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
                    },
                });

                await prisma.directChat.update({
                    where: { id: chatId },
                    data: { updatedAt: new Date() },
                });

                io.to(`direct:${chatId}`).emit('direct:message', message);

                // Also notify recipient if they are in their personal room
                const recipientId = chat.user1Id === socket.user.id ? chat.user2Id : chat.user1Id;
                io.to(`user:${recipientId}`).emit('direct:notification', {
                    chatId,
                    message,
                });

                cb ?.({ success: true, message });
            } catch (err) {
                cb ?.({ success: false, message: 'Failed to send message' });
            }
        });

        socket.on('direct:unsend', async({ chatId, messageId }, cb) => {
            try {
                const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
                if (!msg || msg.chatId !== chatId) {
                    return cb ?.({ success: false, message: 'Message not found' });
                }
                if (msg.senderId !== socket.user.id && socket.user.role !== 'ADMIN') {
                    return cb ?.({ success: false, message: 'You can only unsend your own messages' });
                }

                const updated = await prisma.directMessage.update({
                    where: { id: messageId },
                    data: {
                        isUnsent: true,
                        unsentAt: new Date(),
                        content: 'This message was unsent',
                    },
                    include: {
                        sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
                    },
                });

                io.to(`direct:${chatId}`).emit('direct:message_unsent', {
                    messageId,
                    message: updated,
                });
                cb ?.({ success: true, message: updated });
            } catch (err) {
                cb ?.({ success: false, message: 'Failed to unsend message' });
            }
        });

        socket.on('disconnect', () => {});
    });
};