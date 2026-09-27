import { verifyAccessToken } from '../utils/tokens.js';
import { prisma } from '../config/db.js';

export const registerGroupChat = (io) => {
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

    io.on('connection', (socket) => {
        // Join personal room for notifications
        socket.join(`user:${socket.user.id}`);

        // --- Study Group Events ---
        socket.on('group:join', async({ groupId }, cb) => {
            const membership = await prisma.groupMember.findUnique({
                where: { groupId_userId: { groupId, userId: socket.user.id } },
            });
            if (!membership) {
                if (typeof cb === 'function') cb({ success: false, message: 'Not a member of this group' });
                return;
            }
            socket.join(`group:${groupId}`);
            if (typeof cb === 'function') cb({ success: true });
        });

        socket.on('group:message', async({ groupId, content }, cb) => {
            try {
                const membership = await prisma.groupMember.findUnique({
                    where: { groupId_userId: { groupId, userId: socket.user.id } },
                });
                if (!membership) {
                    if (typeof cb === 'function') cb({ success: false, message: 'Not a member of this group' });
                    return;
                }
                if (!content || !content.trim()) {
                    if (typeof cb === 'function') cb({ success: false, message: 'Empty message' });
                    return;
                }

                const message = await prisma.groupMessage.create({
                    data: { groupId, senderId: socket.user.id, content: content.trim() },
                    include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
                });
                io.to(`group:${groupId}`).emit('group:message', message);
                if (typeof cb === 'function') cb({ success: true, message });
            } catch (err) {
                if (typeof cb === 'function') cb({ success: false, message: 'Failed to send message' });
            }
        });

        socket.on('group:unsend', async({ groupId, messageId }, cb) => {
            try {
                const msg = await prisma.groupMessage.findUnique({
                    where: { id: messageId },
                    include: { group: true },
                });
                if (!msg || msg.groupId !== groupId) {
                    if (typeof cb === 'function') cb({ success: false, message: 'Message not found' });
                    return;
                }
                if (
                    msg.senderId !== socket.user.id &&
                    msg.group.ownerId !== socket.user.id &&
                    socket.user.role !== 'ADMIN'
                ) {
                    if (typeof cb === 'function') cb({ success: false, message: 'Not authorized to unsend' });
                    return;
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
                if (typeof cb === 'function') cb({ success: true, message: updated });
            } catch (err) {
                if (typeof cb === 'function') cb({ success: false, message: 'Failed to unsend message' });
            }
        });

        // --- 1-on-1 Direct Chat Events ---
        socket.on('direct:join', async({ chatId }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id && socket.user.role !== 'ADMIN')) {
                    if (typeof cb === 'function') cb({ success: false, message: 'Not authorized for this chat' });
                    return;
                }
                socket.join(`direct:${chatId}`);
                if (typeof cb === 'function') cb({ success: true });
            } catch {
                if (typeof cb === 'function') cb({ success: false, message: 'Failed to join chat room' });
            }
        });

        socket.on('direct:message', async({ chatId, content }, cb) => {
            try {
                const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
                if (!chat || (chat.user1Id !== socket.user.id && chat.user2Id !== socket.user.id)) {
                    if (typeof cb === 'function') cb({ success: false, message: 'Not authorized' });
                    return;
                }
                if (!content || !content.trim()) {
                    if (typeof cb === 'function') cb({ success: false, message: 'Message cannot be empty' });
                    return;
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

                if (typeof cb === 'function') cb({ success: true, message });
            } catch (err) {
                if (typeof cb === 'function') cb({ success: false, message: 'Failed to send message' });
            }
        });

        socket.on('direct:unsend', async({ chatId, messageId }, cb) => {
            try {
                const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
                if (!msg || msg.chatId !== chatId) {
                    if (typeof cb === 'function') cb({ success: false, message: 'Message not found' });
                    return;
                }
                if (msg.senderId !== socket.user.id && socket.user.role !== 'ADMIN') {
                    if (typeof cb === 'function') cb({ success: false, message: 'You can only unsend your own messages' });
                    return;
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
                if (typeof cb === 'function') cb({ success: true, message: updated });
            } catch (err) {
                if (typeof cb === 'function') cb({ success: false, message: 'Failed to unsend message' });
            }
        });

        socket.on('disconnect', () => {});
    });
};