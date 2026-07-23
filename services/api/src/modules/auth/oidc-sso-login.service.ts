import { randomBytes } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SsoAuditLogService } from './sso-audit-log.service';

export const DEFAULT_OIDC_ISSUER = 'https://ai.rhautt.com';
const DEFAULT_SCOPE = 'openid profile email roles org';
const DEFAULT_POST_LOGIN_REDIRECT = '/brand';
const LOCAL_CLIENT_ID = 'cli_mrvdz1yr8jfzrb8u';
const PRODUCTION_CLIENT_ID = 'cli_mrve0bgvgnl2gkjg';
const LOCAL_REDIRECT_URI = 'http://localhost:5000/api/v2/auth/sso/callback';
const PRODUCTION_REDIRECT_URI = 'https://nexus.rhautt.com/api/v2/auth/sso/callback';
export const SSO_COOKIE_PATH = '/api/v2/auth/sso';
const SSO_COOKIE_MAX_AGE_SECONDS = 5 * 60;

export const SSO_STATE_COOKIE = 'nx_sso_state';
export const SSO_REDIRECT_COOKIE = 'nx_sso_redirect';

export interface OidcDiscoveryDocument {
  issuer?: unknown;
  authorization_endpoint?: unknown;
  token_endpoint?: unknown;
  userinfo_endpoint?: unknown;
  jwks_uri?: unknown;
}

export interface OidcSsoLoginRedirect {
  location: string;
  cookies: string[];
  state: string;
  redirect: string;
}

@Injectable()
export class OidcSsoLoginService {
  constructor(
    private readonly config: ConfigService,
    private readonly audit?: SsoAuditLogService,
  ) {}

  async createLoginRedirect(rawRedirect?: string | string[]): Promise<OidcSsoLoginRedirect> {
    const issuer = this.configValue('OIDC_ISSUER') || DEFAULT_OIDC_ISSUER;
    try {
      const discovery = await this.discover(issuer);
      const redirect = this.safeRedirect(rawRedirect);
      const state = this.createState();
      const redirectUri = this.resolveRedirectUri();
      if (typeof discovery.authorization_endpoint !== 'string' || !discovery.authorization_endpoint) {
        throw new ServiceUnavailableException('OIDC authorization endpoint missing');
      }

      const authorizeUrl = new URL(discovery.authorization_endpoint);

      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', this.resolveClientId());
      authorizeUrl.searchParams.set('redirect_uri', redirectUri);
      authorizeUrl.searchParams.set('scope', this.configValue('OIDC_SCOPES') || DEFAULT_SCOPE);
      authorizeUrl.searchParams.set('state', state);

      this.audit?.record({
        eventType: 'sso.login.started',
        outcome: 'success',
        provider: 'rhautt-ai-oidc',
        issuer: issuer.replace(/\/+$/, ''),
      });

      return {
        location: authorizeUrl.toString(),
        cookies: [
          this.buildCookie(SSO_STATE_COOKIE, state, redirectUri),
          this.buildCookie(SSO_REDIRECT_COOKIE, redirect, redirectUri),
        ],
        state,
        redirect,
      };
    } catch (error) {
      this.audit?.record({
        eventType: 'sso.login.failed',
        outcome: 'failure',
        provider: 'rhautt-ai-oidc',
        issuer: issuer.replace(/\/+$/, ''),
        failureReason: 'oidc_discovery_failed',
      });
      throw error;
    }
  }

  safeRedirect(rawRedirect?: string | string[]): string {
    const value = Array.isArray(rawRedirect) ? rawRedirect[0] : rawRedirect;
    const fallback = this.safeConfiguredDefaultRedirect();
    return this.normalizeSameSitePath(value, fallback);
  }

  private normalizeSameSitePath(value: unknown, fallback: string): string {
    if (!value) return fallback;

    const candidate = String(value).trim();
    if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
    if (candidate.includes('\u0000') || candidate.includes('\r') || candidate.includes('\n')) {
      return fallback;
    }

    let decodedPrefix = candidate;
    try {
      decodedPrefix = decodeURIComponent(candidate);
    } catch {
      return fallback;
    }
    if (decodedPrefix.startsWith('//') || decodedPrefix.startsWith('/\\')) return fallback;

    try {
      const parsed = new URL(candidate, 'https://nexus.local');
      if (parsed.origin !== 'https://nexus.local') return fallback;
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return fallback;
    }
  }

  async discover(issuer: string): Promise<OidcDiscoveryDocument> {
    const normalizedIssuer = issuer.replace(/\/+$/, '');
    const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;
    let response: Response;
    try {
      response = await fetch(discoveryUrl, {
        headers: { accept: 'application/json' },
      });
    } catch {
      throw new ServiceUnavailableException('OIDC discovery failed');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('OIDC discovery failed');
    }

    let document: OidcDiscoveryDocument;
    try {
      document = (await response.json()) as OidcDiscoveryDocument;
    } catch {
      throw new ServiceUnavailableException('OIDC discovery failed');
    }

    return document;
  }

  safeConfiguredDefaultRedirect(): string {
    const configured = this.configValue('OIDC_POST_LOGIN_REDIRECT');
    if (!configured || configured === DEFAULT_POST_LOGIN_REDIRECT) return DEFAULT_POST_LOGIN_REDIRECT;
    return this.normalizeSameSitePath(configured, DEFAULT_POST_LOGIN_REDIRECT);
  }

  private createState(): string {
    return randomBytes(32).toString('base64url');
  }

  private resolveClientId(): string {
    const configured = this.configValue('OIDC_CLIENT_ID');
    if (configured) return configured;
    return this.isProduction() ? PRODUCTION_CLIENT_ID : LOCAL_CLIENT_ID;
  }

  private resolveRedirectUri(): string {
    const configured = this.configValue('OIDC_REDIRECT_URI');
    if (configured) return configured;
    return this.isProduction() ? PRODUCTION_REDIRECT_URI : LOCAL_REDIRECT_URI;
  }

  private buildCookie(name: string, value: string, redirectUri: string): string {
    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      `Path=${SSO_COOKIE_PATH}`,
      `Max-Age=${SSO_COOKIE_MAX_AGE_SECONDS}`,
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (this.isSecureCookie(redirectUri)) parts.push('Secure');
    return parts.join('; ');
  }

  private isSecureCookie(redirectUri: string): boolean {
    return this.isProduction() || redirectUri.startsWith('https://');
  }

  private isProduction(): boolean {
    return this.configValue('NODE_ENV') === 'production' || process.env.NODE_ENV === 'production';
  }

  private configValue(key: string): string | undefined {
    const value = this.config.get<string>(key) ?? process.env[key];
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || undefined;
  }
}
