import { NextResponse } from 'next/server';
import { getHealth } from '../../../../lib/api';

// Server-side health probe to the NestJS backend (/api/v2/health).
// Returns success:false (not an error status) when unreachable so the client
// LiveHealth widget can render a graceful "未连接" state.
export async function GET() {
  const health = await getHealth();
  return NextResponse.json(health ?? { success: false });
}
