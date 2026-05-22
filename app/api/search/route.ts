import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DocumentService } from '@/lib/services/document-service';
import { CalendarService } from '@/lib/services/calendar-service';
import { DriveService } from '@/lib/services/drive-service';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').toLowerCase().trim();
  const typesParam = searchParams.get('types') ?? 'all';
  const types = typesParam === 'all'
    ? ['documents', 'calendar', 'drive']
    : typesParam.split(',');

  if (!q) return NextResponse.json({ results: [], total: 0 });

  const ctx = createAppContext();
  const results: Array<{ type: string; id: string; title: string; snippet?: string; matchedAt: string }> = [];

  if (types.includes('documents')) {
    const svc = new DocumentService(ctx);
    const docs = await svc.list();
    for (const d of docs) {
      if (d.title.toLowerCase().includes(q) || (d.content ?? '').toLowerCase().includes(q)) {
        results.push({ type: 'document', id: d.id, title: d.title, snippet: (d.content ?? '').slice(0, 120), matchedAt: d.updatedAt });
      }
    }
  }

  if (types.includes('calendar')) {
    const svc = new CalendarService(ctx);
    const events = await svc.list();
    for (const e of events) {
      if (e.title.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q)) {
        results.push({ type: 'calendarEvent', id: e.id, title: e.title, snippet: (e.description ?? '').slice(0, 120), matchedAt: e.startAt });
      }
    }
  }

  if (types.includes('drive')) {
    const svc = new DriveService(ctx);
    const files = await svc.list();
    for (const f of files) {
      if (f.name.toLowerCase().includes(q)) {
        results.push({ type: 'driveFile', id: f.id, title: f.name, snippet: f.mimeType, matchedAt: f.updatedAt });
      }
    }
  }

  results.sort((a, b) => String(b.matchedAt).localeCompare(String(a.matchedAt)));
  return NextResponse.json({ query: q, types, total: results.length, results: results.slice(0, 50) });
});
