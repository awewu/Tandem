/**
 * POST /api/admin/evals/run · on-demand 跑 evals
 * GET  /api/admin/evals      · 最近一次 report (内存 store, restart 即丢)
 *
 * §SELF-USE-FIRST: 让 Owner 在浏览器一键跑 evals, 不用 ssh / scp.
 *
 * 安全:
 *   - 仅 admin/steward 角色可访问
 *   - 不暴露 cookie 给 evals runner (服务端自构 session)
 *
 * 限制 (P1, 简化版):
 *   - 单 suite, 5 case, 无需登录 cookie (走 internal fetch, 跳过 auth)
 *   - 不持久化到 DB (重启即丢); P2 升级落到 EvalReport 表
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import {
  runSuite,
  buildBossAiOkrAnchorSuite,
  buildBossAiSafetySuite,
  buildBossAi1on1Suite,
  buildBossAiOkrSuite,
  buildBossAiPersonaSuite,
  type SuiteReport,
} from '@/lib/evals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory store · last reports (单进程, 上下次 run 之间保留)
const _g = globalThis as typeof globalThis & {
  __tandem_last_eval_reports__?: SuiteReport[];
  __tandem_last_eval_at__?: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward']);
  if (roleErr) return roleErr;

  return NextResponse.json({
    lastReports: _g.__tandem_last_eval_reports__ ?? [],
    lastRanAt: _g.__tandem_last_eval_at__ ?? null,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward']);
  if (roleErr) return roleErr;

  // 构造一个内部 runner: 直接调 buildCompanyBrainSystemPrompt + chat (不走 HTTP SSE 解析)
  const internalRunner = async (input: { query: string; currentPath?: string }): Promise<string> => {
    const { buildCompanyBrainSystemPrompt } = await import('@/lib/persona/company-brain');
    const { boot, getRouter } = await import('@/lib/boot');
    await boot();
    const router = getRouter();
    try {
      const systemPrompt = await buildCompanyBrainSystemPrompt({ query: input.query });
      const reply = await router.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input.query },
        ],
        scenario: 'reasoning_complex',
        temperature: 0.5,
        maxTokens: 400,
      });
      return typeof reply.message.content === 'string' ? reply.message.content : '';
    } catch (err) {
      return `(eval runner error: ${(err as Error).message})`;
    }
  };

  const suites = [
    buildBossAiOkrAnchorSuite(internalRunner, { useLlmJudge: false }),
    buildBossAiSafetySuite(internalRunner, { useLlmJudge: false }),
    buildBossAi1on1Suite(internalRunner, { useLlmJudge: false }),
    buildBossAiOkrSuite(internalRunner, { useLlmJudge: false }),
    buildBossAiPersonaSuite(internalRunner, { useLlmJudge: false }),
  ];

  // 顺序跑 (LLM provider 限流友好); 失败不阻塞其它 suite
  const reports: SuiteReport[] = [];
  for (const suite of suites) {
    try {
      const r = await runSuite(suite, { concurrency: 2, caseTimeoutMs: 30_000 });
      reports.push(r);
    } catch (err) {
      // 跑挂的 suite 也记 stub report, 让前端能看到失败
      reports.push({
        suiteName: suite.name,
        ranAt: new Date().toISOString(),
        durationMs: 0,
        total: 0, passed: 0, avgScore: 0,
        results: [], failures: [],
        meta: { runner: 'crashed', judge: (err as Error).message },
      });
    }
  }

  _g.__tandem_last_eval_reports__ = reports;
  _g.__tandem_last_eval_at__ = new Date().toISOString();

  return NextResponse.json({ reports });
}
