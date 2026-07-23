import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiOrigin = (process.env.NEXUS_API_ORIGIN || 'http://localhost:5500').replace(/\/+$/, '');
  const target = new URL(`/api/v2/${path.map(encodeURIComponent).join('/')}`, apiOrigin);
  target.search = request.nextUrl.search;

  try {
    const upstream = await fetch(target, { headers: { accept: request.headers.get('accept') || '*/*' }, cache: 'no-store' });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return Response.json({ success: false, message: 'Public API unavailable' }, { status: 502 });
  }
}
