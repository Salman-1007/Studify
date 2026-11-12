import { prisma } from '../config/db.js';

let ioRef = null;

export const setNotificationIo = (io) => {
  ioRef = io;
};

export const getSocketIo = () => ioRef;

/**
 * Persist an in-app notification with optional deduplication and live socket push.
 */
export const createNotification = async ({
  userId,
  type,
  title = null,
  message,
  link = null,
  metadata = null,
  dedupeKey = null,
}) => {
  if (!userId || !message) return null;

  if (dedupeKey) {
    const existing = await prisma.notification.findFirst({
      where: { userId, dedupeKey },
    });
    if (existing) return existing;
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link,
      metadata: metadata ?? undefined,
      dedupeKey,
    },
  });

  if (ioRef) {
    ioRef.to(`user:${userId}`).emit('notification:new', notification);
  }

  return notification;
};

export const notifyUsers = async (userIds, payloadBuilder) => {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const results = [];
  for (const userId of uniqueIds) {
    const payload = typeof payloadBuilder === 'function' ? payloadBuilder(userId) : payloadBuilder;
    const n = await createNotification({ userId, ...payload });
    if (n) results.push(n);
  }
  return results;
};
