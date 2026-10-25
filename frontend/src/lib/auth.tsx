import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, authApi } from "./api";
import type { AuthConfig, AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  config: AuthConfig | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<AuthUser>;
  loginWithDemo: () => Promise<AuthUser>;
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await authApi.me();
      // A demo-fallback response means no real session exists.
      if (data.isDemo) {
        setUser(null);
        return null;
      }
      setUser(data.user);
      return data.user;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.warn("Could not load the current session:", error);
      }
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const [nextConfig] = await Promise.allSettled([
        authApi.config(),
        refresh(),
      ]);

      if (!active) return;
      if (nextConfig.status === "fulfilled") setConfig(nextConfig.value);
      setLoading(false);
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await authApi.register({ name, email, password });
      setUser(data.user);
      return data.user;
    },
    []
  );

  const loginWithDemo = useCallback(async () => {
    const data = await authApi.demo();
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const data = await authApi.google(credential);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((next: AuthUser) => {
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({
      user,
      config,
      loading,
      refresh,
      login,
      register,
      loginWithDemo,
      loginWithGoogle,
      logout,
      updateUser,
    }),
    [
      user,
      config,
      loading,
      refresh,
      login,
      register,
      loginWithDemo,
      loginWithGoogle,
      logout,
      updateUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
