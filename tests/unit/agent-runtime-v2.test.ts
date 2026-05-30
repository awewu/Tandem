/**
 * §V2 · Agent Runtime 升级单测
 *
 * 覆盖:
 *   - V2-#13: MCP Bridge mode='live' 走 mcp-client (SDK 加载失败时优雅降级)
 *   - V2-#13: Skill Gateway 4 道闸 (Baseline / OKR Drift / Data scope / Action scope)
 *   - V2-#14: Skill Auto-Reload (clear + register + suspended 过滤)
 *   - V2-#12: multi-step mode='native' 转发到 tool-loop
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';

beforeAll(() => {
  setStore(createInMemoryStore());
});

// ---------------------------------------------------------------------------
// V2-#13 · MCP live mode + Skill Gateway
// ---------------------------------------------------------------------------

describe('§V2-#13 · MCP Bridge live mode + Skill Gateway', () => {
  beforeEach(async () => {
    // 清空 mcp servers
    const { listMcpServers, unregisterMcpServer } = await import('@/lib/agent-runtime/mcp-bridge');
    for (const s of listMcpServers()) unregisterMcpServer(s.name);
  });

  // §V2-#13 网络出口测试: 真实 DNS 解析无效 host 在不同环境耗时差异大
  // (Linux 立即返回 ECONNREFUSED, macOS/Windows 走 DNS 超时 ≥ 15s)
  // 测试核心是 "SDK 加载失败 → 优雅返回 error 而不是抛", 不是测网络.
  it(
    'mode=live + SDK 加载失败 → 返回错误而不是抛, ok=false',
    async () => {
      const { registerMcpServer, invokeMcp } = await import('@/lib/agent-runtime/mcp-bridge');
      registerMcpServer({
        name: 'fake-live',
        description: 'test',
        transport: 'http',
        endpoint: 'http://invalid-host-doesnt-exist.local:9999',
        tools: [],
        enabled: true,
        mode: 'live',
      });
      const r = await invokeMcp('fake-live.do_thing', { x: 1 }, { actorUserId: 'u1' });
      expect(r.ok).toBe(false);
      expect(r.serverName).toBe('fake-live');
      // 不应该抛 — 而是返回错误
      expect(r.error).toBeTruthy();
    },
    30_000, // 30s timeout (默认 5s 在 Win/macOS DNS 超时下会 fail)
  );

  it('dataScope 白名单拒绝: 工具名不在白名单 → ok=false, gatewayChecks.dataScope=denied', async () => {
    const { registerMcpServer, invokeMcp } = await import('@/lib/agent-runtime/mcp-bridge');
    registerMcpServer({
      name: 'limited',
      description: 'limited scope',
      transport: 'http',
      endpoint: 'http://x',
      tools: [],
      enabled: true,
      gateway: {
        requireBaselineGuard: false,
        requireOkrDriftCheck: false,
        dataScope: ['read_'], // 只允许 read_* 工具
        actionScope: [],
      },
    });
    const r = await invokeMcp('limited.write_data', {}, { actorUserId: 'u1' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/dataScope|白名单/);
    expect(r.gatewayChecks?.dataScope).toBe('denied');
  });

  it('dataScope 白名单通过: 工具名前缀匹配 → dataScope=pass, 继续走后续 (stub)', async () => {
    const { registerMcpServer, invokeMcp } = await import('@/lib/agent-runtime/mcp-bridge');
    registerMcpServer({
      name: 'limited',
      description: 'limited scope',
      transport: 'http',
      endpoint: 'http://x',
      tools: [],
      enabled: true,
      mode: 'stub',
      gateway: {
        requireBaselineGuard: false,
        requireOkrDriftCheck: false,
        dataScope: ['read_'],
        actionScope: [],
      },
    });
    const r = await invokeMcp('limited.read_data', {}, { actorUserId: 'u1' });
    expect(r.gatewayChecks?.dataScope).toBe('pass');
    // stub 模式下仍然 ok=false, 但理由是 V1 stub 而非 gateway
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/V1 stub/);
  });

  it('actionScope 拒绝同理', async () => {
    const { registerMcpServer, invokeMcp } = await import('@/lib/agent-runtime/mcp-bridge');
    registerMcpServer({
      name: 'sec',
      description: '',
      transport: 'http',
      endpoint: 'http://x',
      tools: [],
      enabled: true,
      gateway: {
        requireBaselineGuard: false,
        requireOkrDriftCheck: false,
        dataScope: [],
        actionScope: ['safe_'],
      },
    });
    const r = await invokeMcp('sec.delete_all', {}, { actorUserId: 'u1' });
    expect(r.ok).toBe(false);
    expect(r.gatewayChecks?.actionScope).toBe('denied');
  });

  it('无 gateway 配置时 4 道闸全部 skipped', async () => {
    const { registerMcpServer, invokeMcp } = await import('@/lib/agent-runtime/mcp-bridge');
    registerMcpServer({
      name: 'no-gate',
      description: '',
      transport: 'http',
      endpoint: 'http://x',
      tools: [],
      enabled: true,
    });
    const r = await invokeMcp('no-gate.anything', {}, { actorUserId: 'u1' });
    expect(r.gatewayChecks?.baseline).toBe('skipped');
    expect(r.gatewayChecks?.okrDrift).toBe('skipped');
    expect(r.gatewayChecks?.dataScope).toBe('skipped');
    expect(r.gatewayChecks?.actionScope).toBe('skipped');
  });
});

// ---------------------------------------------------------------------------
// V2-#14 · Skill Auto-Reload
// ---------------------------------------------------------------------------

describe('§V2-#14 · Skill Auto-Reload', () => {
  it('reloadSkillRegistry: clear + 重跑 builtin → 内置 skill 一致', async () => {
    const { skillRegistry } = await import('@/lib/taf/skills/registry');
    const { reloadSkillRegistry } = await import('@/lib/taf/skills/reload');
    const { registerBuiltinSkills } = await import('@/lib/taf/skills/builtin');

    // 初始注册一次
    registerBuiltinSkills();
    const initialIds = skillRegistry.list().map((s) => s.id).sort();
    expect(initialIds.length).toBeGreaterThan(0);

    // 加一个非内置的 skill (模拟动态 register)
    skillRegistry.register({
      id: 'test.dynamic',
      description: 'dynamic test skill',
      zone: 'green',
      proxyAllowed: true,
      estimatedTokens: 100,
      tags: ['test'],
      schema: { type: 'function', function: { name: 'test.dynamic', description: 'd', parameters: { type: 'object', properties: {} } } },
      execute: async () => ({ ok: true, data: 'ran' }),
    });
    expect(skillRegistry.has('test.dynamic')).toBe(true);

    // reload — 动态加的应被清掉, 内置应该恢复
    const result = await reloadSkillRegistry({ actorUserId: 'admin1' });
    expect(result.beforeCount).toBe(initialIds.length + 1);
    expect(result.removed).toContain('test.dynamic');

    const afterIds = skillRegistry.list().map((s) => s.id).sort();
    expect(afterIds).toEqual(initialIds);
  });

  it('reload 过滤 governance 中 suspended 的 skill', async () => {
    const { skillRegistry } = await import('@/lib/taf/skills/registry');
    const { reloadSkillRegistry } = await import('@/lib/taf/skills/reload');

    // 先 reload 一次确保 baseline
    await reloadSkillRegistry({});
    const baselineSkills = skillRegistry.list().map((s) => s.id);
    expect(baselineSkills.length).toBeGreaterThan(0);
    const targetSkill = baselineSkills[0];

    // 直接往 skillRegistry store 塞一个 suspended record
    const store = getStore();
    const now = new Date().toISOString();
    await store.skillRegistry.create({
      id: 'reg_suspended_1',
      skillId: targetSkill,
      status: 'suspended',
      tenantId: 'default',
      authorUserId: 'u1',
      submittedAt: now,
      updatedAt: now,
    } as never);

    const result = await reloadSkillRegistry({ tenantId: 'default' });
    // suspended 的 skill 应被移除
    expect(skillRegistry.has(targetSkill)).toBe(false);
    expect(result.removed).toContain(targetSkill);

    // 清理: 恢复
    const recs = await store.skillRegistry.list({ tenantId: 'default' } as never);
    for (const r of recs) await store.skillRegistry.delete(r.id);
    await reloadSkillRegistry({});
  });

  it('registry size() + has() + unregister() 基本契约', async () => {
    const { skillRegistry } = await import('@/lib/taf/skills/registry');
    const sizeBefore = skillRegistry.size();
    skillRegistry.register({
      id: 'tmp.skill',
      description: 't',
      zone: 'green',
      proxyAllowed: true,
      estimatedTokens: 100,
      tags: [],
      schema: { type: 'function', function: { name: 'tmp.skill', description: '', parameters: { type: 'object', properties: {} } } },
      execute: async () => ({ ok: true, data: null }),
    });
    expect(skillRegistry.has('tmp.skill')).toBe(true);
    expect(skillRegistry.size()).toBe(sizeBefore + 1);
    expect(skillRegistry.unregister('tmp.skill')).toBe(true);
    expect(skillRegistry.has('tmp.skill')).toBe(false);
    expect(skillRegistry.unregister('nope.skill')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V2-#12 · multi-step native mode
// ---------------------------------------------------------------------------

describe('§V2-#12 · runMultiStep mode=native', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('mode=native + toolset 非空 → 走 runToolLoop (无工具调用直接收敛)', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => ({
          id: 'fake',
          message: { role: 'assistant', content: '直接答复' },
          finishReason: 'stop',
          usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
          model: 'mock',
        }),
      }),
    }));
    const { runMultiStep } = await import('@/lib/agent-runtime/multi-step');
    const r = await runMultiStep({
      systemPrompt: 'sys',
      userQuery: 'hi',
      actorUserId: 'u1',
      toolset: ['memory.search'],
      mode: 'native',
    });
    expect(r.finalAnswer).toBe('直接答复');
    expect(r.finishedNaturally).toBe(true);
    // trace 最后一项标 finished
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.trace.at(-1)?.finished).toBe(true);
  });

  it('mode=native + toolset 为空 → 降级到 prompt 模式 (向后兼容)', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => ({
          id: 'fake',
          message: {
            role: 'assistant',
            content: JSON.stringify({ thought: 'ok', finalAnswer: 'prompt-mode', finished: true }),
          },
          finishReason: 'stop',
          usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
          model: 'mock',
        }),
      }),
    }));
    const { runMultiStep } = await import('@/lib/agent-runtime/multi-step');
    const r = await runMultiStep({
      systemPrompt: 'sys',
      userQuery: 'q',
      actorUserId: 'u1',
      mode: 'native', // 无 toolset → 走 prompt
    });
    expect(r.finalAnswer).toBe('prompt-mode');
  });
});
