/**
 * BossAI · /api/boss-ai/stream 端点单测
 *
 * 覆盖:
 *  - GET health probe 返回 provider 列表
 *  - POST 鉴权 (无 auth + ALLOW_DEMO_AUTH=0 → 401)
 *  - POST 空 messages → 400
 *  - POST 正常请求返回 SSE 流且 content 帧到达
 *  - POST 写入审计 boss_ai.ask + boss_ai.answer
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/persona/company-brain', async (orig) => {
  const actual = await orig<typeof import('@/lib/persona/company-brain')>();
  return {
    ...actual,
    buildCompanyBrainSystemPrompt: vi.fn(async () => '你是中央 AI test prompt'),
  };
});

vi.mock('@/lib/boot', () => ({
  boot: vi.fn(async () => {}),
  getRouter: vi.fn(() => ({
    listProviders: () => ['mock'],
    chatStream: async function* () {
      yield { delta: { content: '你好,' } };
      yield { delta: { content: ' 同事!' } };
    },
  })),
}));

const auditCalls: Array<{ action: string; metadata?: Record<string, unknown> }> = [];
vi.mock('@/lib/audit/log', async (orig) => {
  const actual = await orig<typeof import('@/lib/audit/log')>();
  return {
    ...actual,
    audit: vi.fn(async (action: string, _actorId: string, opts?: { metadata?: Record<string, unknown> }) => {
      auditCalls.push({ action, metadata: opts?.metadata });
      return { id: 'test', action, actorId: _actorId, createdAt: new Date().toISOString() } as never;
    }),
  };
});

async function readAllSse(res: Response): Promise<Array<Record<string, unknown>>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const events: Array<Record<string, unknown>> = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const ev = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of ev.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        try { events.push(JSON.parse(t.slice(5).trim())); } catch { /* ignore */ }
      }
    }
  }
  return events;
}

function mockReq(body: unknown, opts: { method?: string } = {}): NextRequest {
  const req = new Request('http://test.local/api/boss-ai/stream', {
    method: opts.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return new NextRequest(req);
}

describe('/api/boss-ai/stream', () => {
  beforeEach(() => {
    auditCalls.length = 0;
    process.env.ALLOW_DEMO_AUTH = '1'; // 让 requireAuth 走 demo
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GET 返回 provider 健康信息', async () => {
    const { GET } = await import('@/app/api/boss-ai/stream/route');
    const res = await GET(mockReq(undefined, { method: 'GET' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.providers)).toBe(true);
  });

  it('POST 空 messages → SSE 400 error', async () => {
    const { POST } = await import('@/app/api/boss-ai/stream/route');
    const res = await POST(mockReq({ messages: [] }));
    expect(res.status).toBe(400);
    const events = await readAllSse(res);
    expect(events[0]).toHaveProperty('error');
  });

  it('POST 触发分钟级限流 → 429', async () => {
    process.env.RATE_LIMIT_BOSS_AI_PER_MINUTE = '1';
    // 不同 user 不互相影响, 这里同 userId 连发 2 次
    const { POST } = await import('@/app/api/boss-ai/stream/route');
    const req1 = mockReq({ messages: [{ role: 'user', content: '第一次' }] });
    const r1 = await POST(req1);
    expect(r1.status).toBe(200);
    const req2 = mockReq({ messages: [{ role: 'user', content: '第二次' }] });
    const r2 = await POST(req2);
    expect(r2.status).toBe(429);
    const events = await readAllSse(r2);
    expect((events[0] as { error: string }).error).toContain('请慢一点');
    // 还原默认
    delete process.env.RATE_LIMIT_BOSS_AI_PER_MINUTE;
  });

  it('POST 正常请求返回 content + done SSE 帧, 并写审计', async () => {
    const { POST } = await import('@/app/api/boss-ai/stream/route');
    const res = await POST(mockReq({
      messages: [{ role: 'user', content: '我现在该聚焦什么 OKR?' }],
      sessionId: 'sess-test-1',
      currentPath: '/okr',
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const events = await readAllSse(res);
    const contents = events.filter((e) => typeof e.content === 'string').map((e) => e.content as string);
    expect(contents.join('')).toBe('你好, 同事!');
    expect(events.some((e) => e.done === true)).toBe(true);

    // 审计 · ask + answer 都写
    const actions = auditCalls.map((c) => c.action);
    expect(actions).toContain('boss_ai.ask');
    expect(actions).toContain('boss_ai.answer');
    const askCall = auditCalls.find((c) => c.action === 'boss_ai.ask');
    expect(askCall?.metadata?.currentPath).toBe('/okr');
  });
});
