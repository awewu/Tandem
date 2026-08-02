/**
 * tests/unit/tool-loop-trace.test.ts · runToolLoop eval trace 埋点
 *
 * 验证: 当 ToolLoopInput.trace 提供 kind 时, runToolLoop 执行结束后会落一条 eval trace。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { runToolLoop } from '@/lib/agent-runtime/tool-loop';

const GLOBAL_ROUTER_KEY = '__tandem_router__';
let prevRouter: unknown;

function fakeRouter() {
  return {
    chat: async () => ({
      message: { role: 'assistant' as const, content: 'done' },
      usage: { totalTokens: 10 },
      finishReason: 'stop',
    }),
  };
}

beforeEach(() => {
  setStore(createInMemoryStore());
  prevRouter = (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY];
  (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = fakeRouter();
});

afterEach(() => {
  (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = prevRouter;
});

describe('runToolLoop trace capture', () => {
  it('omits eval trace when trace option is absent', async () => {
    await runToolLoop({
      systemPrompt: 'sys',
      userQuery: 'hi',
      toolset: [],
      actorUserId: 'u1',
      tenantId: 'default',
    });
    const traces = await getStore().evalTraces.list();
    expect(traces).toHaveLength(0);
  });

  it('records eval trace with rule grades when trace option provided', async () => {
    await runToolLoop({
      systemPrompt: 'sys',
      userQuery: 'hi',
      toolset: [],
      actorUserId: 'u1',
      tenantId: 'default',
      trace: { kind: 'reasoning' },
    });
    const traces = await getStore().evalTraces.list();
    expect(traces).toHaveLength(1);
    const trace = traces[0];
    expect(trace.kind).toBe('reasoning');
    expect(trace.inputSummary).toContain('hi');
    expect(trace.finalOutputSummary).toBe('done');
    expect(trace.grades?.length ?? 0).toBeGreaterThan(0);
  });

  it('records eval trace even on runtime error', async () => {
    (globalThis as Record<string, unknown>)[GLOBAL_ROUTER_KEY] = {
      chat: async () => {
        throw new Error('boom');
      },
    };
    const result = await runToolLoop({
      systemPrompt: 'sys',
      userQuery: 'hi',
      toolset: [],
      actorUserId: 'u1',
      tenantId: 'default',
      trace: { kind: 'act' },
    });
    expect(result.finishedNaturally).toBe(false);
    const traces = await getStore().evalTraces.list();
    expect(traces).toHaveLength(1);
    expect(traces[0].kind).toBe('act');
  });
});
