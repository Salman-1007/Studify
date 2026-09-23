import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const refreshRes = await api.post('/auth/refresh');
      setAccessToken(refreshRes.data.data.accessToken);
      const meRes = await api.get('/auth/me');
      setUser(meRes.data.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
    return res.data.data;
  };

  const signup = async (payload) => {
    const res = await api.post('/auth/signup', payload);
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
    return res.data.data;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
    return res.data.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
