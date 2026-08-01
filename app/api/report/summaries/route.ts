import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getStore } from '@/lib/storage/repository';
import type { ReportSummary, ReportSummaryOkrRow, ReportSummaryPeriodType } from '@/lib/types/report-summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeViewerIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).map((id) => id.trim()).filter(Boolean))).slice(0, 100);
}

function normalizeVisibility(value: unknown): ReportSummary['visibility'] {
  return value === 'selected' || value === 'public' ? value : 'private';
}

function canViewSummary(summary: ReportSummary, auth: AuthContext): boolean {
  if (summary.authorId === auth.userId) return true;
  if (auth.demo) return true;
  if (summary.visibility === 'public') return true;
  if (summary.visibility === 'selected') return summary.viewerIds.includes(auth.userId);
  return false;
}

function normalizePeriodType(value: unknown): ReportSummaryPeriodType | null {
  return value === 'weekly' || value === 'monthly' ? value : null;
}

function normalizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : fallback;
}

function normalizeProgress(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeCount(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(numeric)));
}

function normalizeOkrRows(value: unknown): ReportSummaryOkrRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row): ReportSummaryOkrRow | null => {
      if (!row || typeof row !== 'object') return null;
      const source = row as Record<string, unknown>;
      const kind = source.kind === 'objective' || source.kind === 'kr' ? source.kind : null;
      const objectiveId = normalizeText(source.objectiveId);
      const objectiveTitle = normalizeText(source.objectiveTitle);
      if (!kind || !objectiveId || !objectiveTitle) return null;
      const confidence =
        source.confidence === 'on-track' || source.confidence === 'at-risk' || source.confidence === 'off-track'
          ? source.confidence
          : 'on-track';
      return {
        id: normalizeText(source.id, `${kind}:${objectiveId}`),
        kind,
        objectiveId,
        objectiveTitle,
        keyResultId: normalizeText(source.keyResultId) || undefined,
        keyResultTitle: normalizeText(source.keyResultTitle) || undefined,
        progress: normalizeProgress(source.progress),
        confidence,
        content: normalizeText(source.content),
        reportCount: normalizeCount(source.reportCount),
      };
    })
    .filter((row): row is ReportSummaryOkrRow => row != null)
    .slice(0, 200);
}

function summaryId(tenantId: string, authorId: string, periodType: ReportSummaryPeriodType, periodKey: string): string {
  return `${tenantId}:${authorId}:${periodType}:${periodKey}`;
}

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const tenantId = auth.tenantId ?? 'default';
    const { searchParams } = new URL(req.url);
    const periodType = searchParams.get('periodType');
    const store = getStore();
    const summaries = (await store.reportSummaries.list({ tenantId }))
      .filter((summary) => !periodType || summary.periodType === periodType)
      .filter((summary) => canViewSummary(summary, auth))
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

    return NextResponse.json({ ok: true, summaries });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'summary_list_failed', message: (error as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/report/summaries' });

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const periodType = normalizePeriodType(body.periodType);
  const periodKey = normalizeText(body.periodKey);
  const periodLabel = normalizeText(body.periodLabel);
  const reportDate = normalizeText(body.reportDate);
  if (!periodType || !periodKey || !periodLabel || !reportDate) {
    return NextResponse.json({ ok: false, error: 'periodType, periodKey, periodLabel and reportDate are required' }, { status: 400 });
  }

  try {
    const tenantId = auth.tenantId ?? 'default';
    const store = getStore();
    const now = new Date().toISOString();
    const id = summaryId(tenantId, auth.userId, periodType, periodKey);
    const existing = await store.reportSummaries.get(id);
    const base = {
      tenantId,
      authorId: auth.userId,
      periodType,
      periodKey,
      periodLabel,
      reportDate,
      sourceReportCount: normalizeCount(body.sourceReportCount),
      okrRows: normalizeOkrRows(body.okrRows),
      workSummary: normalizeText(body.workSummary),
      okrProgress: normalizeText(body.okrProgress),
      achievements: normalizeText(body.achievements),
      blockers: normalizeText(body.blockers),
      nextPlan: normalizeText(body.nextPlan),
      supportNeeded: normalizeText(body.supportNeeded),
      visibility: normalizeVisibility(body.visibility),
      viewerIds: normalizeViewerIds(body.viewerIds),
      status: 'published' as const,
      publishedAt: now,
      updatedAt: now,
    };

    const summary = existing
      ? await store.reportSummaries.update(id, base)
      : await store.reportSummaries.create({ id, ...base, createdAt: now });

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'summary_publish_failed', message: (error as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/report/summaries' });
