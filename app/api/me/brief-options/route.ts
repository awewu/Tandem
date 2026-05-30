/**
 * GET  /api/me/brief-options
 *
 * 主分身 brief 推荐 · 3+1 通用化 P1-a 接入
 *   - 入参 (query 或 body 都不要, 自动从 dashboard 聚合)
 *   - 出参: { options: DecisionOption[4], warnings: string[] }
 *
 * 输入 = 当前用户的"待推进信号" (KR 风险 / 升级 / 签字 / 否决窗口 / 复盘)
 * 输出 = A/B/C/D 4 个 "今天先做哪个" 建议
 *
 * P1-b: 用户选了 D, 客户端再 POST /api/me/brief-commit 落 audit (本 PR 不做).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { generatePersonaBriefOptions, type PersonaBriefContext } from '@/lib/decision-layer/adapters/persona-brief';
import { StoreBackedMemoryRetriever } from '@/lib/memory/retriever';
import { deferAudit } from '@/lib/audit/defer';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();

  // 1. 收集"待推进项"作为 brief 输入信号
  const pendingItems: PersonaBriefContext['pendingItems'] = [];

  try {
    const krs = await store.keyResults.list();
    krs
      .filter((kr) => kr.ownerId === auth.userId && kr.riskStatus && kr.riskStatus !== 'on_track')
      .slice(0, 3)
      .forEach((kr) => {
        pendingItems.push({
          kind: 'KR',
          title: kr.title,
          urgency: kr.riskStatus === 'at_risk' ? 'high' : 'medium',
        });
      });
  } catch { /* fail-open */ }

  try {
    const ttis = await store.ttis.list();
    ttis
      .filter((t) => t.ownerId === auth.userId && t.completionRate !== undefined && t.completionRate < 1)
      .slice(0, 3)
      .forEach((t) => {
        pendingItems.push({
          kind: 'TTI',
          title: t.title,
          urgency: 'medium',
        });
      });
  } catch { /* fail-open */ }

  try {
    const cards = await store.decisionCards.list();
    cards
      .filter((c) => c.createdBy === auth.userId && c.convergenceState === 'DIVERGE')
      .slice(0, 2)
      .forEach((c) => {
        pendingItems.push({
          kind: '议事',
          title: c.title,
          urgency: 'medium',
        });
      });
  } catch { /* fail-open */ }

  if (pendingItems.length === 0) {
    return NextResponse.json({
      options: [],
      warnings: ['当前没有强信号 · 没必要给 4 选项, 你可以自己决定'],
      empty: true,
    });
  }

  // 2. 调引擎
  try {
    const router = getRouter();
    const retriever = new StoreBackedMemoryRetriever();
    const result = await generatePersonaBriefOptions(router, retriever, {
      briefId: `brief-${auth.userId}-${Date.now()}`,
      pendingItems,
      actorUserId: auth.userId,
    });

    deferAudit('persona_brief.options_generated', auth.userId, {
      tenantId: auth.tenantId,
      metadata: {
        signalCount: pendingItems.length,
        warningCount: result.warnings.length,
      },
    });

    return NextResponse.json({
      options: result.options,
      warnings: result.warnings,
      empty: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? '生成失败', options: [], warnings: [] },
      { status: 500 }
    );
  }
}
