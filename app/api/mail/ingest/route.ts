/**
 * POST /api/mail/ingest
 *
 * 把一封邮件喂给 Email AI Brain (lib/services/email-ai-brain):
 *   1. digestEmailMessage         → AI 摘要 / 情感 / 关键词 / Action Items / 风险扫描
 *   2. ingestEmailIntoCorporateMemory → 写 Material (Origins 层) + 风险审计 +
 *      高价值(sop/case/lesson/agreement) 自动 proposePromotion 进三级签批
 *
 * 入口性质: webhook / 手动粘贴. IMAP 自动拉取 (fetchInbox) 仍为 V2 (email-tier1 占位).
 *
 * Body: { from?: string; to?: string | string[]; subject: string; date?: string; text: string }
 * 返回: { ok, digest, originId, promotionId? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { digestEmailMessage, ingestEmailIntoCorporateMemory } from '@/lib/services/email-ai-brain';
import type { EmailMessage } from '@/lib/integrations/email-tier1';

interface Body {
  from?: unknown;
  to?: unknown;
  subject?: unknown;
  date?: unknown;
  text?: unknown;
}

function asList(v: unknown): string[] {
  if (typeof v === 'string') return v.split(/[,;\s]+/).filter(Boolean);
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  return [];
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!subject) {
    return NextResponse.json({ ok: false, error: 'subject 必填' }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: 'text (邮件正文) 必填' }, { status: 400 });
  }

  const email: EmailMessage = {
    uid: Date.now(),
    seq: 0,
    from: [{ address: typeof body.from === 'string' && body.from.trim() ? body.from.trim() : auth.userId }],
    to: asList(body.to).map((address) => ({ address })),
    subject,
    date: typeof body.date === 'string' && body.date.trim() ? body.date.trim() : new Date().toISOString(),
    textBody: text,
    attachments: [],
    flags: [],
    seen: true,
  };

  const digest = await digestEmailMessage(email, auth.userId);
  const { originId, promotionId } = await ingestEmailIntoCorporateMemory(email, digest, auth.userId);

  return NextResponse.json({ ok: true, digest, originId, promotionId });
});
