export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const ACCESS_KEY = 'herway_web_access_token';
const REFRESH_KEY = 'herway_web_refresh_token';

const inFlightGets = new Map<string, Promise<unknown>>();
let refreshPromise: Promise<string | null> | null = null;

export function createCorrelationId(prefix = 'web'): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export function createIdempotencyKey(scope = 'webmut'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${scope}-${globalThis.crypto.randomUUID()}`;
  }
  return createCorrelationId(scope);
}

export function getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
  return {
    accessToken: window.localStorage.getItem(ACCESS_KEY),
    refreshToken: window.localStorage.getItem(REFRESH_KEY),
  };
}

export function setStoredTokens(accessToken: string | null, refreshToken: string | null) {
  if (typeof window === 'undefined') return;
  if (accessToken) window.localStorage.setItem(ACCESS_KEY, accessToken);
  else window.localStorage.removeItem(ACCESS_KEY);

  if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
  else window.localStorage.removeItem(REFRESH_KEY);
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { refreshToken } = getStoredTokens();
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': createCorrelationId('webref'),
        },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        setStoredTokens(null, null);
        return null;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setStoredTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface WebApiOptions extends RequestInit {
  idempotencyKey?: string;
  dedupeGet?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: WebApiOptions = {},
  explicitToken?: string,
): Promise<T> {
  const token = explicitToken ?? getStoredTokens().accessToken;
  const method = (options.method ?? 'GET').toUpperCase();
  const canDedupeGet = method === 'GET' && options.dedupeGet !== false;
  const dedupeKey = canDedupeGet ? `${token ?? 'anon'}:${path}` : null;

  if (dedupeKey) {
    const existing = inFlightGets.get(dedupeKey);
    if (existing) return existing as Promise<T>;
  }

  const run = async (): Promise<T> => {
    const reqId = createCorrelationId('web');
    const doRequest = (bearer: string | null) =>
      fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          'X-Request-Id': reqId,
          ...(options.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
          ...(options.headers || {}),
        },
        cache: 'no-store',
      });

    let res = await doRequest(token);
    if (res.status === 401 && !explicitToken) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        res = await doRequest(refreshed);
      }
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { message?: string | string[] };
        if (Array.isArray(body.message)) message = body.message.join(', ');
        else if (body.message) message = body.message;
      } catch {
        const text = await res.text();
        if (text) message = text;
      }
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  };

  if (!dedupeKey) {
    return run();
  }

  const promise = run();
  inFlightGets.set(dedupeKey, promise);
  try {
    return await promise;
  } finally {
    inFlightGets.delete(dedupeKey);
  }
}
