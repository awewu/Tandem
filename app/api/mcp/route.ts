import { runHermes } from '@/lib/hermes-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface MCPServer {
  name: string;
  type?: string;
  endpoint?: string;
  status?: string;
  enabled?: boolean;
}

const COL_SEP_RE = /[\u2502\u2503\u2551|]/;

function parseList(stdout: string): MCPServer[] {
  const servers: MCPServer[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sepMatch = line.match(COL_SEP_RE);
    if (!sepMatch) continue;
    if (/^[\s\-=+\u2500-\u257F|]+$/.test(line)) continue;
    const cells = line
      .split(sepMatch[0])
      .map((c) => c.trim())
      .filter((c, i, arr) => !(c === '' && (i === 0 || i === arr.length - 1)));
    if (cells.length < 2) continue;
    const [name, second, third, fourth] = cells;
    if (!name || name.toLowerCase() === 'name') continue;
    servers.push({
      name,
      type: second,
      endpoint: third,
      status: fourth,
      enabled: !fourth || /enabled|active|connected|ok/i.test(fourth),
    });
  }
  return servers;
}

export async function GET() {
  try {
    const { stdout, stderr, code } = await runHermes(['mcp', 'list'], 10000);
    if (code !== 0 && !stdout) {
      return Response.json(
        { ok: false, servers: [], error: stderr || `exit ${code}` },
        { status: 502 }
      );
    }
    // "No MCP servers configured." → empty list, not error
    const empty = /no mcp servers configured/i.test(stdout);
    const servers = empty ? [] : parseList(stdout);
    return Response.json({ ok: true, servers, count: servers.length, empty });
  } catch (err: any) {
    return Response.json(
      { ok: false, servers: [], error: err?.message || 'Failed' },
      { status: 500 }
    );
  }
}
