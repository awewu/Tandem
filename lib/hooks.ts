'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHealth } from './hermes-api';

/**
 * @deprecated Use `useHealth` from `lib/hooks/use-hermes-queries.ts` instead.
 * Kept for backward compatibility during migration.
 */
export function useHermesStatus() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [version, setVersion] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const data: any = await getHealth();
        if (cancelled) return;
        setConnected(!!data?.ok);
        setVersion(data?.version);
        setError(data?.error);
      } catch (e: any) {
        if (cancelled) return;
        setConnected(false);
        setError(e?.message || 'Network error');
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { connected, checking, version, error };
}

/**
 * React Query-powered health check.
 *
 * Replaces the manual polling in `useHermesStatus` with automatic
 * deduplication, background refetch, and shared cache.
 */
export function useHealth() {
  return useQuery({
    queryKey: ['hermes', 'health'],
    queryFn: async () => {
      const data: any = await getHealth();
      return {
        connected: !!data?.ok,
        version: data?.version as string | undefined,
        error: data?.error as string | undefined,
        raw: data,
      };
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) setValue(JSON.parse(item));
    } catch {}
  }, [key]);

  const setStored = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  };

  return [value, setStored];
}
