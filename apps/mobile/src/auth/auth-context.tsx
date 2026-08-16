import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AuthUserDto, RegisterInput } from '@virtual-mandi/shared';
import { ApiError, apiClient } from '../api/client';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';
type AuthContextValue = {
  status: AuthStatus;
  user?: AuthUserDto;
  error?: string;
  login(input: RegisterInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
  clearError(): void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const messageFor = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Network request failed. Please try again.';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUserDto>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    apiClient.refresh().then((signedIn) => setStatus(signedIn ? 'signed-in' : 'signed-out'));
  }, []);

  const authenticate = async (action: () => Promise<{ user: AuthUserDto }>) => {
    setError(undefined);
    try {
      const response = await action();
      setUser(response.user);
      setStatus('signed-in');
    } catch (reason) {
      setError(messageFor(reason));
      throw reason;
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      login: (input) => authenticate(() => apiClient.login(input)),
      register: (input) => authenticate(() => apiClient.register(input)),
      logout: async () => {
        await apiClient.logout();
        setUser(undefined);
        setStatus('signed-out');
      },
      clearError: () => setError(undefined),
    }),
    [error, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
};
