import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import {
  COOKIE_ACCESS,
  SESSION_COOKIE_OPTIONS,
  signAccessToken,
  verifyAccessToken,
} from '@/lib/auth/session';
import { getStore } from '@/lib/storage/repository';
import {
  generateEnrollment,
  encryptSecret,
  hashRecoveryCode,
  verifyTotp,
  decryptSecret,
} from '@/lib/auth/mfa';
import QRCode from 'qrcode';

/**
 * POST /api/auth/mfa/setup
 *
 * 两阶段流程:
 *   1. 不带 totpCode  → 生成 secret, 返回 otpauthUri + recoveryCodes (一次)
 *      (此时不写库, 客户端拿着 secret 让用户扫码)
 *   2. 带 { secretBase32, totpCode } → 校验 totpCode 后入库 */
export async function POST(req: NextRequest) {
  await boot();
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    secretBase32?: string;
    recoveryCodes?: string[];
    totpCode?: string;
  };

  // 阶段 1: 生成
  if (!body.secretBase32) {
    const m = generateEnrollment(payload.email);
    const qrDataUrl = await QRCode.toDataURL(m.otpauthUri, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    return NextResponse.json({
      ok: true,
      stage: 'pending_verify',
      qrDataUrl,
      ...m,
    });
  }

  // 阶段 2: 校验并入库
  if (!body.totpCode || !body.recoveryCodes) {
    return NextResponse.json(
      { ok: false, error: '需要 secretBase32 + totpCode + recoveryCodes' },
      { status: 400 }
    );
  }
  const ok = verifyTotp(body.secretBase32, body.totpCode);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'TOTP 验证失败, 请重新扫码' }, { status: 401 });
  }

  await getStore().auth.users.saveMfaSecret(
    payload.sub,
    encryptSecret(body.secretBase32),
    body.recoveryCodes.map(hashRecoveryCode)
  );

  await getStore().auth.events.append({
    userId: payload.sub,
    eventType: 'mfa_enrolled',
  });

  // P0-C: 启用成功后立即重签 token, 清除 pendingMfaEnroll 标记 (TOTP 已验证 → mfa: true),
  //   否则 middleware 硬门会继续挡用户最多 15 分钟 (至旧 token 过期).
  const res = NextResponse.json({ ok: true, stage: 'enrolled' });
  const freshToken = signAccessToken({
    sub: payload.sub,
    email: payload.email,
    roles: payload.roles,
    tenantId: payload.tenantId,
    mfa: true,
    pendingMfaEnroll: false,
    sid: payload.sid,
  });
  res.cookies.set(COOKIE_ACCESS, freshToken, { ...SESSION_COOKIE_OPTIONS, maxAge: 15 * 60 });
  return res;
}

/**
 * GET /api/auth/mfa/setup
 * 查询当前 MFA 状态 */
export async function GET(req: NextRequest) {
  await boot();
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const m = await getStore().auth.users.findMfaSecret(payload.sub);
  return NextResponse.json({
    enrolled: !!m,
    recoveryCodesRemaining: m?.recoveryCodeHashes.length ?? 0,
    sessionMfaVerified: payload.mfa,
  });
}

/**
 * 触发触发: 解密一次自检 (仅 dev 用, 生产移除)
 * Use only for testing; remove in prod hardening.
 */
export const _internal = { decryptSecret };
