export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { runHermesJson } from '@/lib/hermes-cli';
import { error, json } from '@/app/api/_common/response';

export async function GET() {
  try {
    // hermes --version hangs on Windows spawn (Hermes bug). Use cron status instead.
    const { raw, code, stderr } = await runHermesJson(['cron', 'status'], 8000);
    const stdout = raw;
    // cron status returns 0 if running, non-zero if not (with human text in stdout/stderr)
    const running = code === 0 || /running|active/i.test(stdout + stderr);
    if (!running) {
      return error(stderr || stdout || `exit ${code}`, 503);
    }
    return json({ ok: true, version: 'Hermes (cron status)' });
  } catch (err: any) {
    const msg = err?.message || 'Hermes unreachable';
    return error(/ENOENT/i.test(msg) ? 'Hermes not found in PATH' : msg, 500);
  }
}
