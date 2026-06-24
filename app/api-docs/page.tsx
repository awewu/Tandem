import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ApiDocsClient from './api-docs-client';
import { COOKIE_ACCESS, verifyAccessToken } from '@/lib/auth/session';
import { API_DOC_HOST, API_ENDPOINTS } from '@/lib/api-docs/catalog';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['owner', 'admin', 'steward']);

export default function ApiDocsPage() {
  const token = cookies().get(COOKIE_ACCESS)?.value;
  const payload = token ? verifyAccessToken(token) : null;

  if (!payload) {
    redirect('/login?next=/api-docs');
  }

  const allowed = payload.roles?.some((role) => ALLOWED_ROLES.has(role));
  if (!allowed) {
    redirect('/forbidden?from=/api-docs');
  }

  return (
    <ApiDocsClient
      endpoints={API_ENDPOINTS}
      host={process.env.NEXT_PUBLIC_API_DOC_HOST || API_DOC_HOST}
      viewer={{
        email: payload.email,
        roles: payload.roles ?? [],
      }}
    />
  );
}
