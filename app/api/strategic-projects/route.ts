import { NextResponse } from 'next/server';
import { loadStrategicProjects, resetStrategicProjects, saveStrategicProjects } from '@/lib/strategic-projects/store';
import type { StrategicProject } from '@/lib/strategic-projects/sample-data';

export async function GET() {
  const projects = await loadStrategicProjects();
  return NextResponse.json({ ok: true, projects });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as { projects?: StrategicProject[] };
  if (!Array.isArray(body.projects)) {
    return NextResponse.json({ ok: false, error: 'projects must be an array' }, { status: 400 });
  }

  await saveStrategicProjects(body.projects);
  return NextResponse.json({ ok: true, projects: body.projects });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== 'reset') {
    return NextResponse.json({ ok: false, error: 'unsupported action' }, { status: 400 });
  }

  const projects = await resetStrategicProjects();
  return NextResponse.json({ ok: true, projects });
}
