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

// ---------------------------------------------------------------------------
// Phase 1.5: JSON 协议化 — 消灭正则解析
// ---------------------------------------------------------------------------

/**
 * 优先尝试 `--json` flag；若 CLI 不支持（code !== 0 或 stdout 非 JSON），
 * 自动 fallback 到不带 `--json` 的原始调用，并返回 { data: null, raw }。
 *
 * 这样 hermes Python 侧可逐步添加 `--json` 支持，前端零改动无痛升级。
 */
export async function runHermesJson<T>(
  args: string[],
  timeoutMs = 20000
): Promise<{ data: T | null; raw: string; code: number; stderr: string; jsonMode: boolean }> {
  // 1. 尝试 JSON 模式
  try {
    const jsonResult = await runHermes([...args, '--json'], timeoutMs);
    if (jsonResult.code === 0 && jsonResult.stdout.trim()) {
      try {
        const data = JSON.parse(jsonResult.stdout) as T;
        return { data, raw: jsonResult.stdout, code: jsonResult.code, stderr: jsonResult.stderr, jsonMode: true };
      } catch {
        // stdout 不是合法 JSON，说明 CLI 虽然没报错但也没正确输出 JSON，继续 fallback
      }
    }
    // CLI 不支持 --json（可能报错或 stdout 为空），fallthrough
  } catch {
    // 超时或 spawn 失败，fallthrough 到原始调用
  }

  // 2. Fallback 到原始调用
  const result = await runHermes(args, timeoutMs);
  return { data: null, raw: result.stdout, code: result.code, stderr: result.stderr, jsonMode: false };
}

// Generic ASCII/Unicode table parser (first pipe row = headers).
// V1 fallback — 当 hermes CLI 尚未支持 `--json` 时使用.
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
