import { AuthPayload, UserRole } from '@stomvp/shared';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';
import { AUTH_STORAGE_KEY, http } from '../../api/http';

type AuthContextValue = {
  auth: AuthPayload | null;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthPayload) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<AuthPayload | null>(() => readStoredAuth());

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      isAuthenticated: Boolean(auth?.accessToken),
      async login(phone, password) {
        const { data } = await http.post<AuthPayload>('/auth/login', {
          phone,
          password,
        });

        if (data.user.role !== UserRole.ADMIN) {
          throw new Error('Доступ к админке разрешён только администраторам');
        }

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
        setAuth(data);
      },
      logout() {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuth(null);
      },
    }),
    [auth],
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
