/**
 * Phone Login · 手机号 + 短信验证码登录 (业务逻辑)
 *
 * 流程:
 *   sendPhoneCode(phone)  → 生成 6 位 OTP, 存 hash (5min TTL), 调 SmsProvider 下发
 *   verifyPhoneCode(...)  → 校验 OTP → 找/建用户 (按手机绑定) → 复用统一会话签发
 *
 * 未配置短信服务商 → 抛 not_configured (501), 诚实不伪造.
 * OTP 仅存 hash, 5 次尝试上限, 过期即废.
 */

import { getStore } from '@/lib/storage/repository';
import { issueSessionForExternalLogin, type AuthResult } from './native';
import { DEFAULT_EXTERNAL_ROLES } from './roles';
import { getSmsProvider } from './sms-provider';
import {
  saveOtp,
  getOtp,
  bumpOtpAttempts,
  clearOtp,
  hashOtp,
  getPhoneBinding,
  setPhoneBinding,
} from './identity-store';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export class PhoneLoginError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = 'PhoneLoginError';
  }
}

function normPhone(p: string): string {
  return (p ?? '').replace(/\D/g, '');
}

function gen6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 下发验证码. 未配置短信服务 → not_configured (501). dev log provider 回传 devCode 供联调. */
export async function sendPhoneCode(phoneRaw: string): Promise<{ sent: true; devCode?: string }> {
  const phone = normPhone(phoneRaw);
  if (phone.length < 6) throw new PhoneLoginError('invalid_phone', '手机号格式错误', 400);

  const provider = getSmsProvider();
  if (!provider) {
    throw new PhoneLoginError('not_configured', '短信登录服务待配置 (.env: SMS_PROVIDER)', 501);
  }

  const code = gen6();
  await saveOtp(phone, code, OTP_TTL_MS);
  await provider.sendVerificationCode(phone, code);

  return { sent: true, devCode: provider.name === 'log' ? code : undefined };
}

/** 校验验证码 → 找/建用户 → 发 session. */
export async function verifyPhoneCode(
  phoneRaw: string,
  codeRaw: string,
  deviceInfo?: { userAgent?: string; ip?: string },
): Promise<AuthResult> {
  const phone = normPhone(phoneRaw);
  const code = (codeRaw ?? '').replace(/\D/g, '');
  if (phone.length < 6 || code.length < 4) {
    throw new PhoneLoginError('invalid_input', '手机号或验证码格式错误', 400);
  }

  const otp = await getOtp(phone);
  if (!otp) throw new PhoneLoginError('no_code', '请先获取验证码', 400);
  if (Date.now() > otp.expiresAt) {
    await clearOtp(phone);
    throw new PhoneLoginError('expired', '验证码已过期, 请重新获取', 400);
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await clearOtp(phone);
    throw new PhoneLoginError('too_many', '尝试次数过多, 请重新获取验证码', 429);
  }
  if (hashOtp(phone, code) !== otp.codeHash) {
    await bumpOtpAttempts(phone, otp);
    throw new PhoneLoginError('wrong_code', '验证码错误', 401);
  }
  await clearOtp(phone);

  // 找/建用户 (按手机绑定)
  const userStore = getStore().auth.users;
  const binding = await getPhoneBinding(phone);
  let userId: string;
  if (binding) {
    userId = binding.userId;
  } else {
    // §上下游: 手机 OTP 新用户 = 未归属外部访客, 绝不默认 employee/default 内部身份。
    // 落到 membershipType='pending' (待上游/管理员归属到某下游组织), 最小权限 guest。
    const created = await userStore.create({
      email: `${phone}@phone.tandem.local`,
      name: `用户${phone.slice(-4)}`,
      roles: [...DEFAULT_EXTERNAL_ROLES],
      tenantId: 'default',
      orgId: null,
      membershipType: 'pending',
      emailVerifiedAt: new Date().toISOString(),
    });
    userId = created.id;
    await setPhoneBinding(phone, userId);
  }

  const user = await userStore.findById(userId);
  if (!user) throw new PhoneLoginError('user_gone', '用户不存在', 500);

  return issueSessionForExternalLogin(
    { id: user.id, email: user.email, roles: user.roles, tenantId: user.tenantId },
    deviceInfo,
  );
}
