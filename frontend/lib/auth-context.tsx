"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  apiFetchSuperAdmin,
  apiFetchTenant,
  clearSuperAdminAccessToken,
  clearTenantAccessToken,
  getSuperAdminAccessToken,
  getTenantAccessToken,
  setSuperAdminAccessToken,
  setTenantAccessToken,
} from "./api";
import type { User } from "./types";

// Two independent cookies so proxy.ts can distinguish a school-scoped session
// (must match the :slug in the URL) from a super_admin session.
const TENANT_SESSION_COOKIE = "lib_session"; // value = the slug the session belongs to
const SUPER_ADMIN_SESSION_COOKIE = "sa_session"; // value = "1"

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 7; // 7 ngày, khớp thời hạn refresh token
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

/* ------------------------------------------------------------------ */
/* Tenant auth (a user logged into one school, under /:slug/...)       */
/* ------------------------------------------------------------------ */

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!slug) {
      setUser(null);
      setLoading(false);
      return;
    }
    if (!getTenantAccessToken(slug)) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetchTenant<User>(slug, "/me");
      setUser(me);
      setCookie(TENANT_SESSION_COOKIE, slug);
    } catch {
      setUser(null);
      clearTenantAccessToken();
      clearCookie(TENANT_SESSION_COOKIE);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetchTenant<{ access_token: string; user: User }>(slug, "/auth/login", {
        method: "POST",
        body: { email, password },
        skipAuth: true,
        skipRefresh: true,
      });
      setTenantAccessToken(slug, data.access_token);
      setCookie(TENANT_SESSION_COOKIE, slug);
      setUser(data.user);
      return data.user;
    },
    [slug]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetchTenant(slug, "/auth/logout", { method: "POST" });
    } catch {
      // ignore network/logout errors, still clear client state
    }
    clearTenantAccessToken();
    clearCookie(TENANT_SESSION_COOKIE);
    setUser(null);
    if (typeof window !== "undefined") {
      // Full reload (not router.push) on purpose: clears all in-memory client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/${slug}/login`;
    }
  }, [slug]);

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

/* ------------------------------------------------------------------ */
/* Super admin auth (system-wide, not tied to any school)              */
/* ------------------------------------------------------------------ */

export interface SuperAdminUser {
  id: string;
  email: string;
  full_name?: string;
  [key: string]: unknown;
}

interface SuperAdminAuthContextValue {
  user: SuperAdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SuperAdminUser>;
  logout: () => void;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextValue | undefined>(undefined);

export function SuperAdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SuperAdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getSuperAdminAccessToken();
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem("sa_user") : null;
    if (token && raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetchSuperAdmin<{ access_token: string; user: SuperAdminUser }>("/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
      skipRefresh: true,
    });
    setSuperAdminAccessToken(data.access_token);
    setCookie(SUPER_ADMIN_SESSION_COOKIE, "1");
    try {
      window.sessionStorage.setItem("sa_user", JSON.stringify(data.user));
    } catch {
      // ignore
    }
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearSuperAdminAccessToken();
    clearCookie(SUPER_ADMIN_SESSION_COOKIE);
    try {
      window.sessionStorage.removeItem("sa_user");
    } catch {
      // ignore
    }
    setUser(null);
    if (typeof window !== "undefined") {
      // Full reload (not router.push) on purpose: clears all in-memory client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/super-admin/login";
    }
  }, []);

  return (
    <SuperAdminAuthContext.Provider value={{ user, loading, login, logout }}>{children}</SuperAdminAuthContext.Provider>
  );
}

export function useSuperAdminAuth() {
  const ctx = useContext(SuperAdminAuthContext);
  if (!ctx) throw new Error("useSuperAdminAuth phải được dùng bên trong SuperAdminAuthProvider");
  return ctx;
}
