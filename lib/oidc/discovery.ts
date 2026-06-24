/**
 * lib/oidc/discovery.ts · issuer 解析 + OIDC Discovery 文档
 *
 * issuer 优先级: env OIDC_ISSUER > 请求 Origin (x-forwarded-proto/host).
 * issuer 不含末尾斜杠; discovery 在 {issuer}/.well-known/openid-configuration.
 */

import { SUPPORTED_SCOPES } from './types';

/** 从请求头解析 issuer base URL (无末尾斜杠) */
export function resolveIssuer(headers: Headers): string {
  const envIssuer = process.env.OIDC_ISSUER?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envIssuer) return envIssuer.replace(/\/+$/, '');
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

export function buildDiscoveryDocument(issuer: string): Record<string, unknown> {
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/oidc/authorize`,
    token_endpoint: `${issuer}/api/oidc/token`,
    userinfo_endpoint: `${issuer}/api/oidc/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    end_session_endpoint: `${issuer}/api/oidc/logout`,
    scopes_supported: [...SUPPORTED_SCOPES],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none',
    ],
    code_challenge_methods_supported: ['S256', 'plain'],
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'auth_time',
      'nonce',
      'name',
      'preferred_username',
      'email',
      'email_verified',
      'job_title',
      'roles',
      'tenant',
      'department',
      'department_id',
      'department_path',
      'manager_id',
      'manager_name',
      'employee_id',
    ],
  };
}
