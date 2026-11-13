import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from '../api/client';
import { getItem, setItem, removeItem } from '../utils/storage';

// Configure notification presentation when app is foregrounded
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (err) {
  console.warn('[Notifications] setNotificationHandler initialization notice:', err?.message || err);
}

/**
 * Configure Android notification channels for standalone sideloaded APKs.
 * Uses MAX importance and custom vibration patterns to guarantee receipt.
 */
export const setupNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Studify Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        sound: 'default',
      });
    } catch (chanErr) {
      console.warn('[Notifications] Channel setup notice:', chanErr?.message || chanErr);
    }
  }
};

/**
 * Registers device for push notifications and registers token with Studify backend.
 */
export const registerForPushNotificationsAsync = async () => {
  let token = null;

  try {
    await setupNotificationChannels();

    if (!Device.isDevice) {
      console.log('[Notifications] Physical device required for remote push notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Push notification permissions denied');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    token = pushTokenData?.data;

    if (token) {
      await setItem('studify_push_token', token);

      // Register with Studify backend API
      await apiClient
        .post('/notifications/push-token', {
          token,
          platform: Platform.OS,
        })
        .catch((err) => {
          console.warn('[Notifications] Failed to sync push token with backend:', err.message);
        });

      console.log('[Notifications] Registered Expo Push Token:', token);
    }
  } catch (err) {
    console.warn('[Notifications] Error in push registration:', err.message);
  }

  return token;
};

/**
 * De-registers device push token from backend (e.g. on user logout).
 */
export const unregisterPushNotificationsAsync = async () => {
  try {
    const token = await getItem('studify_push_token');
    if (token) {
      await apiClient
        .delete(`/notifications/push-token/${encodeURIComponent(token)}`)
        .catch(() => {});
      await removeItem('studify_push_token');
    }
  } catch (err) {
    console.warn('[Notifications] Error unregistering push token:', err.message);
  }
};

/**
 * Attaches notification listeners for deep linking.
 */
export const attachNotificationListeners = ({ onNotificationReceived, onNotificationResponse }) => {
  let receivedSub = null;
  let responseSub = null;

  try {
    receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      if (typeof onNotificationReceived === 'function') {
        onNotificationReceived(notification);
      }
    });
  } catch (err) {
    console.warn('[Notifications] Error attaching received listener:', err?.message || err);
  }

  try {
    responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (typeof onNotificationResponse === 'function') {
        onNotificationResponse(data);
      }
    });
  } catch (err) {
    console.warn('[Notifications] Error attaching response listener:', err?.message || err);
  }

  return () => {
    try {
      receivedSub?.remove?.();
      responseSub?.remove?.();
    } catch {
      // Safe cleanup
    }
  };
};
