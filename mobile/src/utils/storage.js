import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isSecureStoreAvailable = async () => {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

/**
 * Securely store authentication tokens (Access Token, Refresh Token)
 */
export const setSecureItem = async (key, value) => {
  try {
    const available = await isSecureStoreAvailable();
    if (available) {
      await SecureStore.setItemAsync(key, String(value));
    } else {
      await AsyncStorage.setItem(`@secure_${key}`, String(value));
    }
  } catch (err) {
    console.warn(`[Storage] Failed to securely write ${key}:`, err.message);
    await AsyncStorage.setItem(`@secure_${key}`, String(value)).catch(() => {});
  }
};

/**
 * Retrieve securely stored authentication tokens
 */
export const getSecureItem = async (key) => {
  try {
    const available = await isSecureStoreAvailable();
    if (available) {
      const val = await SecureStore.getItemAsync(key);
      if (val !== null && val !== undefined) return val;
    }
    return await AsyncStorage.getItem(`@secure_${key}`);
  } catch (err) {
    console.warn(`[Storage] Failed to securely read ${key}:`, err.message);
    return await AsyncStorage.getItem(`@secure_${key}`).catch(() => null);
  }
};

/**
 * Remove securely stored authentication tokens
 */
export const removeSecureItem = async (key) => {
  try {
    const available = await isSecureStoreAvailable();
    if (available) {
      await SecureStore.deleteItemAsync(key).catch(() => {});
    }
    await AsyncStorage.removeItem(`@secure_${key}`).catch(() => {});
  } catch (err) {
    console.warn(`[Storage] Failed to remove ${key}:`, err.message);
  }
};

/**
 * Standard Storage for non-sensitive data (user profile, preferences)
 */
export const setItem = async (key, value) => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  await AsyncStorage.setItem(key, serialized);
};

export const getItem = async (key) => {
  const val = await AsyncStorage.getItem(key);
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

export const removeItem = async (key) => {
  await AsyncStorage.removeItem(key);
};
