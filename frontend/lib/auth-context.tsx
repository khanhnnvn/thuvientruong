"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, clearAccessToken, getAccessToken, setAccessToken } from "./api";
import type { User } from "./types";

const SESSION_COOKIE = "lib_session";

function setSessionCookie() {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 7; // 7 ngày, khớp thời hạn refresh token
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${maxAge}; samesite=lax`;
}

function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<User>("/me");
      setUser(me);
      setSessionCookie();
    } catch {
      setUser(null);
      clearAccessToken();
      clearSessionCookie();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
      skipRefresh: true,
    });
    setAccessToken(data.access_token);
    setSessionCookie();
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore network/logout errors, still clear client state
    }
    clearAccessToken();
    clearSessionCookie();
    setUser(null);
    if (typeof window !== "undefined") {
      // Full reload (not router.push) on purpose: clears all in-memory client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng bên trong AuthProvider");
  return ctx;
}
