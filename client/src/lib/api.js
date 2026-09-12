import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

let accessToken = null;
export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true;
      try {
        refreshPromise ||= api.post('/auth/refresh');
        const res = await refreshPromise;
        refreshPromise = null;
        setAccessToken(res.data.data.accessToken);
        original.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
        return api(original);
      } catch (err) {
        refreshPromise = null;
        setAccessToken(null);
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export const SOCKET_URL = API_URL;
