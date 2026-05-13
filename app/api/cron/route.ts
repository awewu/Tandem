export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { runHermesJson, parseTable } from '@/lib/hermes-cli';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  status: string;
  [key: string]: string;
}

function normalizeJob(row: Record<string, string>): CronJob {
  return {
    id: row.id || row.job || row['job id'] || '',
    name: row.name || '',
    schedule: row.schedule || row.cron || '',
    status: (row.status || row.state || 'active').toLowerCase(),
    ...row,
  };
}

// Parse `hermes cron list` indented-block format:
//   779c0571c9e8 [active]
//     Name:      webui-smoke
//     Schedule:  every 120m
//     Next run:  2026-05-03T10:16:52
//     Deliver:   local
function parseCronBlocks(stdout: string): CronJob[] {
  const jobs: CronJob[] = [];
  const idLine = /^\s{2,}([a-f0-9]{6,})(?:\s+\[([^\]]+)\])?\s*$/;
  const kv = /^\s{4,}([A-Za-z][A-Za-z \-]+):\s+(.+?)\s*$/;
  let current: CronJob | null = null;
  for (const raw of stdout.split('\n')) {
    const mid = raw.match(idLine);
    if (mid) {
      if (current) jobs.push(current);
      current = { id: mid[1], name: '', schedule: '', status: (mid[2] || 'active').toLowerCase() };
      continue;
    }
    if (current) {
      const m = raw.match(kv);
      if (!m) continue;
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
      const value = m[2].trim();
      current[key] = value;
      if (key === 'name') current.name = value;
      else if (key === 'schedule' || key === 'cron') current.schedule = value;
    }
  }
  if (current) jobs.push(current);
  return jobs;
}

export async function GET() {
  try {
    const { data, raw, code, stderr, jsonMode } = await runHermesJson<{ jobs: CronJob[] }>(['cron', 'list']);
    if (jsonMode && data) {
      return Response.json({ jobs: data.jobs, jsonMode });
    }
    const stdout = raw;
    if (/no scheduled jobs/i.test(stdout)) {
      return Response.json({ jobs: [], raw: stdout });
    }
    // Try block format first (real hermes cron list output), fallback to table.
    let jobs = parseCronBlocks(stdout);
    if (jobs.length === 0) {
      jobs = parseTable(stdout).map(normalizeJob).filter((j) => j.id);
    }
    // Tolerate non-zero exit if we recovered jobs (e.g. hermes GBK warning crash after printing).
    if (jobs.length === 0 && code !== 0) {
      return Response.json({ jobs: [], error: stderr || `exit ${code}`, raw: stdout }, { status: 500 });
    }
    return Response.json({ jobs, raw: stdout, warning: code !== 0 ? stderr : undefined });
  } catch (err: any) {
    return Response.json({ jobs: [], error: err?.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, schedule, prompt, skills } = await req.json();
    if (typeof schedule !== 'string' || !schedule.trim()) {
      return Response.json({ success: false, error: 'schedule is required' }, { status: 400 });
    }
    const args: string[] = ['cron', 'create', schedule];
    if (typeof prompt === 'string' && prompt.trim()) args.push(prompt);
    if (typeof name === 'string' && name.trim()) {
      const safeName = name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '');
      if (safeName) args.push('--name', safeName);
    }
    if (Array.isArray(skills)) {
      for (const s of skills) {
        if (typeof s === 'string' && /^[A-Za-z0-9_\-]+$/.test(s)) args.push('--skill', s);
      }
    }
    const { data, raw, code, stderr, jsonMode } = await runHermesJson<{ success: boolean; id?: string }>(args);
    if (jsonMode && data) {
      return Response.json({ ...data, jsonMode });
    }
    const stdout = raw;
    if (code !== 0) {
      return Response.json({ success: false, error: stderr || `exit ${code}`, raw: stdout }, { status: 500 });
    }
    return Response.json({ success: true, raw: stdout, jsonMode });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message }, { status: 500 });
  }
}
