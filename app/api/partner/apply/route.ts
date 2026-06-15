import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { rateLimit, getClientIp } from '@/lib/infra/rate-limit';
import { submitApplication, ApplicationError } from '@/lib/auth/applications';

/**
 * POST /api/partner/apply
 *
 * 合作伙伴开通申请。
 * - 无需登录
 * - 经 submitApplication 进入 authApplications 审批队列 (与 Owner/Admin 后台
 *   /admin/user-applications 同一队列), 审批通过即生成单次邀请码 → 申请人凭码注册。
 *   此前本入口仅写一条 partner_apply 审计、未入队列 → 管理员看不到 (断头路 D), 现已接通。
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

  try {
    const application = await submitApplication({
      email,
      name,
      reason,
      organization: company,
      deviceInfo: { ip: ip ?? undefined, userAgent: req.headers.get('user-agent') ?? undefined },
    });

    // 兼容旧 /admin/partner 视图: 保留 partner_apply 审计事件 (附 applicationId 便于关联)
    try {
      await getStore().auth.events.append({
        eventType: 'partner_apply',
        email,
        metadata: { name, company, reason, ip, applicationId: application.id },
      });
    } catch {
      // 审计失败不阻塞
    }

    return NextResponse.json({ ok: true, message: '申请已提交，请等待审核', applicationId: application.id });
  } catch (err) {
    if (err instanceof ApplicationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
