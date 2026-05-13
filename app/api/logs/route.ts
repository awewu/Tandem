import { runHermesJson } from '@/lib/hermes-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface LogLine {
  id: string;
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'UNKNOWN';
  component: string;
  message: string;
  raw: string;
}

// Format: 2026-05-06 03:24:04,586 INFO hermes_cli.plugins: message
const LOG_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[,.]\d{1,6})?)\s+(\w+)\s+([\w.\-]+):\s*(.*)$/;

function parseLine(line: string, idx: number): LogLine | null {
  const m = line.match(LOG_RE);
  if (m) {
    const lvl = m[2].toUpperCase();
    const level = (['INFO', 'DEBUG', 'WARNING', 'ERROR', 'CRITICAL'].includes(lvl)
      ? lvl
      : 'UNKNOWN') as LogLine['level'];
    return {
      id: `${m[1]}-${idx}`,
      timestamp: m[1],
      level,
      component: m[3],
      message: m[4],
      raw: line,
    };
  }
  // Continuation / non-conforming line: attach as message-only (e.g. tracebacks)
  if (line.trim()) {
    return {
      id: `c-${idx}`,
      timestamp: '',
      level: 'UNKNOWN',
      component: '',
      message: line,
      raw: line,
    };
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const logName = url.searchParams.get('log') || 'agent'; // agent | errors | gateway | list
  const lines = url.searchParams.get('lines') || '100';
  const level = url.searchParams.get('level') || '';
  const component = url.searchParams.get('component') || '';
  const since = url.searchParams.get('since') || '';

  const args: string[] = ['logs'];
  if (logName && logName !== 'agent') args.push(logName);
  args.push('-n', String(lines));
  if (level && level !== 'all') args.push('--level', level.toUpperCase());
  if (component && component !== 'all') args.push('--component', component);
  if (since) args.push('--since', since);

  try {
    const { data, raw, code, stderr, jsonMode } = await runHermesJson<{ logs: LogLine[]; count: number }>(args, 15000);
    if (jsonMode && data) {
      return Response.json({ ok: true, log: logName, ...data, jsonMode });
    }
    const stdout = raw;
    if (code !== 0 && !stdout) {
      return Response.json(
        { ok: false, error: stderr || `hermes logs exited with code ${code}` },
        { status: 502 }
      );
    }
    const all = (stdout || '').split(/\r?\n/);
    // Drop the leading "--- ~/...agent.log (last N) ---" header lines
    const filtered = all.filter((l) => !/^---\s+.+(last \d+).+---$/.test(l));
    const parsed: LogLine[] = [];
    filtered.forEach((line, idx) => {
      const p = parseLine(line, idx);
      if (p) parsed.push(p);
    });
    return Response.json({
      ok: true,
      log: logName,
      count: parsed.length,
      logs: parsed,
      stderr: stderr || undefined,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || 'Failed to read logs' },
      { status: 500 }
    );
  }
}
