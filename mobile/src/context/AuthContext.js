import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  setItem,
  getItem,
  removeItem,
} from '../utils/storage';
import {
  registerForPushNotificationsAsync,
  unregisterPushNotificationsAsync,
} from '../services/notifications';

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isTeacher: false,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const bootstrapAuth = useCallback(async () => {
    try {
      const storedToken = await getSecureItem('studify_access_token');
      const storedUser = await getItem('studify_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);

        // Fetch fresh profile in background
        apiClient
          .get('/auth/me')
          .then(async (res) => {
            const freshUser = res.data?.data?.user;
            if (freshUser) {
              setUser(freshUser);
              await setItem('studify_user', freshUser);
            }
          })
          .catch(() => {});

        // Re-sync push notification token
        registerForPushNotificationsAsync();
      }
    } catch (err) {
      console.warn('[AuthContext] Bootstrap error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrapAuth();
  }, [bootstrapAuth]);

  const login = async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const { user: authedUser, accessToken, refreshToken } = res.data?.data || {};

    if (accessToken) {
      await setSecureItem('studify_access_token', accessToken);
      if (refreshToken) {
        await setSecureItem('studify_refresh_token', refreshToken);
      }
      await setItem('studify_user', authedUser);

      setToken(accessToken);
      setUser(authedUser);

      // Register device for push notifications
      registerForPushNotificationsAsync();
    }

    return authedUser;
  };

  const signup = async (payload) => {
    const res = await apiClient.post('/auth/signup', payload);
    const { user: newUser, accessToken, refreshToken } = res.data?.data || {};

    if (accessToken) {
      await setSecureItem('studify_access_token', accessToken);
      if (refreshToken) {
        await setSecureItem('studify_refresh_token', refreshToken);
      }
      await setItem('studify_user', newUser);

      setToken(accessToken);
      setUser(newUser);

      registerForPushNotificationsAsync();
    }

    return newUser;
  };

  const logout = async () => {
    try {
      await unregisterPushNotificationsAsync();
      await apiClient.post('/auth/logout').catch(() => {});
    } catch {
      // Best-effort remote logout
    } finally {
      await removeSecureItem('studify_access_token');
      await removeSecureItem('studify_refresh_token');
      await removeItem('studify_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const res = await apiClient.get('/auth/me');
      const freshUser = res.data?.data?.user;
      if (freshUser) {
        setUser(freshUser);
        await setItem('studify_user', freshUser);
      }
      return freshUser;
    } catch (err) {
      console.warn('[AuthContext] Refresh profile failed:', err.message);
      return null;
    }
  };

  const isTeacher = Boolean(
    user &&
      (user.role === 'TEACHER' || user.teacherStatus === 'APPROVED')
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isTeacher,
        loading,
        login,
        signup,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
