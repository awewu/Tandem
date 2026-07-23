import {
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import {
  DEFAULT_OIDC_ISSUER,
  OidcDiscoveryDocument,
  OidcSsoLoginService,
  SSO_COOKIE_PATH,
  SSO_REDIRECT_COOKIE,
  SSO_STATE_COOKIE,
} from './oidc-sso-login.service';
import { SsoAuditLogService, SsoFailureReason } from './sso-audit-log.service';
import { SsoExternalIdentityService } from './sso-external-identity.service';

const SSO_PROVIDER = 'rhautt-ai-oidc';
const NX_TOKEN_COOKIE = 'nx_token';
const CLOCK_TOLERANCE_SECONDS = 60;
const SSO_REASON_KEY = Symbol('ssoReason');

type Claims = Record<string, any>;
type OidcJwk = JsonWebKey & { kid?: string };

export interface OidcSsoCallbackResult {
  location: string;
  cookies: string[];
  token: string;
  user: Record<string, unknown>;
}

@Injectable()
export class OidcSsoCallbackService {
  constructor(
    private readonly config: ConfigService,
    private readonly login: OidcSsoLoginService,
    private readonly identities: SsoExternalIdentityService,
    private readonly auth: AuthService,
    private readonly audit?: SsoAuditLogService,
  ) {}

  async handleCallback(input: {
    code?: string | string[];
    state?: string | string[];
    cookieHeader?: string;
    requestId?: string;
    traceId?: string;
  }): Promise<OidcSsoCallbackResult> {
    const code = this.singleValue(input.code);
    const state = this.singleValue(input.state);
    const cookies = this.parseCookies(input.cookieHeader);
    const expectedState = cookies[SSO_STATE_COOKIE];
    let issuer = DEFAULT_OIDC_ISSUER;
    let subject = '';
    let localUserId = '';

    try {
      if (!code) this.fail('missing_code', new UnauthorizedException('OIDC callback is missing code'));
      if (!state) this.fail('missing_state', new UnauthorizedException('OIDC callback is missing state'));
      if (!expectedState || state !== expectedState) {
        this.fail('state_mismatch', new UnauthorizedException('OIDC callback state mismatch'));
      }

      const config = this.runtimeConfig();
      issuer = config.issuer;
      const discovery = await this.discover(config.issuer);
      const tokenSet = await this.exchangeCode(discovery, config, code);
      const idTokenClaims = tokenSet.id_token
        ? await this.verifyIdToken(tokenSet.id_token, discovery, config)
        : {};
      const claims = await this.enrichClaims(idTokenClaims, tokenSet.access_token, discovery, config);
      subject = this.claimString(claims.sub);
      if (!subject) this.fail('missing_subject', new UnauthorizedException('OIDC subject missing'));

      const resolved = await this.identities.resolveVerifiedIdentity({
        provider: SSO_PROVIDER,
        issuer: this.claimString(claims.iss) || config.issuer,
        subject,
        profile: this.profileFromClaims(claims, config),
      });
      if (resolved.status !== 'authenticated' || !resolved.user) {
        this.fail(
          'pending_authorization',
          new ForbiddenException('SSO external identity is pending authorization'),
        );
      }
      localUserId = resolved.user.id;

      const loginResult = await this.auth.issueLoginForResolvedUser(resolved.user);
      const redirect = this.login.safeRedirect(cookies[SSO_REDIRECT_COOKIE]);
      this.audit?.record({
        eventType: 'sso.callback.succeeded',
        outcome: 'success',
        provider: SSO_PROVIDER,
        issuer,
        subject,
        localUserId,
        requestId: input.requestId,
        traceId: input.traceId,
      });
      return {
        location: redirect,
        cookies: [
          ...this.clearTransientCookies(config.redirectUri),
          this.buildTokenCookie(loginResult.token, config.redirectUri),
        ],
        token: loginResult.token,
        user: loginResult.user,
      };
    } catch (error) {
      const reason = this.failureReason(error);
      this.audit?.record({
        eventType: 'sso.callback.failed',
        outcome: 'failure',
        provider: SSO_PROVIDER,
        issuer,
        subject,
        localUserId,
        failureReason: reason,
        requestId: input.requestId,
        traceId: input.traceId,
      });
      throw error;
    }
  }

  failureReason(error: unknown): SsoFailureReason {
    const explicit = (error as any)?.[SSO_REASON_KEY] as SsoFailureReason | undefined;
    if (explicit) return explicit;

    const message = String((error as any)?.message || (error as any)?.response?.message || '');
    if (/client secret/i.test(message)) return 'client_secret_missing';
    if (/discovery failed/i.test(message)) return 'oidc_discovery_failed';
    if (/token endpoint missing/i.test(message)) return 'token_endpoint_missing';
    if (/token exchange failed/i.test(message)) return 'token_endpoint_error';
    if (/JWKS endpoint missing/i.test(message)) return 'jwks_endpoint_missing';
    if (/JWKS fetch failed/i.test(message)) return 'jwks_fetch_failed';
    if (/signing key not found/i.test(message)) return 'signing_key_not_found';
    if (/alg invalid/i.test(message)) return 'invalid_id_token_alg';
    if (/issued-at/i.test(message)) return 'invalid_iat';
    if (/userinfo failed/i.test(message)) return 'userinfo_failed';
    if (/userinfo subject mismatch/i.test(message)) return 'userinfo_subject_mismatch';
    if (/subject missing/i.test(message)) return 'missing_subject';
    if (/binding is not active/i.test(message)) return 'binding_inactive';
    if (/binding is incomplete/i.test(message)) return 'binding_incomplete';
    if (/local user is not active/i.test(message)) return 'local_user_inactive';
    if (/tenant mismatch/i.test(message)) return 'tenant_mismatch';
    if (/pending authorization/i.test(message)) return 'pending_authorization';
    return 'unexpected';
  }

  clearTransientCookies(redirectUri = this.runtimeConfig(false).redirectUri): string[] {
    return [
      this.expireCookie(SSO_STATE_COOKIE, SSO_COOKIE_PATH, redirectUri),
      this.expireCookie(SSO_REDIRECT_COOKIE, SSO_COOKIE_PATH, redirectUri),
    ];
  }

  private runtimeConfig(requireSecret = true) {
    const issuer = this.configValue('OIDC_ISSUER') || DEFAULT_OIDC_ISSUER;
    const clientId =
      this.configValue('OIDC_CLIENT_ID') ||
      (this.isProduction() ? 'cli_mrve0bgvgnl2gkjg' : 'cli_mrvdz1yr8jfzrb8u');
    const clientSecret = this.configValue('OIDC_CLIENT_SECRET');
    const redirectUri =
      this.configValue('OIDC_REDIRECT_URI') ||
      (this.isProduction()
        ? 'https://nexus.rhautt.com/api/v2/auth/sso/callback'
        : 'http://localhost:5000/api/v2/auth/sso/callback');
    if (requireSecret && !clientSecret) {
      this.fail(
        'client_secret_missing',
        new ServiceUnavailableException('OIDC client secret is not configured'),
      );
    }
    return {
      issuer: issuer.replace(/\/+$/, ''),
      clientId,
      clientSecret: clientSecret || '',
      redirectUri,
      userinfoEnabled: this.configValue('OIDC_USERINFO_ENABLED') !== 'false',
      roleClaim: this.configValue('OIDC_ROLES_CLAIM') || 'roles',
      orgClaim: this.configValue('OIDC_ORG_CLAIM') || 'org',
    };
  }

  private async discover(issuer: string): Promise<OidcDiscoveryDocument> {
    try {
      return await this.login.discover(issuer);
    } catch (error: any) {
      this.fail('oidc_discovery_failed', error);
    }
  }

  private async exchangeCode(
    discovery: OidcDiscoveryDocument,
    config: ReturnType<OidcSsoCallbackService['runtimeConfig']>,
    code: string,
  ): Promise<{ id_token?: string; access_token?: string }> {
    if (typeof discovery.token_endpoint !== 'string' || !discovery.token_endpoint) {
      this.fail('token_endpoint_missing', new ServiceUnavailableException('OIDC token endpoint missing'));
    }

    let response: Response;
    try {
      response = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
        }),
      });
    } catch {
      this.fail('token_endpoint_error', new ServiceUnavailableException('OIDC token exchange failed'));
    }

    if (!response.ok) this.fail('token_endpoint_error', new UnauthorizedException('OIDC token exchange failed'));
    const body = (await response.json()) as Record<string, unknown>;
    return {
      id_token: this.claimString(body.id_token),
      access_token: this.claimString(body.access_token),
    };
  }

  private async verifyIdToken(
    idToken: string,
    discovery: OidcDiscoveryDocument,
    config: ReturnType<OidcSsoCallbackService['runtimeConfig']>,
  ): Promise<Claims> {
    if (typeof discovery.jwks_uri !== 'string' || !discovery.jwks_uri) {
      this.fail('jwks_endpoint_missing', new ServiceUnavailableException('OIDC JWKS endpoint missing'));
    }
    const decoded = jwt.decode(idToken, { complete: true }) as jwt.Jwt | null;
    const header = decoded?.header as jwt.JwtHeader | undefined;
    if (!header?.alg || header.alg === 'none') {
      this.fail('invalid_id_token_alg', new UnauthorizedException('OIDC id_token alg invalid'));
    }

    const key = await this.findJwk(discovery.jwks_uri, header.kid);
    const pem = createPublicKey({ key, format: 'jwk' } as any).export({
      type: 'spki',
      format: 'pem',
    }) as string;

    let claims: Claims;
    try {
      claims = jwt.verify(idToken, pem, {
        algorithms: [header.alg as jwt.Algorithm],
        issuer: config.issuer,
        audience: config.clientId,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      }) as Claims;
    } catch (error: any) {
      this.fail(this.idTokenFailureReason(error), new UnauthorizedException('OIDC id_token validation failed'));
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.iat === 'number' && claims.iat > now + CLOCK_TOLERANCE_SECONDS) {
      this.fail('invalid_iat', new UnauthorizedException('OIDC id_token issued-at is invalid'));
    }
    return claims;
  }

  private async findJwk(jwksUri: string, kid?: string): Promise<OidcJwk> {
    let response: Response;
    try {
      response = await fetch(jwksUri, { headers: { accept: 'application/json' } });
    } catch {
      this.fail('jwks_fetch_failed', new ServiceUnavailableException('OIDC JWKS fetch failed'));
    }
    if (!response.ok) this.fail('jwks_fetch_failed', new ServiceUnavailableException('OIDC JWKS fetch failed'));
    const jwks = (await response.json()) as { keys?: OidcJwk[] };
    const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
    const key = kid ? keys.find((entry) => entry.kid === kid) : keys[0];
    if (!key) this.fail('signing_key_not_found', new UnauthorizedException('OIDC signing key not found'));
    return key;
  }

  private async enrichClaims(
    idTokenClaims: Claims,
    accessToken: string | undefined,
    discovery: OidcDiscoveryDocument,
    config: ReturnType<OidcSsoCallbackService['runtimeConfig']>,
  ): Promise<Claims> {
    if (!this.needsUserinfo(idTokenClaims, config) || !config.userinfoEnabled) return idTokenClaims;
    if (!accessToken || typeof discovery.userinfo_endpoint !== 'string') return idTokenClaims;

    const response = await fetch(discovery.userinfo_endpoint, {
      headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) this.fail('userinfo_failed', new UnauthorizedException('OIDC userinfo failed'));
    const userinfo = (await response.json()) as Claims;
    if (idTokenClaims.sub && userinfo.sub && idTokenClaims.sub !== userinfo.sub) {
      this.fail(
        'userinfo_subject_mismatch',
        new UnauthorizedException('OIDC userinfo subject mismatch'),
      );
    }
    return { ...userinfo, ...idTokenClaims, sub: idTokenClaims.sub || userinfo.sub };
  }

  private needsUserinfo(claims: Claims, config: ReturnType<OidcSsoCallbackService['runtimeConfig']>) {
    return !claims.sub || !claims.name || !claims.email || !claims[config.roleClaim] || !claims[config.orgClaim];
  }

  private profileFromClaims(
    claims: Claims,
    config: ReturnType<OidcSsoCallbackService['runtimeConfig']>,
  ): Record<string, unknown> {
    return {
      sub: claims.sub,
      name: claims.name ?? null,
      email: claims.email ?? null,
      roles: claims[config.roleClaim] ?? null,
      org: claims[config.orgClaim] ?? null,
    };
  }

  private buildTokenCookie(token: string, redirectUri: string): string {
    const parts = [
      `${NX_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (this.isSecureCookie(redirectUri)) parts.push('Secure');
    return parts.join('; ');
  }

  private expireCookie(name: string, path: string, redirectUri: string): string {
    const parts = [`${name}=`, `Path=${path}`, 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
    if (this.isSecureCookie(redirectUri)) parts.push('Secure');
    return parts.join('; ');
  }

  private parseCookies(cookieHeader = ''): Record<string, string> {
    return cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, part) => {
        const index = part.indexOf('=');
        if (index <= 0) return acc;
        acc[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
        return acc;
      }, {});
  }

  private singleValue(value: string | string[] | undefined): string {
    return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
  }

  private claimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isSecureCookie(redirectUri: string): boolean {
    return this.isProduction() || redirectUri.startsWith('https://');
  }

  private isProduction(): boolean {
    return this.configValue('NODE_ENV') === 'production' || process.env.NODE_ENV === 'production';
  }

  private idTokenFailureReason(error: Error): SsoFailureReason {
    const message = String(error.message || '');
    if (error.name === 'TokenExpiredError') return 'expired_token';
    if (/issuer/i.test(message)) return 'invalid_issuer';
    if (/audience/i.test(message)) return 'invalid_audience';
    if (/signature/i.test(message)) return 'bad_signature';
    return 'id_token_validation_failed';
  }

  private fail(reason: SsoFailureReason, error: Error): never {
    (error as any)[SSO_REASON_KEY] = reason;
    throw error;
  }

  private configValue(key: string): string | undefined {
    const value = this.config.get<string>(key) ?? process.env[key];
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || undefined;
  }
}
