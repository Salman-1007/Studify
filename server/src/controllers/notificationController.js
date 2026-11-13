import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { registerPushToken, removePushToken, sendPushToUser } from '../services/pushService.js';

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

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  ok(res, { count: result.count, message: 'All notifications marked as read' });
});

// Mobile Push Token Registration
export const registerToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  if (!token) throw new ApiError(400, 'Push token is required');

  const record = await registerPushToken(req.user.id, token, platform || 'android');
  ok(res, { pushToken: record, message: 'Push token registered successfully' });
});

// Mobile Push Token De-registration
export const deleteToken = asyncHandler(async (req, res) => {
  const token = req.params.token || req.body?.token;
  if (!token) throw new ApiError(400, 'Push token is required');

  await removePushToken(token);
  ok(res, { message: 'Push token removed successfully' });
});

// App Notifications for mobile / deep-linking
export const listAppNotifications = asyncHandler(async (req, res) => {
  const notifications = await prisma.appNotification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  ok(res, { notifications });
});

export const markAppNotificationRead = asyncHandler(async (req, res) => {
  const notif = await prisma.appNotification.findUnique({ where: { id: req.params.id } });
  if (!notif || notif.userId !== req.user.id) throw new ApiError(404, 'Notification not found');
  const updated = await prisma.appNotification.update({ where: { id: req.params.id }, data: { isRead: true } });
  ok(res, { notification: updated });
});

export const markAllAppNotificationsRead = asyncHandler(async (req, res) => {
  const result = await prisma.appNotification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  ok(res, { count: result.count, message: 'All app notifications marked as read' });
});

// Trigger a Test Push Notification to verify device reception
export const testPushNotification = asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  const result = await sendPushToUser(req.user.id, {
    title: title || 'Studify Test Notification',
    body: body || 'This is a live test notification from Studify APK push engine! 🚀',
    type: 'ANNOUNCEMENT',
    data: { screen: 'Dashboard', timestamp: Date.now() },
  });
  ok(res, { result, message: 'Test push notification dispatched' });
});
