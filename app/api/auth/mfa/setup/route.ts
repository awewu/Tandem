import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { COOKIE_ACCESS, verifyAccessToken } from '@/lib/auth/session';
import { getStore } from '@/lib/storage/repository';
import {
  generateEnrollment,
  encryptSecret,
  hashRecoveryCode,
  verifyTotp,
  decryptSecret,
} from '@/lib/auth/mfa';

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
    return NextResponse.json({
      ok: true,
      stage: 'pending_verify',
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

  return NextResponse.json({ ok: true, stage: 'enrolled' });
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
