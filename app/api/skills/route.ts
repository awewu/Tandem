export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { runHermes } from '@/lib/hermes-cli';
import { requireAuth } from '@/lib/auth/require-auth';
import { NextResponse } from 'next/server';

interface HermesSkill {
  name: string;
  category: string;
  source: string;
  trust: string;
  enabled: boolean;
}

// Match any line that uses one of the table column separators:
//   U+2502 BOX DRAWINGS LIGHT VERTICAL  │
//   U+2503 BOX DRAWINGS HEAVY VERTICAL  ┃
//   U+2551 BOX DRAWINGS DOUBLE VERTICAL ║
//   ASCII pipe                          |
const COL_SEP_RE = /[\u2502\u2503\u2551|]/;

function parseSkillsList(stdout: string): HermesSkill[] {
  const skills: HermesSkill[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // Detect which separator this line uses (first match wins)
    const sepMatch = line.match(COL_SEP_RE);
    if (!sepMatch) continue;
    const sep = sepMatch[0];
    // Skip separator rows like "├──┼──┤", "+---+---+", etc.
    if (/^[\s\-=+\u2500-\u257F|]+$/.test(line)) continue;
    // Split on the actual separator character
    const all = line.split(sep).map((c) => c.trim());
    // Drop edge empties from leading/trailing pipes
    const cells = all.filter((c, i) => !(c === '' && (i === 0 || i === all.length - 1)));
    if (cells.length < 5) continue;
    const [name, category, source, trust, status] = cells;
    if (!name) continue;
    // Skip header row
    if (name.toLowerCase() === 'name' && category.toLowerCase() === 'category') continue;
    skills.push({
      name,
      category,
      source,
      trust,
      enabled: status.toLowerCase().includes('enabled'),
    });
  }
  return skills;
}

export async function GET(req: Request) {
  const auth = requireAuth(req as any);
  if (auth instanceof NextResponse) return auth;
  try {
    const { stdout, stderr, code } = await runHermes(['skills', 'list']);
    if (code !== 0 && !stdout) {
      return Response.json(
        { skills: [], count: 0, error: stderr || `exit ${code}` },
        { status: 500 }
      );
    }
    const skills = parseSkillsList(stdout);
    return Response.json({ skills, count: skills.length });
  } catch (err: any) {
    return Response.json(
      { skills: [], count: 0, error: err?.message || 'Error' },
      { status: 500 }
    );
  }
}
