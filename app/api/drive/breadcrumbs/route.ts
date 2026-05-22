import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get('folderId');
  if (!folderId) return NextResponse.json({ breadcrumbs: [] });

  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const f = await svc.getById(folderId);
  if (!f) return NextResponse.json({ breadcrumbs: [{ id: 'root', name: '云盘' }] });

  const breadcrumbs = [{ id: 'root', name: '云盘' }, { id: f.id, name: f.name }];
  return NextResponse.json({ breadcrumbs });
});
