import axios from 'axios';
import { serverStatus } from './serverStatus.js';

const API_URL =
    import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
    timeout: 18000, // 18s before network abort to capture cold starts
});

let accessToken = typeof window !== 'undefined' ? localStorage.getItem('studify_access_token') : null;
let refreshToken = typeof window !== 'undefined' ? localStorage.getItem('studify_refresh_token') : null;

export const setAccessToken = (token) => {
    accessToken = token;
    if (typeof window !== 'undefined') {
        if (token) {
            localStorage.setItem('studify_access_token', token);
        } else {
            localStorage.removeItem('studify_access_token');
        }
    }
};

export const setRefreshToken = (token) => {
    refreshToken = token;
    if (typeof window !== 'undefined') {
        if (token) {
            localStorage.setItem('studify_refresh_token', token);
        } else {
            localStorage.removeItem('studify_refresh_token');
        }
    }
};

export const getAccessToken = () => accessToken || (typeof window !== 'undefined' ? localStorage.getItem('studify_access_token') : null);
export const getRefreshToken = () => refreshToken || (typeof window !== 'undefined' ? localStorage.getItem('studify_refresh_token') : null);

// 1. Request Interceptor: Auth token & Cold Start timer detection
api.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Setup cold-start detection timer (>8000ms without response)
    const timerId = setTimeout(() => {
        serverStatus.startColdStart(config._retryCount || 1);
    }, 8000);

    config._coldStartTimer = timerId;
    return config;
});

// Helper for sleep/backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 2. Response Interceptor: Cold-Start Retry & 401 Token Refresh
let refreshPromise = null;

api.interceptors.response.use(
    (response) => {
        if (response.config?._coldStartTimer) {
            clearTimeout(response.config._coldStartTimer);
        }
        // Mark server successfully connected
        serverStatus.markConnected();
        return response;
    },
    async(error) => {
        const original = error.config;
        if (original?._coldStartTimer) {
            clearTimeout(original._coldStartTimer);
        }

        const isNetworkOrTimeout =
            error.code === 'ECONNABORTED' ||
            error.message?.includes('timeout') ||
            error.message?.includes('Network Error') ||
            !error.response;

        const isServerWaking =
            isNetworkOrTimeout ||
            (error.response && [502, 503, 504].includes(error.response.status));

        // Handle Render Cold-Start Retries (up to 3 times with exponential backoff)
        if (isServerWaking && original && !original._isRetryDisabled) {
            original._retryCount = original._retryCount || 0;

            if (original._retryCount < 3) {
                original._retryCount += 1;
                serverStatus.updateAttempt(original._retryCount);

                const backoffMs = Math.min(1500 * Math.pow(2, original._retryCount - 1), 6000);
                console.warn(
                    `[ColdStart Interceptor] Server unavailable (${error.message}). Retrying in ${backoffMs}ms (Attempt ${original._retryCount}/3)...`
                );
                await sleep(backoffMs);
                return api(original);
            } else {
                serverStatus.markFailed(
                    'Render instance is taking longer than usual to spin up. Please wait a moment and try again.'
                );
            }
        }

        // Handle 401 Session Token Refresh
        if (
            error.response?.status === 401 &&
            original &&
            !original._retry &&
            !original.url?.includes('/auth/')
        ) {
            original._retry = true;
            try {
                const storedRefresh = getRefreshToken();
                refreshPromise ||= api.post('/auth/refresh', storedRefresh ? { refreshToken: storedRefresh } : {});
                const res = await refreshPromise;
                refreshPromise = null;
                const newAccess = res.data.data.accessToken;
                const newRefresh = res.data.data.refreshToken;
                setAccessToken(newAccess);
                if (newRefresh) setRefreshToken(newRefresh);
                original.headers.Authorization = `Bearer ${newAccess}`;
                return api(original);
            } catch (err) {
                refreshPromise = null;
                setAccessToken(null);
                setRefreshToken(null);
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    }
);

export const SOCKET_URL = API_URL;
export default api;