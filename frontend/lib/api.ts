"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";

const API_BASE = "/api/v1";

/* ------------------------------------------------------------------ */
/* Token storage                                                       */
/*                                                                      */
/* Two independent sessions can be active in the same browser:         */
/*  - a "tenant" session (a user logged into one school, under /:slug) */
/*  - a "super_admin" session (logged in at /super-admin)              */
/* They use separate localStorage keys and separate cookies (set in    */
/* lib/auth-context.tsx) so proxy.ts can tell them apart.              */
/* ------------------------------------------------------------------ */

function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore (private mode / storage disabled)
  }
}

function removeLocalStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const TENANT_TOKEN_KEY = "lib_access_token";
const TENANT_TOKEN_SLUG_KEY = "lib_access_token_slug";
const SUPER_ADMIN_TOKEN_KEY = "sa_access_token";

/** Tenant token is only considered valid when it was issued for the given slug. */
export function getTenantAccessToken(slug: string): string | null {
  const token = readLocalStorage(TENANT_TOKEN_KEY);
  if (!token) return null;
  if (readLocalStorage(TENANT_TOKEN_SLUG_KEY) !== slug) return null;
  return token;
}

export function setTenantAccessToken(slug: string, token: string) {
  writeLocalStorage(TENANT_TOKEN_KEY, token);
  writeLocalStorage(TENANT_TOKEN_SLUG_KEY, slug);
}

export function clearTenantAccessToken() {
  removeLocalStorage(TENANT_TOKEN_KEY);
  removeLocalStorage(TENANT_TOKEN_SLUG_KEY);
}

export function getSuperAdminAccessToken(): string | null {
  return readLocalStorage(SUPER_ADMIN_TOKEN_KEY);
}

export function setSuperAdminAccessToken(token: string) {
  writeLocalStorage(SUPER_ADMIN_TOKEN_KEY, token);
}

export function clearSuperAdminAccessToken() {
  removeLocalStorage(SUPER_ADMIN_TOKEN_KEY);
}

/* ------------------------------------------------------------------ */
/* Core fetch                                                          */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

interface FetchScope {
  getToken(): string | null;
  setToken(token: string): void;
  /** Full path (under API_BASE) used to silently refresh the access token, e.g. `/${slug}/auth/refresh`. */
  refreshPath?: string;
}

const refreshPromisesByPath = new Map<string, Promise<string | null>>();

async function refreshToken(scope: FetchScope): Promise<string | null> {
  if (!scope.refreshPath) return null;
  try {
    const res = await fetch(`${API_BASE}${scope.refreshPath}`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const token = data?.access_token;
    if (token) {
      scope.setToken(token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

async function coreFetch<T = unknown>(fullPath: string, options: ApiFetchOptions, scope: FetchScope): Promise<T> {
  const { skipAuth, skipRefresh, body, headers, ...rest } = options;

  const run = async (bearer: string | null) => {
    const finalHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(bearer && !skipAuth ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(headers as Record<string, string> | undefined),
    };
    return fetch(`${API_BASE}${fullPath}`, {
      ...rest,
      credentials: "include",
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await run(scope.getToken());

  if (res.status === 401 && !skipAuth && !skipRefresh && scope.refreshPath) {
    const key = scope.refreshPath;
    let pending = refreshPromisesByPath.get(key);
    if (!pending) {
      pending = refreshToken(scope).finally(() => refreshPromisesByPath.delete(key));
      refreshPromisesByPath.set(key, pending);
    }
    const newToken = await pending;
    if (newToken) {
      res = await run(newToken);
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || res.statusText || "Đã có lỗi xảy ra, vui lòng thử lại.";
    const code = data?.error?.code;
    throw new ApiError(message, res.status, code);
  }

  return data as T;
}

/* ------------------------------------------------------------------ */
/* Public entry points                                                 */
/* ------------------------------------------------------------------ */

/** Calls a tenant-scoped endpoint: `/api/v1/{slug}{path}`. */
export async function apiFetchTenant<T = unknown>(
  slug: string,
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const scope: FetchScope = {
    getToken: () => getTenantAccessToken(slug),
    setToken: (token) => setTenantAccessToken(slug, token),
    refreshPath: `/${slug}/auth/refresh`,
  };
  return coreFetch<T>(`/${slug}${path}`, options, scope);
}

/** Calls a super-admin endpoint: `/api/v1/super-admin{path}`. */
export async function apiFetchSuperAdmin<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const scope: FetchScope = {
    getToken: getSuperAdminAccessToken,
    setToken: setSuperAdminAccessToken,
  };
  return coreFetch<T>(`/super-admin${path}`, options, scope);
}

/** Calls a fully public/global endpoint (no auth), e.g. `/schools/register`, `/schools/check-slug`. */
export async function apiFetchPublic<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const scope: FetchScope = { getToken: () => null, setToken: () => {} };
  return coreFetch<T>(path, { ...options, skipAuth: true, skipRefresh: true }, scope);
}

/** Reads the `slug` route param for the current tenant route tree. */
export function useSlug(): string {
  const params = useParams<{ slug: string }>();
  return String(params?.slug ?? "");
}

/**
 * Client-component hook returning an `apiFetch(path, options)` function bound to the
 * current tenant (`slug` taken from the URL). Drop-in replacement for the old,
 * single-tenant `apiFetch` import used throughout app/[slug]/(app)/* pages.
 */
export function useApi() {
  const slug = useSlug();
  return useCallback(<T = unknown>(path: string, options?: ApiFetchOptions) => apiFetchTenant<T>(slug, path, options), [slug]);
}

/** Backend list endpoints may wrap items differently; normalize defensively. */
export function unwrapList<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "data", "results", "records", "list"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export function unwrapTotal(data: unknown, fallback: number): number {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["total", "total_count", "count"]) {
      if (typeof obj[key] === "number") return obj[key] as number;
    }
  }
  return fallback;
}
