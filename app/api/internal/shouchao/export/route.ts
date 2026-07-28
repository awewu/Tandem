/**
 * Internal Shouchao export for Tandem backend jobs.
 *
 * This is a system boundary, not a user permission boundary: Tandem can read
 * all Shouchao records when it presents SHOUCHAO_INTERNAL_TOKEN.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getShouchaoStore, isDedicatedShouchaoDatabaseEnabled } from '@/lib/shouchao/store';
import type { ShouchaoAttachment, ShouchaoNote, ShouchaoNotebook } from '@/lib/types/shouchao';
import type { ShouchaoDatabase, ShouchaoRow } from '@/lib/types/shouchao-db';
import type { ShouchaoDistillCandidate } from '@/lib/types/shouchao-distillation';

export const runtime = 'nodejs';

type CollectionName = 'notes' | 'notebooks' | 'attachments' | 'databases' | 'rows' | 'distillCandidates';
type Exportable =
  | ShouchaoNote
  | ShouchaoNotebook
  | ShouchaoAttachment
  | ShouchaoDatabase
  | ShouchaoRow
  | ShouchaoDistillCandidate;

const COLLECTIONS: CollectionName[] = ['notes', 'notebooks', 'attachments', 'databases', 'rows', 'distillCandidates'];
interface ExportCursor {
  ts: string;
  id: string;
}

function tokenFrom(req: NextRequest): string {
  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Bearer ')) return authz.slice(7).trim();
  return req.headers.get('x-shouchao-internal-token')?.trim() ?? '';
}

function verifyInternalToken(req: NextRequest): NextResponse | null {
  const expected = process.env.SHOUCHAO_INTERNAL_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json({ error: 'internal_token_not_configured' }, { status: 503 });
  }
  const actual = tokenFrom(req);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

function changedAt(item: Exportable): string {
  const maybeUpdated = (item as { updatedAt?: string }).updatedAt;
  return maybeUpdated ?? item.createdAt;
}

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? '500');
  if (!Number.isFinite(n)) return 500;
  return Math.min(Math.max(Math.trunc(n), 1), 2000);
}

function parseSince(raw: string | null): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function parseCursor(raw: string | null): ExportCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<ExportCursor>;
    if (typeof parsed.ts !== 'string' || typeof parsed.id !== 'string') return null;
    if (!Number.isFinite(Date.parse(parsed.ts))) return null;
    return { ts: new Date(Date.parse(parsed.ts)).toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

function encodeCursor(item: Exportable): string {
  return Buffer.from(JSON.stringify({ ts: changedAt(item), id: item.id }), 'utf8').toString('base64url');
}

function isAfterCursor(item: Exportable, cursor: ExportCursor): boolean {
  const ts = changedAt(item);
  return ts > cursor.ts || (ts === cursor.ts && item.id > cursor.id);
}

async function readCollection(name: CollectionName): Promise<Exportable[]> {
  const store = getShouchaoStore();
  switch (name) {
    case 'notes':
      return store.shouchaoNotes.list();
    case 'notebooks':
      return store.shouchaoNotebooks.list();
    case 'attachments':
      return store.shouchaoAttachments.list();
    case 'databases':
      return store.shouchaoDatabases.list();
    case 'rows':
      return store.shouchaoRows.list();
    case 'distillCandidates':
      return store.shouchaoDistillCandidates.list();
  }
}

async function GETApiHandler(req: NextRequest) {
  const forbidden = verifyInternalToken(req);
  if (forbidden) return forbidden;

  await boot();

  const url = new URL(req.url);
  const requested = url.searchParams.get('collection') as CollectionName | null;
  if (requested && !COLLECTIONS.includes(requested)) {
    return NextResponse.json({ error: 'invalid_collection', collections: COLLECTIONS }, { status: 400 });
  }

  const since = parseSince(url.searchParams.get('since'));
  const cursor = parseCursor(url.searchParams.get('cursor'));
  const limit = parseLimit(url.searchParams.get('limit'));
  const collections = requested ? [requested] : COLLECTIONS;
  const payload: Record<string, { items: Exportable[]; nextSince: string | null; nextCursor: string | null; hasMore: boolean }> = {};

  for (const collection of collections) {
    const all = (await readCollection(collection))
      .filter((item) => (cursor ? isAfterCursor(item, cursor) : !since || changedAt(item) > since))
      .sort((a, b) => {
        const byChanged = changedAt(a).localeCompare(changedAt(b));
        return byChanged !== 0 ? byChanged : a.id.localeCompare(b.id);
      });
    const items = all.slice(0, limit);
    payload[collection] = {
      items,
      nextSince: items.length > 0 ? changedAt(items[items.length - 1]) : since,
      nextCursor: items.length > 0 ? encodeCursor(items[items.length - 1]) : cursor ? url.searchParams.get('cursor') : null,
      hasMore: all.length > items.length,
    };
  }

  return NextResponse.json({
    ok: true,
    mode: isDedicatedShouchaoDatabaseEnabled() ? 'dedicated' : 'tandem-fallback',
    generatedAt: new Date().toISOString(),
    collections: payload,
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/internal/shouchao/export' });
