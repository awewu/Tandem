/**
 * Auth.js (NextAuth v5) 配置 · SSO 接入
 *
 * 启用步骤:
 *   1. npm i next-auth@beta
 *   2. 在 .env.local 配置:
 *      NEXTAUTH_SECRET=...
 *      DINGTALK_CLIENT_ID / DINGTALK_CLIENT_SECRET
 *      WECOM_CLIENT_ID / WECOM_CLIENT_SECRET
 *      FEISHU_APP_ID / FEISHU_APP_SECRET
 *   3. 在 app/api/auth/[...nextauth]/route.ts 加:
 *      import { handlers } from '@/lib/auth/config';
 *      export const { GET, POST } = handlers;
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AuthConfig {
  providers: AuthProvider[];
  session: { strategy: 'jwt' | 'database'; maxAge: number };
  callbacks?: AuthCallbacks;
}

export interface AuthProvider {
  id: 'dingtalk' | 'wecom' | 'feishu' | 'credentials';
  name: string;
  type: 'oauth' | 'credentials';
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
}

export interface AuthCallbacks {
  signIn?: (user: SessionUser) => Promise<boolean>;
  session?: (session: Session, user: SessionUser) => Promise<Session>;
}

export interface SessionUser {
  id: string;
  name: string;
  email?: string;
  image?: string;
  /** 钉钉 unionId / 企微 userid / 飞书 union_id */
  ssoProvider: 'dingtalk' | 'wecom' | 'feishu' | 'credentials';
  ssoSubjectId: string;
  /** 多租户 ID */
  tenantId: string;
  roles: string[];
}

export interface Session {
  user: SessionUser;
  expires: string;
}

// ---------------------------------------------------------------------------
// 钉钉 OAuth
// ---------------------------------------------------------------------------

export const DingTalkProvider: AuthProvider = {
  id: 'dingtalk',
  name: '钉钉',
  type: 'oauth',
  clientId: process.env.DINGTALK_CLIENT_ID,
  clientSecret: process.env.DINGTALK_CLIENT_SECRET,
  authorizationUrl: 'https://login.dingtalk.com/oauth2/auth',
  tokenUrl: 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken',
  userInfoUrl: 'https://api.dingtalk.com/v1.0/contact/users/me',
};

// ---------------------------------------------------------------------------
// 企业微信 OAuth
// ---------------------------------------------------------------------------

export const WeComProvider: AuthProvider = {
  id: 'wecom',
  name: '企业微信',
  type: 'oauth',
  clientId: process.env.WECOM_CLIENT_ID,
  clientSecret: process.env.WECOM_CLIENT_SECRET,
  authorizationUrl: 'https://open.work.weixin.qq.com/wwopen/sso/qrConnect',
  tokenUrl: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
  userInfoUrl: 'https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo',
};

// ---------------------------------------------------------------------------
// 飞书 OAuth
// ---------------------------------------------------------------------------

export const FeishuProvider: AuthProvider = {
  id: 'feishu',
  name: '飞书',
  type: 'oauth',
  clientId: process.env.FEISHU_APP_ID,
  clientSecret: process.env.FEISHU_APP_SECRET,
  authorizationUrl: 'https://open.feishu.cn/open-apis/authen/v1/index',
  tokenUrl: 'https://open.feishu.cn/open-apis/authen/v1/access_token',
  userInfoUrl: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
};

// ---------------------------------------------------------------------------
// 完整配置 (NextAuth)
// ---------------------------------------------------------------------------

export const authConfig: AuthConfig = {
  providers: [DingTalkProvider, WeComProvider, FeishuProvider],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn(user) {
      // 创建/更新 User + 自动创建 Persona (newborn 阶段)
      // 调用 lib/persona/evolution.ts:createPersona
      return true;
    },
    async session(session, user) {
      // 注入 tenantId / roles
      session.user.tenantId = (user as any).tenantId ?? 'default';
      session.user.roles = (user as any).roles ?? [];
      return session;
    },
  },
};

// 占位: 实际 NextAuth handlers (启用后取消注释)
// import NextAuth from 'next-auth';
// export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
