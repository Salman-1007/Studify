import { verifyAccessToken } from '../utils/tokens.js';
import { prisma } from '../config/db.js';

export const registerGroupChat = (io) => {
  io.use(async (socket, next) => {
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
    socket.on('group:join', async ({ groupId }, cb) => {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: socket.user.id } },
      });
      if (!membership) return cb?.({ success: false, message: 'Not a member of this group' });
      socket.join(`group:${groupId}`);
      cb?.({ success: true });
    });

    socket.on('group:message', async ({ groupId, content }, cb) => {
      try {
        const membership = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId: socket.user.id } },
        });
        if (!membership) return cb?.({ success: false, message: 'Not a member of this group' });
        if (!content || !content.trim()) return cb?.({ success: false, message: 'Empty message' });

        const message = await prisma.groupMessage.create({
          data: { groupId, senderId: socket.user.id, content: content.trim() },
          include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        });
        io.to(`group:${groupId}`).emit('group:message', message);
        cb?.({ success: true, message });
      } catch (err) {
        cb?.({ success: false, message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {});
  });
};
