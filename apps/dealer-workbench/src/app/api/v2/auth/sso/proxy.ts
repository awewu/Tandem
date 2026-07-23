export const DEFAULT_SSO_API_ORIGIN = 'http://localhost:5500';

type SsoProxyEnv = Record<string, string | undefined>;

export function resolveSsoApiOrigin(env: SsoProxyEnv = process.env): string {
  return (env.NEXUS_API_URL || env.API_URL || DEFAULT_SSO_API_ORIGIN).replace(/\/+$/, '');
}

export function buildSsoProxyTarget(
  pathParts: string[],
  requestUrl: string,
  env: SsoProxyEnv = process.env,
): string {
  const safePath = pathParts.map((part) => encodeURIComponent(part)).join('/');
  const target = new URL(`${resolveSsoApiOrigin(env)}/api/v2/auth/sso/${safePath}`);
  target.search = new URL(requestUrl).search;
  return target.toString();
}

export function setCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(headers);

  const header = headers.get('set-cookie');
  return header ? [header] : [];
}
