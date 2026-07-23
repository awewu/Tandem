import { NextRequest } from 'next/server';
import { proxyControlPlaneRequest } from '../../../../lib/control-plane-proxy';

type Context = { params: Promise<{ path?: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  return proxyControlPlaneRequest(request, '/file-artifact', path);
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
