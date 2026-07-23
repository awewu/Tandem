import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from './api';

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

export async function proxyControlPlaneRequest(
  request: NextRequest,
  upstreamPrefix: string,
  segments: string[] = [],
) {
  const suffix = segments.length ? `/${segments.map(encodeURIComponent).join('/')}` : '';
  const upstream = await backendFetch(`${upstreamPrefix}${suffix}${request.nextUrl.search}`, {
    method: request.method,
    body: BODYLESS_METHODS.has(request.method) ? undefined : await request.text(),
  });

  if (!upstream) {
    return NextResponse.json({ error: '后端未连接' }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': contentType },
  });
}
