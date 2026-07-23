import { NextRequest } from 'next/server';
import { proxyControlPlaneRequest } from '../../../../lib/control-plane-proxy';
// Compatibility-only fallback while the NestJS system-packs module is not yet available.
// @ts-expect-error Legacy CommonJS source has no TypeScript declaration.
import systemPackSource from '../../../../../../../server/modules/system-packs/rheemSystemPacks';

type Context = { params: Promise<{ path?: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  return proxyControlPlaneRequest(request, '/system-packs', path);
}

export async function GET(request: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  const upstream = await proxyControlPlaneRequest(request, '/system-packs', path);
  if (upstream.status !== 404 || path.length > 0) return upstream;
  return Response.json({
    success: true,
    data: { items: systemPackSource.RHEEM_SYSTEM_PACKS, source: 'legacy-compat' },
  });
}
export const POST = proxy;
