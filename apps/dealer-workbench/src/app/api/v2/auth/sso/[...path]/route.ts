import { NextRequest, NextResponse } from 'next/server';
import { buildSsoProxyTarget, setCookieHeaders } from '../proxy';

export const dynamic = 'force-dynamic';

type Params = { path?: string[] };
type RouteContext = { params: Promise<Params> };

export async function GET(req: NextRequest, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const target = buildSsoProxyTarget(params.path ?? [], req.url);
  const upstream = await fetch(target, {
    method: 'GET',
    headers: {
      accept: req.headers.get('accept') || 'text/html,application/json',
      cookie: req.headers.get('cookie') || '',
      'x-forwarded-host': req.headers.get('host') || '',
      'x-forwarded-proto': req.nextUrl.protocol.replace(':', ''),
    },
    redirect: 'manual',
    cache: 'no-store',
  });

  const headers = new Headers();
  const location = upstream.headers.get('location');
  const contentType = upstream.headers.get('content-type');
  if (location) headers.set('location', location);
  if (contentType) headers.set('content-type', contentType);
  for (const cookie of setCookieHeaders(upstream.headers)) {
    headers.append('set-cookie', cookie);
  }

  const body = upstream.status >= 300 && upstream.status < 400 ? null : await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers });
}
