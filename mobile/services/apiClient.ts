import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const ACCESS_TOKEN_KEY = 'herway_mobile_jwt';
const REFRESH_TOKEN_KEY = 'herway_mobile_refresh_jwt';

const inFlightGets = new Map<string, Promise<unknown>>();
let refreshPromise: Promise<string | null> | null = null;

export function createCorrelationId(prefix = 'mob'): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export function createIdempotencyKey(scope = 'mut'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${scope}-${globalThis.crypto.randomUUID()}`;
  }
  return createCorrelationId(scope);
}

export async function saveTokens(accessToken: string | null, refreshToken: string | null) {
  if (accessToken) await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  else await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);

  if (refreshToken) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  else await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

async function tryRefreshMobileToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': createCorrelationId('ref'),
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await saveTokens(null, null);
        return null;
      }

      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      await saveTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface MobileApiOptions extends RequestInit {
  idempotencyKey?: string;
  timeoutMs?: number;
  dedupeGet?: boolean;
}

export async function mobileApi<T>(
  path: string,
  options: MobileApiOptions = {},
  explicitToken?: string | null,
): Promise<T> {
  const token = explicitToken !== undefined ? explicitToken : await getAccessToken();
  const method = (options.method ?? 'GET').toUpperCase();
  const canDedupeGet = method === 'GET' && options.dedupeGet !== false;
  const dedupeKey = canDedupeGet ? `${token ?? 'anon'}:${path}` : null;

  if (dedupeKey) {
    const existing = inFlightGets.get(dedupeKey);
    if (existing) return existing as Promise<T>;
  }

  const run = async (): Promise<T> => {
    const reqId = createCorrelationId('mob');
    const execute = async (bearer: string | null) => {
      const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : undefined;
      const timeoutMs = options.timeoutMs ?? 15_000;
      const timer = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : undefined;

      try {
        return await fetch(`${API_URL}${path}`, {
          ...options,
          signal: options.signal ?? controller?.signal,
          headers: {
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
            'X-Request-Id': reqId,
            ...(options.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
            ...(options.headers || {}),
          },
        });
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    let res = await execute(token);
    if (res.status === 401 && explicitToken === undefined) {
      const refreshed = await tryRefreshMobileToken();
      if (refreshed) {
        res = await execute(refreshed);
      }
    }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string | string[] };
        if (Array.isArray(body.message)) msg = body.message.join(', ');
        else if (body.message) msg = body.message;
      } catch {
        const text = await res.text();
        if (text) msg = text;
      }
      throw new Error(msg);
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
