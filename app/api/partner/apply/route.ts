import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { rateLimit, getClientIp } from '@/lib/infra/rate-limit';

/**
 * POST /api/partner/apply
 *
 * 合作伙伴开通申请。
 * - 无需登录
 * - 写入审计日志，方便管理员在 /admin/partner 查看并发放邀请码
 * Body: { name, company, email, reason }
 */
export async function POST(req: NextRequest) {
  await boot();
  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `partner-apply:${ip}`, limit: 5, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'too many attempts' }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const name    = String(body.name    ?? '').trim();
  const company = String(body.company ?? '').trim();
  const email   = String(body.email   ?? '').trim();
  const reason  = String(body.reason  ?? '').trim();

  if (!name || !company || !email || !reason) {
    return NextResponse.json({ ok: false, error: 'name, company, email, reason 均为必填' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: '邮箱格式错误' }, { status: 400 });
  }

  // 写入审计日志，管理员在后台查看并处理
  try {
    await getStore().auth.events.append({
      eventType: 'partner_apply',
      email,
      metadata: { name, company, reason, ip },
    });
  } catch {
    // 审计失败不阻塞
  }

  return NextResponse.json({ ok: true, message: '申请已提交，请等待审核' });
}
