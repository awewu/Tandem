/**
 * WeChat Login · 微信扫码登录 (业务逻辑)
 *
 * 流程:
 *   createWechatQr()           → 调 WechatProvider 生成扫码 ticket + qrUrl
 *   pollWechatScan(ticket)     → 轮询扫码状态; confirmed 时按 unionid 找/建用户 → 发 session
 *
 * 未配置微信开放平台 → 抛 not_configured (501), 诚实不伪造.
 */

import { getStore } from '@/lib/storage/repository';
import { issueSessionForExternalLogin, type AuthResult } from './native';
import { DEFAULT_EXTERNAL_ROLES } from './roles';
import { getWechatProvider, type WechatQrTicket, type WechatScanState } from './wechat-provider';
import { getWechatBinding, setWechatBinding } from './identity-store';

export class WechatLoginError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = 'WechatLoginError';
  }
}

export async function createWechatQr(): Promise<WechatQrTicket> {
  const provider = getWechatProvider();
  if (!provider) {
    throw new WechatLoginError('not_configured', '微信扫码登录待配置 (.env: WECHAT_APP_ID / WECHAT_APP_SECRET)', 501);
  }
  return provider.createQrTicket();
}

export interface WechatPollResult {
  state: WechatScanState;
  /** 仅 confirmed 时返回 (调用方据此设 cookie) */
  session?: AuthResult;
}

export async function pollWechatScan(
  ticket: string,
  deviceInfo?: { userAgent?: string; ip?: string },
): Promise<WechatPollResult> {
  const provider = getWechatProvider();
  if (!provider) {
    throw new WechatLoginError('not_configured', '微信扫码登录待配置 (.env: WECHAT_APP_ID / WECHAT_APP_SECRET)', 501);
  }
  if (!ticket) throw new WechatLoginError('invalid_ticket', '缺少 ticket', 400);

  const state = await provider.checkScan(ticket);
  if (state.status !== 'confirmed') {
    return { state };
  }

  // confirmed → 按 unionid 找/建用户
  const userStore = getStore().auth.users;
  const binding = await getWechatBinding(state.unionId);
  let userId: string;
  if (binding) {
    userId = binding.userId;
  } else {
    // §上下游: 个人微信扫码 = 未归属外部访客, 绝不默认 employee/default 内部身份。
    // 落到 membershipType='pending' (待上游/管理员归属到某下游组织), 最小权限 guest。
    const created = await userStore.create({
      email: `wx_${state.unionId.slice(0, 16)}@wechat.tandem.local`,
      name: state.nickname ?? '微信用户',
      roles: [...DEFAULT_EXTERNAL_ROLES],
      tenantId: 'default',
      orgId: null,
      membershipType: 'pending',
      emailVerifiedAt: new Date().toISOString(),
    });
    userId = created.id;
    await setWechatBinding(state.unionId, userId);
  }

  const user = await userStore.findById(userId);
  if (!user) throw new WechatLoginError('user_gone', '用户不存在', 500);

  const session = await issueSessionForExternalLogin(
    { id: user.id, email: user.email, roles: user.roles, tenantId: user.tenantId },
    deviceInfo,
  );
  return { state, session };
}
