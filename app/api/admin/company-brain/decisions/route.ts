/**
 * GET /api/admin/company-brain/decisions
 *
 * §CA-13 (CENTRAL-AI-ARCHITECTURE.md) · 治理委员会查 CompanyBrain Decision 历史
 *
 * Query:
 *   ?context=im_reply|baseline_arbitration|...
 *   ?outcome=pending|adopted|modified|overruled|ignored
 *   ?since=ISO_DATE
 *   ?limit=100 (默认 100, max 500)
 *   ?brainVersion=N
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { listDecisions } from '@/lib/persona/company-brain-decision';
import type {
  CompanyBrainDecisionContext,
  CompanyBrainFeedbackOutcome,
} from '@/lib/types/company-brain';

export const runtime = 'nodejs';

const ALLOWED_CONTEXTS: CompanyBrainDecisionContext[] = [
  'im_reply',
  'baseline_arbitration',
  'meeting_advice',
  'document_review',
  'memory_promotion',
];

const ALLOWED_OUTCOMES: CompanyBrainFeedbackOutcome[] = [
  'pending',
  'adopted',
  'modified',
  'overruled',
  'ignored',
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const contextParam = url.searchParams.get('context') ?? undefined;
  const outcomeParam = url.searchParams.get('outcome') ?? undefined;
  const since = url.searchParams.get('since') ?? undefined;
  const limitRaw = url.searchParams.get('limit');
  const brainVersionRaw = url.searchParams.get('brainVersion');

  const context = contextParam && ALLOWED_CONTEXTS.includes(contextParam as CompanyBrainDecisionContext)
    ? (contextParam as CompanyBrainDecisionContext)
    : undefined;
  const outcome = outcomeParam && ALLOWED_OUTCOMES.includes(outcomeParam as CompanyBrainFeedbackOutcome)
    ? (outcomeParam as CompanyBrainFeedbackOutcome)
    : undefined;

  let limit = limitRaw ? Number(limitRaw) : 100;
  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  if (limit > 500) limit = 500;

  const brainVersion = brainVersionRaw !== null && brainVersionRaw !== undefined
    ? Number(brainVersionRaw)
    : undefined;

  const decisions = await listDecisions({
    tenantId: auth.tenantId,
    context,
    outcome,
    since,
    limit,
    brainVersion: Number.isFinite(brainVersion as number) ? brainVersion : undefined,
  });

  return NextResponse.json({
    total: decisions.length,
    filter: { context, outcome, since, limit, brainVersion },
    decisions,
  });
}
