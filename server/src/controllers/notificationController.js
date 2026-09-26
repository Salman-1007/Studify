import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  ok(res, { notifications });
});

export const markRead = asyncHandler(async (req, res) => {
  const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notif || notif.userId !== req.user.id) throw new ApiError(404, 'Notification not found');
  const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  ok(res, { notification: updated });
});

export const registerPushToken = asyncHandler(async (req, res) => {
  const { token, platform = 'android' } = req.body;
  if (!token) throw new ApiError(400, 'Push token is required');

  await prisma.notification.create({
    data: {
      userId: req.user.id,
      type: 'PUSH_TOKEN_REGISTERED',
      message: JSON.stringify({ token, platform, registeredAt: new Date() }),
      isRead: true,
    },
  });

  ok(res, { registered: true, platform });
});
