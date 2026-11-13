import { prisma } from '../config/db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Validates whether a token is a plausible Expo push token.
 */
export const isExpoPushToken = (token) => {
  return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[') || token.length > 10);
};

/**
 * Register or update an Expo push token for an authenticated user.
 */
export const registerPushToken = async (userId, token, platform = 'android') => {
  if (!userId || !token) {
    throw new Error('User ID and push token are required');
  }

  const normalizedPlatform = (platform || 'android').toLowerCase() === 'ios' ? 'ios' : 'android';

  const existing = await prisma.pushToken.findUnique({
    where: { token },
  });

  if (existing) {
    return prisma.pushToken.update({
      where: { token },
      data: {
        userId,
        platform: normalizedPlatform,
        updatedAt: new Date(),
      },
    });
  }

  return prisma.pushToken.create({
    data: {
      userId,
      token,
      platform: normalizedPlatform,
    },
  });
};

/**
 * Remove an Expo push token (e.g. on logout or permissions revoked).
 */
export const removePushToken = async (token) => {
  if (!token) return { count: 0 };
  try {
    return await prisma.pushToken.deleteMany({
      where: { token },
    });
  } catch (err) {
    console.error('[PushService] Error removing push token:', err.message);
    return { count: 0 };
  }
};

/**
 * Dispatches an array of Expo push messages to the Expo HTTP push gateway.
 */
const sendExpoChunks = async (messages) => {
  if (!messages || messages.length === 0) return [];

  const results = [];
  const chunkSize = 100;

  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.warn(`[PushService] Expo Push API responded with status ${response.status}`);
        continue;
      }

      const resData = await response.json();
      const tickets = resData?.data || [];
      results.push(...tickets);

      // Handle DeviceNotRegistered errors by pruning invalid tokens
      tickets.forEach(async (ticket, idx) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const badToken = chunk[idx]?.to;
          if (badToken) {
            console.log(`[PushService] Removing unregistered push token: ${badToken}`);
            await removePushToken(badToken).catch(() => {});
          }
        }
      });
    } catch (err) {
      console.error('[PushService] Failed to deliver Expo push batch:', err.message);
    }
  }

  return results;
};

/**
 * Send a push notification and create an AppNotification record for a single user.
 */
export const sendPushToUser = async (userId, { title, body, type = 'ANNOUNCEMENT', data = {} }) => {
  if (!userId || !body) return null;

  // 1. Create AppNotification record for deep-linking & history
  let appNotif = null;
  try {
    appNotif = await prisma.appNotification.create({
      data: {
        userId,
        title: title || 'Studify',
        body,
        type,
        data: data || {},
        isRead: false,
      },
    });
  } catch (err) {
    console.warn('[PushService] Could not persist AppNotification:', err.message);
  }

  // 2. Lookup registered device push tokens for user
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
  });

  if (!tokens || tokens.length === 0) {
    return { appNotification: appNotif, dispatched: 0 };
  }

  // 3. Format message payload with Android channel and priority settings
  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: title || 'Studify',
    body,
    channelId: 'default',
    priority: 'high',
    _displayInForeground: true,
    data: {
      type,
      ...(data || {}),
      notificationId: appNotif?.id,
    },
  }));

  const tickets = await sendExpoChunks(messages);

  return {
    appNotification: appNotif,
    dispatched: messages.length,
    tickets,
  };
};

/**
 * Send push notifications and persist AppNotification records for multiple users.
 */
export const sendPushToUsers = async (userIds, { title, body, type = 'ANNOUNCEMENT', data = {} }) => {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const results = [];
  for (const uid of uniqueIds) {
    try {
      const res = await sendPushToUser(uid, { title, body, type, data });
      results.push(res);
    } catch (err) {
      console.error(`[PushService] Push error for user ${uid}:`, err.message);
    }
  }
  return results;
};
