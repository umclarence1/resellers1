import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setAuthToken, setStoredUser } from './api';

interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'admin' | 'dealer' | 'reseller';
  status: string;
  resellerStore?: {
    storeName: string;
    slug: string;
  };
}

interface LoginResult {
  requiresOtp: boolean;
  email?: string;
  role?: string;
  token?: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role?: string) => Promise<LoginResult>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearSession = () => {
  setAuthToken(null);
  setStoredUser(null);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      clearSession();
      setUserState(null);
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        setStoredUser(res.data.data);
        setUserState(res.data.data);
      })
      .catch(() => {
        clearSession();
        setUserState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, role?: string) => {
    const { data } = await api.post('/auth/login', { email, password, role });
    const result = data.data as LoginResult;
    if (!result.requiresOtp && result.token && result.user) {
      setAuthToken(result.token);
      setStoredUser(result.user);
      setUserState(result.user);
    }
    return result;
  };

  const verifyOtp = async (email: string, otp: string) => {
    const { data } = await api.post('/auth/verify-otp', { email, otp });
    setAuthToken(data.data.token);
    setStoredUser(data.data.user);
    setUserState(data.data.user);
  };

  const logout = () => {
    clearSession();
    setUserState(null);
  };

  const setUser = (u: User | null) => {
    setStoredUser(u);
    setUserState(u);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyOtp, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
