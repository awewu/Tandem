export const OIDC_REQUIRED_ENV_KEYS = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_CLIENT_SECRET',
  'OIDC_REDIRECT_URI',
  'OIDC_SCOPES',
  'OIDC_POST_LOGIN_REDIRECT',
] as const;

export const OIDC_LOCAL_REFERENCE = {
  issuer: 'https://ai.rhautt.com',
  clientId: 'cli_mrvdz1yr8jfzrb8u',
  redirectUri: 'http://localhost:5000/api/v2/auth/sso/callback',
  postLoginRedirect: '/brand',
  scopes: 'openid profile email roles org',
} as const;

export const OIDC_PRODUCTION_REFERENCE = {
  issuer: 'https://ai.rhautt.com',
  clientId: 'cli_mrve0bgvgnl2gkjg',
  redirectUri: 'https://nexus.rhautt.com/api/v2/auth/sso/callback',
  postLoginRedirect: '/brand',
  scopes: 'openid profile email roles org',
} as const;

export type OidcRuntimeConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  postLoginRedirect: string;
  userinfoEnabled: boolean;
  allowedRedirectHosts: string[];
  roleClaim: string;
  orgClaim: string;
};

const DEFAULT_SCOPES = OIDC_LOCAL_REFERENCE.scopes;
const SECRET_PLACEHOLDER_PATTERN =
  /^(?:|replace[-_ ].*|.*placeholder.*|.*secret[-_ ]manager.*|.*do[-_ ]not[-_ ]commit.*)$/i;

function read(env: NodeJS.ProcessEnv, key: string, fallback = '') {
  return (env[key] || fallback).trim();
}

function splitList(value: string) {
  return value
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readOidcRuntimeConfig(env: NodeJS.ProcessEnv = process.env): OidcRuntimeConfig {
  return {
    issuer: read(env, 'OIDC_ISSUER'),
    clientId: read(env, 'OIDC_CLIENT_ID'),
    clientSecret: read(env, 'OIDC_CLIENT_SECRET'),
    redirectUri: read(env, 'OIDC_REDIRECT_URI'),
    scopes: splitList(read(env, 'OIDC_SCOPES', DEFAULT_SCOPES)),
    postLoginRedirect: read(env, 'OIDC_POST_LOGIN_REDIRECT', '/brand'),
    userinfoEnabled: read(env, 'OIDC_USERINFO_ENABLED', 'true') !== 'false',
    allowedRedirectHosts: splitList(read(env, 'OIDC_ALLOWED_REDIRECT_HOSTS')),
    roleClaim: read(env, 'OIDC_ROLES_CLAIM', 'roles'),
    orgClaim: read(env, 'OIDC_ORG_CLAIM', 'org'),
  };
}

export function assertOidcRuntimeConfig(env: NodeJS.ProcessEnv = process.env): OidcRuntimeConfig {
  const config = readOidcRuntimeConfig(env);
  const missing = OIDC_REQUIRED_ENV_KEYS.filter((key) => !read(env, key));

  if (missing.length) {
    throw new Error(`OIDC runtime configuration is incomplete: missing ${missing.join(', ')}`);
  }

  if (SECRET_PLACEHOLDER_PATTERN.test(config.clientSecret)) {
    throw new Error('OIDC_CLIENT_SECRET must be injected from a server-side secret channel');
  }

  return config;
}
