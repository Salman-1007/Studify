import axios from 'axios';
import { getSecureItem, setSecureItem, removeSecureItem } from '../utils/storage';

export const BACKEND_URL = 'https://studify-dcq6.onrender.com/api';
export const SOCKET_URL = 'https://studify-dcq6.onrender.com';

export const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach secure access token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getSecureItem('studify_access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Best-effort token attachment
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-refresh token interceptor
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await getSecureItem('studify_refresh_token');
        if (!storedRefreshToken) {
          processQueue(error, null);
          return Promise.reject(error);
        }

        const res = await axios.post(`${BACKEND_URL}/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const newAccessToken = res.data?.data?.accessToken;
        const newRefreshToken = res.data?.data?.refreshToken;

        if (newAccessToken) {
          await setSecureItem('studify_access_token', newAccessToken);
          if (newRefreshToken) {
            await setSecureItem('studify_refresh_token', newRefreshToken);
          }
          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await removeSecureItem('studify_access_token');
        await removeSecureItem('studify_refresh_token');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
