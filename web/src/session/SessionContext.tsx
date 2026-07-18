import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SessionUser } from "@docket/shared";
import { ApiError, authApi } from "@/lib/api";

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, inviteToken?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    authApi
      .me()
      .then((u) => {
        if (alive) setUser(u);
      })
      .catch((e: unknown) => {
        // 401 simply means "not logged in" — not an error to surface.
        if (!(e instanceof ApiError && e.status === 401) && alive) {
          setError("Could not reach the server.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const u = await authApi.login(email, password);
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string, inviteToken?: string) => {
    setError(null);
    const u = await authApi.register(email, name, password, inviteToken);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo<SessionState>(
    () => ({ user, loading, error, login, register, logout }),
    [user, loading, error, login, register, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Convenience for components that require an authenticated user. */
export function useAuthedUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error("Expected an authenticated user");
  return user;
}
