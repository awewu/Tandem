/**
 * GET /api/auth/wechat/qr
 *
 * 生成微信扫码 ticket + qrUrl. 未配置微信开放平台 → 501 not_configured (诚实).
 */
import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { createWechatQr, WechatLoginError } from '@/lib/auth/wechat-login';

export const runtime = 'nodejs';

export async function GET() {
  await boot();
  try {
    const ticket = await createWechatQr();
    return NextResponse.json({ ok: true, ...ticket });
  } catch (err) {
    if (err instanceof WechatLoginError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
