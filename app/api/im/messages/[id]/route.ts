/**
 * PATCH /api/im/messages/[id]   { action: 'recall', userId }
 * Day 4 (2026-05-10) 撤回消息.
 * - 普通成员: 仅本人 + 2 分钟内
 * - owner/admin: 任何时候
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { recallMessage, updateOwnMessageAttachments } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import type { ImAttachment } from '@/lib/types/im';

async function PATCHApiHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.action === 'recall') {
      const message = await recallMessage(id, auth.userId);
      return NextResponse.json({ message });
    }

    if (body.action === 'update_attachments') {
      const attachments = Array.isArray(body.attachments) ? body.attachments as ImAttachment[] : [];
      const message = await updateOwnMessageAttachments(id, auth.userId, attachments);
      return NextResponse.json({ message });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/im/messages/[id]' });
