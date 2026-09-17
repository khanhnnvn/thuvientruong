const TOKEN_KEY = "lib_access_token";
const API_BASE = "/api/v1";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore (private mode / storage disabled)
  }
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

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

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const token = data?.access_token;
    if (token) {
      setAccessToken(token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, skipRefresh, body, headers, ...rest } = options;

  const run = async (bearer: string | null) => {
    const finalHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(bearer && !skipAuth ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(headers as Record<string, string> | undefined),
    };
    return fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: "include",
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await run(getAccessToken());

  if (res.status === 401 && !skipAuth && !skipRefresh) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
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
