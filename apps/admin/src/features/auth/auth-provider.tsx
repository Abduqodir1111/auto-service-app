import { AuthPayload, UserRole } from '@stomvp/shared';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AUTH_CHANGED_EVENT, AUTH_STORAGE_KEY, http } from '../../api/http';

type AuthContextValue = {
  auth: AuthPayload | null;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  const auth = raw ? (JSON.parse(raw) as Partial<AuthPayload>) : null;

  if (auth && (!auth.accessToken || !auth.refreshToken || !auth.user)) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }

  return auth ? (auth as AuthPayload) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<AuthPayload | null>(() => readStoredAuth());

  useEffect(() => {
    const syncAuth = () => setAuth(readStoredAuth());

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

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
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
        setAuth(data);
      },
      async logout() {
        const refreshToken = readStoredAuth()?.refreshToken;
        if (refreshToken) {
          await http.post('/auth/logout', { refreshToken }).catch(() => undefined);
        }
        localStorage.removeItem(AUTH_STORAGE_KEY);
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
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
