import { useCallback, useEffect, useState } from 'react';
import { mobileApi } from './apiClient';

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

type Listener = () => void;

const store = new Map<string, CacheEntry<unknown>>();
const listeners = new Map<string, Set<Listener>>();

function notify(key: string) {
  const subs = listeners.get(key);
  if (!subs) return;
  for (const fn of subs) {
    fn();
  }
}

export function getCachedQuery<T>(key: string): CacheEntry<T> | undefined {
  return store.get(key) as CacheEntry<T> | undefined;
}

export function setCachedQuery<T>(key: string, updater: T | ((prev: T | undefined) => T)): T {
  const prev = store.get(key)?.data as T | undefined;
  const next =
    typeof updater === 'function' ? (updater as (p: T | undefined) => T)(prev) : updater;
  store.set(key, { data: next, updatedAt: Date.now() });
  notify(key);
  return next;
}

export function invalidateQueryPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      const entry = store.get(key);
      if (entry) {
        entry.updatedAt = 0;
        notify(key);
      }
    }
  }
}

export function subscribeQuery(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set<Listener>();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

export function useCachedApiQuery<T>(
  key: string | null,
  path: string | null,
  options?: { staleTimeMs?: number; enabled?: boolean },
) {
  const staleTimeMs = options?.staleTimeMs ?? 20_000;
  const enabled = options?.enabled ?? Boolean(key && path);
  const cached = key ? getCachedQuery<T>(key) : undefined;

  const [data, setData] = useState<T | undefined>(cached?.data);
  const [loading, setLoading] = useState(!cached && enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(
    async (force = false): Promise<T | undefined> => {
      if (!key || !path || !enabled) return undefined;
      const entry = getCachedQuery<T>(key);
      if (!force && entry && Date.now() - entry.updatedAt < staleTimeMs) {
        setData(entry.data);
        setLoading(false);
        return entry.data;
      }

      if (!entry) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const res = await mobileApi<T>(path);
        setCachedQuery(key, res);
        setData(res);
        return res;
      } catch (err) {
        setError((err as Error).message);
        return entry?.data;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [key, path, enabled, staleTimeMs],
  );

  useEffect(() => {
    if (!key) return;
    return subscribeQuery(key, () => {
      const next = getCachedQuery<T>(key);
      if (next) setData(next.data);
    });
  }, [key]);

  useEffect(() => {
    void refetch(false);
  }, [refetch]);

  return {
    data,
    loading,
    refreshing,
    error,
    refetch: () => refetch(true),
    setData: (updater: T | ((prev: T | undefined) => T)) =>
      key ? setCachedQuery(key, updater) : undefined,
  };
}
