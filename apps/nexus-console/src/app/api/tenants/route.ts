import { NextRequest } from 'next/server';
import { proxyControlPlaneRequest } from '../../../lib/control-plane-proxy';

export function GET(request: NextRequest) {
  return proxyControlPlaneRequest(request, '/tenants');
}
