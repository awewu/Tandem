/**
 * GET /api/im/search?q=&channelId=&limit=
 *
 * §Sprint1 (Megaplan) · IM 正文词面搜索。
 * 只在当前用户可见频道内检索; 越权/跨租户频道消息绝不返回。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { bootHotPath } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { type ImSearchHit, searchMessages } from '@/lib/im/search';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { db } from '@/lib/infra/drizzle-client';
import { isDatabaseMode } from '@/lib/infra/storage-mode';
import { extractPreview, type ImMessage } from '@/lib/types/im';

async function searchMessagesDirect(input: {
  userId: string;
  tenantId: string;
  query: string;
  channelId?: string;
  limit: number;
}): Promise<ImSearchHit[]> {
  const escaped = input.query.replace(/[\\%_]/g, (char) => `\\${char}`);
  const pattern = `%${escaped}%`;
  const channelFilter = input.channelId
    ? sql`AND m.data->>'channelId' = ${input.channelId}`
    : sql``;

  const rows = await db.execute<{
    messageId: string;
    channelId: string;
    channelName: string | null;
    senderId: string;
    senderKind: ImMessage['senderKind'] | null;
    body: string | null;
    createdAt: string;
  }>(sql`
    SELECT
      m.id AS "messageId",
      m.data->>'channelId' AS "channelId",
      CASE
        WHEN c.data->>'type' = 'dm'
          THEN COALESCE(other_user.name, other_user.email, other_member.user_id, '私聊')
        ELSE COALESCE(NULLIF(c.data->>'name', ''), '群聊')
      END AS "channelName",
      m.data->>'senderId' AS "senderId",
      COALESCE(m.data->>'senderKind', 'user') AS "senderKind",
      m.data->>'body' AS body,
      m.data->>'createdAt' AS "createdAt"
    FROM "KvStore" m
    JOIN "KvStore" mem
      ON mem.collection = 'im_memberships'
     AND mem.data->>'userId' = ${input.userId}
     AND mem.data->>'channelId' = m.data->>'channelId'
    JOIN "KvStore" c
      ON c.collection = 'im_channels'
     AND c.id = m.data->>'channelId'
    LEFT JOIN LATERAL (
      SELECT value #>> '{}' AS user_id
      FROM jsonb_array_elements(c.data->'memberIds') AS value
      WHERE value #>> '{}' <> ${input.userId}
      LIMIT 1
    ) other_member ON c.data->>'type' = 'dm'
    LEFT JOIN "User" other_user
      ON other_user.id = other_member.user_id
     AND other_user."deletedAt" IS NULL
    WHERE m.collection = 'im_messages'
      AND m.data->>'deletedAt' IS NULL
      AND COALESCE(c.data->>'tenantId', 'default') = ${input.tenantId}
      AND c.data->>'archivedAt' IS NULL
      AND m.data->>'body' ILIKE ${pattern}
      ${channelFilter}
    ORDER BY m.data->>'createdAt' DESC
    LIMIT ${input.limit}
  `);

  return rows.map((row, index) => ({
    messageId: row.messageId,
    channelId: row.channelId,
    channelName: row.channelName ?? row.channelId,
    senderId: row.senderId,
    senderKind: row.senderKind ?? 'user',
    preview: extractPreview(row.body ?? ''),
    createdAt: row.createdAt,
    score: 1 / (index + 1),
    matchKind: 'body',
  }));
}

async function GETApiHandler(req: NextRequest) {
  bootHotPath();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ results: [] });

  const channelId = url.searchParams.get('channelId') ?? undefined;
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 30;

  const results = isDatabaseMode()
    ? await searchMessagesDirect({
        userId: auth.userId,
        tenantId: auth.tenantId,
        query: q,
        channelId,
        limit,
      })
    : await searchMessages({
        userId: auth.userId,
        tenantId: auth.tenantId,
        query: q,
        channelId,
        limit,
      });
  return NextResponse.json({ results });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/im/search' });
