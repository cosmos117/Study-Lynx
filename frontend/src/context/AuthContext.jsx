import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI } from '../services/api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'study_planner_token';
const USER_KEY = 'study_planner_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    authAPI.me()
      .then(({ data }) => {
        setUser(data.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const authenticate = (result) => {
    const { token: nextToken, user: nextUser } = result;
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const login = async (payload) => {
    const { data } = await authAPI.login(payload);
    authenticate(data.data);
  };

  const register = async (payload) => {
    const { data } = await authAPI.register(payload);
    authenticate(data.data);
  };

  const loginWithGoogle = async (credential) => {
    const { data } = await authAPI.google(credential);
    authenticate(data.data);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, loginWithGoogle, logout }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
