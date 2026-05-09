'use client';

import { useEffect, useState } from 'react';
import { getHealth } from './hermes-api';

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
