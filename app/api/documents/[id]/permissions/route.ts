import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';

/**
 * PATCH /api/documents/[id]/permissions
 * Body: { read?: string[], write?: string[], publicAccess?: boolean }
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await boot();
    const s = getStore();
    const doc = await s.documents.get(params.id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const updated = await s.documents.update(params.id, {
      permissions: {
        ...doc.permissions,
        ...body,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
