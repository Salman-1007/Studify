import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from '../api/client';
import { getItem, setItem, removeItem } from '../utils/storage';

// Configure notification presentation when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure Android notification channels for standalone sideloaded APKs.
 * Uses MAX importance and custom vibration patterns to guarantee receipt.
 */
export const setupNotificationChannels = async () => {
  if (Platform.OS === 'android') {
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
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    if (typeof onNotificationReceived === 'function') {
      onNotificationReceived(notification);
    }
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data;
    if (typeof onNotificationResponse === 'function') {
      onNotificationResponse(data);
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
};
