import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken, setRefreshToken, getAccessToken, getRefreshToken } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Initialize user from localStorage for instant, non-flickering UI render on refresh
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('studify_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const saveUserSession = (userData, accessToken, refreshToken) => {
    if (accessToken) setAccessToken(accessToken);
    if (refreshToken) setRefreshToken(refreshToken);
    if (userData) {
      setUser(userData);
      try {
        localStorage.setItem('studify_user', JSON.stringify(userData));
      } catch (e) {
        console.error('Failed to cache user', e);
      }
    }
  };

  const clearUserSession = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    try {
      localStorage.removeItem('studify_user');
    } catch (e) {
      console.error('Failed to clear user', e);
    }
  };

  const bootstrap = useCallback(async () => {
    const existingToken = getAccessToken();
    const existingRefresh = getRefreshToken();

    // If we have an existing access token, verify and fetch latest user info
    if (existingToken) {
      try {
        const meRes = await api.get('/auth/me');
        saveUserSession(meRes.data.data.user, existingToken, existingRefresh);
        setLoading(false);
        return;
      } catch (err) {
        // Access token might be expired, attempt refresh next
        console.warn('[Auth Bootstrap] Access token verification failed, attempting token refresh...', err.message);
      }
    }

    // Attempt refresh if refresh token or cookie exists
    try {
      const refreshRes = await api.post('/auth/refresh', existingRefresh ? { refreshToken: existingRefresh } : {});
      const newAccess = refreshRes.data.data.accessToken;
      const newRefresh = refreshRes.data.data.refreshToken || existingRefresh;
      setAccessToken(newAccess);
      if (newRefresh) setRefreshToken(newRefresh);

      const meRes = await api.get('/auth/me');
      saveUserSession(meRes.data.data.user, newAccess, newRefresh);
    } catch (err) {
      console.warn('[Auth Bootstrap] Session restore failed:', err.message);
      clearUserSession();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    const { user: userData, accessToken, refreshToken } = res.data.data;
    saveUserSession(userData, accessToken, refreshToken);
    return res.data.data;
  };

  const signup = async (payload) => {
    const res = await api.post('/auth/signup', payload);
    const { user: userData, accessToken, refreshToken } = res.data.data;
    saveUserSession(userData, accessToken, refreshToken);
    return res.data.data;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    const { user: userData, accessToken, refreshToken } = res.data.data;
    saveUserSession(userData, accessToken, refreshToken);
    return res.data.data;
  };

  const logout = async () => {
    try {
      const existingRefresh = getRefreshToken();
      await api.post('/auth/logout', existingRefresh ? { refreshToken: existingRefresh } : {});
    } catch (e) {
      console.warn('Logout request failed:', e.message);
    } finally {
      clearUserSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
