import { runHermes } from '@/lib/hermes-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface MemoryStatus {
  ok: boolean;
  builtIn: { active: boolean; description?: string };
  provider: { name?: string; configured: boolean };
  plugins: { name: string; description: string }[];
  raw: string;
  error?: string;
}

function parse(stdout: string): MemoryStatus {
  const out: MemoryStatus = {
    ok: true,
    builtIn: { active: true },
    provider: { configured: false },
    plugins: [],
    raw: stdout,
  };
  let inPlugins = false;
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.replace(/\r/g, '');
    if (!line.trim()) continue;
    if (/installed plugins/i.test(line)) {
      inPlugins = true;
      continue;
    }
    if (inPlugins) {
      // bullet line: looks like "    • name  (description)" or with mojibake for •
      const m = line.match(/^\s*[\u2022\-\*\?\u2500-\u259F]+\s*([\w\-]+)\s*(?:\((.*?)\))?\s*$/);
      if (m) {
        out.plugins.push({ name: m[1], description: (m[2] || '').trim() });
      } else {
        // fallthrough: stop if format diverges
        if (!/^\s/.test(line)) inPlugins = false;
      }
      continue;
    }
    const m = line.match(/^\s*([A-Za-z][\w \-]+?):\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2]
      .replace(/^[\s\u2500-\u259F\u2700-\u27BF]+/, '')
      .replace(/^\?+\s*/, '')
      .trim();
    if (/^built-in$/i.test(key)) {
      out.builtIn.description = val;
      out.builtIn.active = /always|active|enabled/i.test(val);
    } else if (/^provider$/i.test(key)) {
      const noProvider = /^\(none/i.test(val) || /built-in only/i.test(val);
      out.provider.configured = !noProvider;
      out.provider.name = noProvider ? undefined : val;
    }
  }
  return out;
}

export async function GET() {
  try {
    const { stdout, stderr, code } = await runHermes(['memory', 'status'], 10000);
    if (code !== 0 && !stdout) {
      return Response.json(
        { ok: false, error: stderr || `exit ${code}`, raw: stdout },
        { status: 502 }
      );
    }
    return Response.json(parse(stdout));
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || 'Failed', raw: '' },
      { status: 500 }
    );
  }
}
