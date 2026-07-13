/**
 * GET /api/admin/training/export · CA-11 L2 训练语料导出出口
 *
 * 把 `buildTrainingDataset()` 产出的 SFT/DPO 语料下发为可下载的 JSONL,
 * 或返回统计摘要。仅经营层 (owner/admin) 可用。见 docs/CA-11-IQ-SOVEREIGNTY.md。
 *
 * Query:
 *   format   = 'stats' (默认) | 'sft' | 'dpo'
 *   since    = UTC ISO, 只取该时间后的决策 (可选)
 *   limit    = 最多扫描决策条数 (可选)
 *   implicit = '1' 纳入隐式默许样本 (默认剔除)
 *   lessons  = '1' 导出 reflexion 个人教训 (默认不导, 决策防火墙)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  buildTrainingDataset,
  sftToJsonl,
  dpoToJsonl,
} from '@/lib/training/dataset-builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['owner', 'admin'];

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const ok = auth.demo || auth.roles.some((r) => ALLOWED_ROLES.includes(r));
  if (!ok) {
    return NextResponse.json(
      { error: 'forbidden · 仅 owner/admin 可导出训练语料' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') ?? 'stats').toLowerCase();
  const since = searchParams.get('since') ?? undefined;
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10) || 0) || undefined : undefined;
  const includeImplicit = searchParams.get('implicit') === '1';
  const includeReflexionLessons = searchParams.get('lessons') === '1';

  const result = await buildTrainingDataset({
    tenantId: auth.tenantId,
    since,
    limit,
    includeImplicit,
    includeReflexionLessons,
  });

  if (format === 'sft' || format === 'dpo') {
    const jsonl = format === 'sft' ? sftToJsonl(result.sft) : dpoToJsonl(result.dpo);
    const filename = `tandem-${format}-${new Date().toISOString().slice(0, 10)}.jsonl`;
    return new NextResponse(jsonl, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({
    stats: result.stats,
    counts: { sft: result.sft.length, dpo: result.dpo.length },
    hint: '加 ?format=sft 或 ?format=dpo 下载对应 JSONL; ?implicit=1 纳入隐式; ?lessons=1 导出个人教训(personal)',
  });
}
