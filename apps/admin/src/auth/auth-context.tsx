import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AuthUserDto } from '@virtual-mandi/shared';
import { AdminApiError, adminApi } from '../api/client';

type AuthValue = {
  loading: boolean;
  user?: AuthUserDto;
  error?: string;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthValue | undefined>(undefined);
const safeError = (error: unknown) =>
  error instanceof AdminApiError ? error.message : 'Network request failed. Please try again.';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUserDto>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    adminApi.refresh().then((valid) => {
      if (!valid) sessionStorage.removeItem('virtual-mandi.admin.refresh-token');
      setLoading(false);
    });
  }, []);
  const value = useMemo<AuthValue>(
    () => ({
      loading,
      user,
      error,
      login: async (email, password) => {
        setError(undefined);
        try {
          const response = await adminApi.login(email, password);
          if (response.user.role !== 'ADMIN') {
            await adminApi.logout();
            throw new Error('Administrator access required');
          }
          setUser(response.user);
        } catch (reason) {
          const message = safeError(reason);
          setError(message);
          throw reason;
        }
      },
      logout: async () => {
        await adminApi.logout();
        setUser(undefined);
      },
    }),
    [error, loading, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAdminAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAdminAuth must be used inside AuthProvider');
  return value;
};
