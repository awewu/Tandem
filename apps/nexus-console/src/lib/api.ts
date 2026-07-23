// Server-only backend access for the control plane.
// Targets the NestJS service (default :5500, prefix /api/v2) where the
// control-plane data lives (auth/login, tenants, brand). The JWT is kept in an
// httpOnly cookie (never localStorage) per the security audit recommendation.
// Every call is best-effort: on auth failure / unreachable backend it returns
// null so the UI degrades gracefully to placeholder KPIs.
import { cookies } from 'next/headers';

const BASE = process.env.NEXUS_API_URL || 'http://localhost:5500';
const PREFIX = process.env.NEXUS_API_PREFIX ?? '/api/v2';
const TIMEOUT_MS = 4000;

export const TOKEN_COOKIE = 'nx_token';

export function apiUrl(path: string): string {
  return `${BASE}${PREFIX}${path}`;
}

async function readToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(TOKEN_COOKIE)?.value;
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
  withAuth = true,
): Promise<Response | null> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (withAuth) {
    const token = await readToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(apiUrl(path), { ...init, headers, signal: ctrl.signal, cache: 'no-store' });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface SessionUser {
  userId?: string;
  tenantId?: string;
  role?: string;
  permissions?: string[];
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readToken();
  if (!token) return null;
  const res = await backendFetch('/auth/me');
  if (!res || !res.ok) return null;
  try {
    return (await res.json()) as SessionUser;
  } catch {
    return null;
  }
}

function asLength(data: unknown): number | null {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
    return (data as any).data.length;
  }
  return null;
}

export async function getTenantsCount(): Promise<number | null> {
  const res = await backendFetch('/tenants');
  if (!res || !res.ok) return null;
  try {
    return asLength(await res.json());
  } catch {
    return null;
  }
}

export interface BrandStats {
  products: number | null;
  news: number | null;
}

export async function getBrandStats(): Promise<BrandStats | null> {
  const res = await backendFetch('/brand');
  if (!res || !res.ok) return null;
  try {
    const d: any = await res.json();
    return {
      products: Array.isArray(d?.products) ? d.products.length : null,
      news: Array.isArray(d?.news) ? d.news.length : null,
    };
  } catch {
    return null;
  }
}

export async function getHealth(): Promise<any | null> {
  const res = await backendFetch('/health', {}, false);
  if (!res || !res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function getProductDevices(): Promise<any[]> {
  const res = await backendFetch('/product-catalog/devices');
  if (!res || !res.ok) return [];
  try {
    const d: any = await res.json();
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.data?.items)) return d.data.items;
    if (Array.isArray(d?.items)) return d.items;
    return [];
  } catch {
    return [];
  }
}
