/**
 * SSO Auth · 企业微信 / 钉钉 / 飞书 OAuth 登录
 *
 * 基于自研 Auth 系统扩展，不引入 NextAuth。
 * 流程: 前端点击 SSO → 后端返回 auth URL → 用户授权 → 回调 → 后端换 token → 查/创 User → 发 Session
 */

import { randomBytes } from 'crypto';
import { getStore } from '../storage/repository';
import { issueRefreshToken, signAccessToken, type SessionPayload } from './session';

export type SsoProvider = 'wecom' | 'dingtalk' | 'feishu';

interface SsoConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope?: string;
  /** 部分平台用 app_id / app_secret 而非 client_id / client_secret */
  idParam?: string;
  secretParam?: string;
}

function getConfig(provider: SsoProvider): SsoConfig | null {
  switch (provider) {
    case 'wecom':
      if (!process.env.WECOM_CLIENT_ID || !process.env.WECOM_CLIENT_SECRET) return null;
      return {
        clientId: process.env.WECOM_CLIENT_ID,
        clientSecret: process.env.WECOM_CLIENT_SECRET,
        authUrl: 'https://open.work.weixin.qq.com/wwopen/sso/qrConnect',
        tokenUrl: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
        userInfoUrl: 'https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo',
        scope: 'snsapi_base',
      };
    case 'dingtalk':
      if (!process.env.DINGTALK_CLIENT_ID || !process.env.DINGTALK_CLIENT_SECRET) return null;
      return {
        clientId: process.env.DINGTALK_CLIENT_ID,
        clientSecret: process.env.DINGTALK_CLIENT_SECRET,
        authUrl: 'https://login.dingtalk.com/oauth2/auth',
        tokenUrl: 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken',
        userInfoUrl: 'https://api.dingtalk.com/v1.0/contact/users/me',
        scope: 'openid',
      };
    case 'feishu':
      if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) return null;
      return {
        clientId: process.env.FEISHU_APP_ID,
        clientSecret: process.env.FEISHU_APP_SECRET,
        authUrl: 'https://open.feishu.cn/open-apis/authen/v1/index',
        tokenUrl: 'https://open.feishu.cn/open-apis/authen/v1/access_token',
        userInfoUrl: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
        scope: 'auth_user',
        idParam: 'app_id',
        secretParam: 'app_secret',
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Step 1: 生成授权 URL (PKCE 简化版: state 防 CSRF)
// ---------------------------------------------------------------------------

export function buildAuthUrl(provider: SsoProvider, redirectUri: string): { url: string; state: string } | null {
  const cfg = getConfig(provider);
  if (!cfg) return null;

  const state = randomBytes(16).toString('hex');
  const url = new URL(cfg.authUrl);

  switch (provider) {
    case 'wecom': {
      url.searchParams.set('appid', cfg.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('scope', cfg.scope ?? 'snsapi_base');
      break;
    }
    case 'dingtalk': {
      url.searchParams.set('client_id', cfg.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', cfg.scope ?? 'openid');
      url.searchParams.set('state', state);
      url.searchParams.set('prompt', 'consent');
      break;
    }
    case 'feishu': {
      url.searchParams.set('app_id', cfg.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      break;
    }
  }

  return { url: url.toString(), state };
}

// ---------------------------------------------------------------------------
// Step 2: 回调处理 — 用 code 换 token → 查用户信息 → 查/创 User → 发 Session
// ---------------------------------------------------------------------------

export interface SsoUserInfo {
  subjectId: string;
  name: string;
  email?: string;
  avatar?: string;
}

export async function handleSsoCallback(
  provider: SsoProvider,
  code: string,
  state: string,
  storedState: string
): Promise<{ session: Omit<SessionPayload, 'iat' | 'exp'>; accessToken: string; refreshToken: string }> {
  if (state !== storedState) {
    throw new Error('Invalid state parameter');
  }

  const cfg = getConfig(provider);
  if (!cfg) throw new Error('SSO provider not configured');

  // 1. 换 access_token
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      provider === 'feishu'
        ? { grant_type: 'authorization_code', code, app_id: cfg.clientId, app_secret: cfg.clientSecret }
        : provider === 'dingtalk'
        ? { clientId: cfg.clientId, clientSecret: cfg.clientSecret, code, grantType: 'authorization_code' }
        : { corpid: cfg.clientId, corpsecret: cfg.clientSecret }
    ),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }
  const tokenData = await tokenRes.json();

  // 2. 查用户信息
  const userInfo = await fetchUserInfo(provider, cfg, tokenData);

  // 3. 查/创 User
  const store = getStore().auth;
  const existing = await store.users.list();
  let user = existing.find((u) => {
    const bindings = (u.ssoBindings ?? {}) as Record<string, string>;
    return bindings[provider] === userInfo.subjectId;
  });

  if (!user && userInfo.email) {
    user = existing.find((u) => u.email.toLowerCase() === userInfo.email!.toLowerCase());
    if (user) {
      // 绑定 SSO 到已有邮箱账号
      await store.users.update(user.id, {
        ssoBindings: { ...(user.ssoBindings as any), [provider]: userInfo.subjectId },
      });
    }
  }

  if (!user) {
    // 自动创建用户 (SSO 首次登录)
    user = await store.users.create({
      email: userInfo.email ?? `${userInfo.subjectId}@${provider}.local`,
      name: userInfo.name,
      tenantId: 'default',
      roles: ['member'],
      ssoBindings: { [provider]: userInfo.subjectId },
    });
  }

  // 4. 创建 Session
  const session: Omit<SessionPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    roles: user.roles ?? [],
    tenantId: user.tenantId ?? 'default',
    workspaceId: user.workspaceId ?? undefined,
    mfa: true, // SSO 登录视为已验证
    sid: randomBytes(16).toString('hex'),
  };
  const accessToken = signAccessToken(session);
  const { refreshToken, refreshTokenHash } = await issueRefreshToken();

  await store.sessions.create({
    userId: user.id,
    refreshTokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    mfaVerified: true,
    userAgent: null,
    ip: null,
  });

  return { session, accessToken, refreshToken };
}

async function fetchUserInfo(provider: SsoProvider, cfg: SsoConfig, tokenData: any): Promise<SsoUserInfo> {
  switch (provider) {
    case 'dingtalk': {
      const accessToken = tokenData.accessToken;
      const res = await fetch(cfg.userInfoUrl, {
        headers: { 'x-acs-dingtalk-access-token': accessToken },
      });
      const data = await res.json();
      return {
        subjectId: data.unionId ?? data.openId,
        name: data.nick ?? data.name ?? '钉钉用户',
        email: data.email,
        avatar: data.avatarUrl,
      };
    }
    case 'wecom': {
      // 企微需要先用 access_token 换 userid，再用 userid 查详情
      const accessToken = tokenData.access_token;
      // 简化: 企微的 OAuth 流程较复杂，V1 先返回基础信息
      return {
        subjectId: tokenData.userid ?? 'unknown',
        name: '企微用户',
      };
    }
    case 'feishu': {
      const accessToken = tokenData.data?.access_token;
      const res = await fetch(cfg.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      return {
        subjectId: data.data?.union_id ?? data.data?.open_id,
        name: data.data?.name ?? '飞书用户',
        email: data.data?.email,
        avatar: data.data?.avatar_url,
      };
    }
    default:
      throw new Error('Unsupported provider');
  }
}

// ---------------------------------------------------------------------------
// State 缓存 (V1 内存, V2 Redis)
// ---------------------------------------------------------------------------

const _stateCache = new Map<string, { provider: SsoProvider; redirectUri: string; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10min

export function storeSsoState(state: string, provider: SsoProvider, redirectUri: string): void {
  _stateCache.set(state, { provider, redirectUri, createdAt: Date.now() });
  // 清理过期
  for (const [k, v] of Array.from(_stateCache.entries())) {
    if (Date.now() - v.createdAt > STATE_TTL_MS) _stateCache.delete(k);
  }
}

export function getSsoState(state: string): { provider: SsoProvider; redirectUri: string } | null {
  const v = _stateCache.get(state);
  if (!v) return null;
  if (Date.now() - v.createdAt > STATE_TTL_MS) {
    _stateCache.delete(state);
    return null;
  }
  return { provider: v.provider, redirectUri: v.redirectUri };
}
