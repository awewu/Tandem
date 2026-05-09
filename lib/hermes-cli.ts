import { spawn } from 'child_process';

export interface HermesRunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function runHermes(args: string[], timeoutMs = 20000): Promise<HermesRunResult> {
  return new Promise((resolve, reject) => {
    // Force UTF-8 output from Python to dodge Windows GBK UnicodeEncodeError.
    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      NO_COLOR: '1',
    };
    const child = spawn('hermes', args, {
      windowsHide: true,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error(`hermes ${args.slice(0, 2).join(' ')} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf-8'); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf-8'); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, code: code ?? 0 }); });
  });
}

// Generic ASCII/Unicode table parser (first pipe row = headers).
export function parseTable(stdout: string): Record<string, string>[] {
  const lines = stdout.split('\n');
  let headers: string[] | null = null;
  const rows: Record<string, string>[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const sep = line.startsWith('│') ? '│' : line.startsWith('|') ? '|' : null;
    if (!sep) continue;
    if (/^[|│+\-\s]+$/.test(line)) continue;
    const cells = line.split(sep).map((c) => c.trim()).slice(1, -1);
    if (cells.length === 0) continue;
    if (!headers) { headers = cells.map((c) => c.toLowerCase()); continue; }
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    rows.push(row);
  }
  return rows;
}
