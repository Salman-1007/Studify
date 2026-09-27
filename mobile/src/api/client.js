import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Production Render backend or local development fallback
const BACKEND_URL =
  Platform.OS === 'android'
    ? 'https://studify-dcq6.onrender.com/api'
    : 'https://studify-dcq6.onrender.com/api';

export const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token from AsyncStorage
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('studify_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const storedRefreshToken = await AsyncStorage.getItem('studify_refresh_token');
        if (!storedRefreshToken) return Promise.reject(error);

        const res = await axios.post(`${BACKEND_URL}/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const newAccessToken = res.data?.data?.accessToken;
        const newRefreshToken = res.data?.data?.refreshToken;

        if (newAccessToken) {
          await AsyncStorage.setItem('studify_access_token', newAccessToken);
          if (newRefreshToken) {
            await AsyncStorage.setItem('studify_refresh_token', newRefreshToken);
          }
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        await AsyncStorage.multiRemove(['studify_access_token', 'studify_refresh_token', 'studify_user']);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
