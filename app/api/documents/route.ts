import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DocumentService } from '@/lib/services/document-service';

export const GET = withErrorHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const ctx = createAppContext();
  const svc = new DocumentService(ctx);
  const docs = await svc.list({ ownerId });
  return NextResponse.json({ documents: docs });
});

export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new DocumentService(ctx);
  const doc = await svc.create(body);
  return NextResponse.json(doc, { status: 201 });
});
