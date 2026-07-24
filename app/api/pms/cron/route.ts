/**
 * PMS API · 定时任务触发 (每日扫描)
 *
 * POST  运行每日扫描 (公海释放 + 资质/保修到期预警 + 告警升级)
 *   鉴权二选一:
 *     - Header x-cron-secret 匹配 process.env.CRON_SECRET (供外部调度器)
 *     - 或 已登录内部用户 (手动触发)
 *   body: { tenantId? } 默认 'default'
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { runPmsDailyScan } from '@/lib/pms/cron-service';

/** 校验调度器密钥: 支持 x-cron-secret 或 Authorization: Bearer (Vercel cron) */
function cronSecretOk(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const header = req.headers.get('x-cron-secret');
  const bearer = req.headers.get('authorization');
  return header === cronSecret || bearer === `Bearer ${cronSecret}`;
}

/**
 * GET — 供 Vercel Cron 调用 (自动带 Authorization: Bearer CRON_SECRET).
 * 仅密钥鉴权, 无用户回退. tenantId 固定 'default'.
 */
export async function GET(req: NextRequest) {
  await boot();
  if (!cronSecretOk(req)) {
    return NextResponse.json({ error: 'unauthorized: invalid cron secret' }, { status: 401 });
  }
  try {
    const summary = await runPmsDailyScan('default');
    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Cron scan error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await boot();

  const secretOk = cronSecretOk(req);

  if (!secretOk) {
    // 回退到内部用户鉴权
    let auth: PmsAuthResult;
    try {
      auth = await requirePmsAuth(req);
    } catch (e) {
      if (e instanceof Response) return e;
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!auth.isInternal) {
      return NextResponse.json({ error: 'forbidden: cron requires internal role or cron secret' }, { status: 403 });
    }
  }

  try {
    let tenantId = 'default';
    try {
      const body = await req.json();
      if (body && typeof body.tenantId === 'string' && body.tenantId) tenantId = body.tenantId;
    } catch {
      // 无 body 时使用默认租户
    }
    const summary = await runPmsDailyScan(tenantId);
    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Cron scan error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
