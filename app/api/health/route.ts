export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { runHermes } from '@/lib/hermes-cli';

export async function GET() {
  try {
    // hermes --version hangs on Windows spawn (Hermes bug). Use cron status instead.
    const { stdout, stderr, code } = await runHermes(['cron', 'status'], 8000);
    // cron status returns 0 if running, non-zero if not (with human text in stdout/stderr)
    const running = code === 0 || /running|active/i.test(stdout + stderr);
    const version = 'Hermes (cron status)';
    return Response.json({
      ok: running,
      version: running ? version : undefined,
      error: running ? undefined : (stderr || stdout || `exit ${code}`),
    });
  } catch (err: any) {
    const msg = err?.message || 'Hermes unreachable';
    return Response.json({
      ok: false,
      error: /ENOENT/i.test(msg) ? 'Hermes not found in PATH' : msg,
    });
  }
}
