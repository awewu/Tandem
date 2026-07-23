import { NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/api';

async function proxy(req: Request, params: Promise<{ path?: string[] }>) {
  const { path = [] } = await params;
  const source = new URL(req.url);
  const suffix = path.length ? `/${path.map(encodeURIComponent).join('/')}` : '';
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text();
  const upstream = await backendFetch(`/brand-sites${suffix}${source.search}`, {
    method: req.method,
    body: body || undefined,
  });
  if (!upstream) return NextResponse.json({ message: '品牌服务未连接' }, { status: 502 });
  const text = await upstream.text();
  return new NextResponse(text || null, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
  });
}

type Context = { params: Promise<{ path?: string[] }> };
export const GET = (req: Request, ctx: Context) => proxy(req, ctx.params);
export const POST = (req: Request, ctx: Context) => proxy(req, ctx.params);
export const PUT = (req: Request, ctx: Context) => proxy(req, ctx.params);
export const DELETE = (req: Request, ctx: Context) => proxy(req, ctx.params);
