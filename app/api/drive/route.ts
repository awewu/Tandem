import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';

export const GET = withErrorHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId');
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const files = await svc.list({ parentId: parentId ?? null, ownerId });
  return NextResponse.json({ files });
});

export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const file = await svc.create(body);
  return NextResponse.json(file, { status: 201 });
});
