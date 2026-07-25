import { NextResponse } from 'next/server';
import { addStrategicProjectMember, loadStrategicProjectMembers } from '@/lib/strategic-projects/members';

export async function GET() {
  const members = await loadStrategicProjectMembers();
  return NextResponse.json({ ok: true, members });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; department?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
  }

  const members = await addStrategicProjectMember({ name, department: body.department });
  return NextResponse.json({ ok: true, members });
}
