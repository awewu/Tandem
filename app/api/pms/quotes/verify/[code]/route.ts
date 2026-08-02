/**
 * PMS API · 报价单公开验真 (零登录, 只回真伪 + 授权经销商, 不露价)
 *
 * 客户扫码/输码即查, 无需认证。恶意低价的报价在此"查无此报价"或显示授权方≠转发方 → 失效。
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { verifyQuote } from '@/lib/pms/quote-service';
import { isValidVerifyCodeFormat } from '@/lib/pms/quote-calc';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  await boot();
  try {
    const { code } = await params;
    const normalized = (code || '').trim().toUpperCase();
    if (!isValidVerifyCodeFormat(normalized)) {
      return NextResponse.json(
        { valid: false, verifyCode: code, message: '验真码格式不正确' },
        { status: 200 },
      );
    }
    const view = await verifyQuote(normalized);
    return NextResponse.json(view);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Failed' }, { status: 500 });
  }
}
