/**
 * MCP Server · 只读技能暴露 + JSON-RPC 分发 测试
 *
 * 覆盖:
 *   - 只暴露 green + proxyAllowed 技能 (red / green-not-proxy 不暴露)
 *   - '.' ↔ '-' 命名双向可逆 + 不变量 (暴露技能 id 不含 '-')
 *   - resolveReadOnlySkillId 强校验 (未暴露技能解析为 null)
 *   - dispatch: initialize / tools/list / tools/call(成功·未知·未暴露) / 通知
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { skillRegistry, type Skill } from '@/lib/taf/skills/registry';
import {
  toMcpToolName,
  fromMcpToolName,
  listReadOnlyMcpTools,
  resolveReadOnlySkillId,
} from '@/lib/mcp-server/read-only-tools';
import { handleMcpJsonRpc, MCP_SERVER_INFO } from '@/lib/mcp-server/dispatch';

function mkSkill(id: string, zone: Skill['zone'], proxyAllowed: boolean): Skill {
  return {
    id,
    description: `desc ${id}`,
    tags: ['t'],
    zone,
    proxyAllowed,
    estimatedTokens: 1,
    schema: {
      type: 'function',
      function: {
        name: id.replace(/\./g, '_'),
        description: `desc ${id}`,
        parameters: { type: 'object', properties: { q: { type: 'string' } } },
      },
    },
    execute: async (args) => ({ ok: true, data: { echo: (args as { q?: string })?.q ?? null } }),
  };
}

const principal = { userId: 'u-mcp', tenantId: 'default' };

beforeEach(() => {
  setStore(createInMemoryStore());
  skillRegistry.clear();
  skillRegistry.register(mkSkill('test.read_thing', 'green', true)); // 应暴露
  skillRegistry.register(mkSkill('test.internal', 'green', false)); // green 但不代行 → 不暴露
  skillRegistry.register(mkSkill('test.write_thing', 'yellow', false)); // 写区 → 不暴露
});

describe('read-only-tools · 过滤与命名', () => {
  it('只暴露 green + proxyAllowed 技能', () => {
    const tools = listReadOnlyMcpTools();
    expect(tools.map((t) => t.name)).toEqual(['test-read_thing']);
  });

  it("命名 '.' ↔ '-' 双向可逆", () => {
    expect(toMcpToolName('okr.health_digest')).toBe('okr-health_digest');
    expect(fromMcpToolName('okr-health_digest')).toBe('okr.health_digest');
  });

  it('不变量: 暴露技能 id 不含 - (保证映射无损)', () => {
    for (const s of skillRegistry.list()) {
      if (s.zone === 'green' && s.proxyAllowed) expect(s.id).not.toContain('-');
    }
  });

  it('inputSchema 取自 skill.schema.function.parameters', () => {
    const [tool] = listReadOnlyMcpTools();
    expect(tool.inputSchema).toEqual({ type: 'object', properties: { q: { type: 'string' } } });
  });

  it('resolveReadOnlySkillId: 只解析已暴露技能', () => {
    expect(resolveReadOnlySkillId('test-read_thing')).toBe('test.read_thing');
    expect(resolveReadOnlySkillId('test.read_thing')).toBe('test.read_thing');
    expect(resolveReadOnlySkillId('test-internal')).toBeNull(); // green 但不代行
    expect(resolveReadOnlySkillId('test-write_thing')).toBeNull(); // 写区
    expect(resolveReadOnlySkillId('nope')).toBeNull();
  });
});

describe('dispatch · JSON-RPC', () => {
  it('initialize 返回协议版本 + serverInfo', async () => {
    const res = await handleMcpJsonRpc(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      principal,
    );
    expect(res).not.toBeNull();
    const r = res as { result: { serverInfo: unknown; protocolVersion: string } };
    expect(r.result.serverInfo).toEqual(MCP_SERVER_INFO);
    expect(typeof r.result.protocolVersion).toBe('string');
  });

  it('通知 notifications/initialized 无响应', async () => {
    const res = await handleMcpJsonRpc(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      principal,
    );
    expect(res).toBeNull();
  });

  it('tools/list 只列只读技能', async () => {
    const res = await handleMcpJsonRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, principal);
    const r = res as { result: { tools: Array<{ name: string }> } };
    expect(r.result.tools.map((t) => t.name)).toEqual(['test-read_thing']);
  });

  it('tools/call 成功执行绿区只读技能', async () => {
    const res = await handleMcpJsonRpc(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'test-read_thing', arguments: { q: 'hi' } },
      },
      principal,
    );
    const r = res as { result: { isError: boolean; content: Array<{ text: string }> } };
    expect(r.result.isError).toBe(false);
    expect(JSON.parse(r.result.content[0].text)).toEqual({ echo: 'hi' });
  });

  it('tools/call 未知工具 → isError', async () => {
    const res = await handleMcpJsonRpc(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope' } },
      principal,
    );
    const r = res as { result: { isError: boolean } };
    expect(r.result.isError).toBe(true);
  });

  it('tools/call 未暴露技能(写区)不可调用 → isError', async () => {
    const res = await handleMcpJsonRpc(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'test-write_thing' } },
      principal,
    );
    const r = res as { result: { isError: boolean } };
    expect(r.result.isError).toBe(true);
  });

  it('未知方法 → JSON-RPC error -32601', async () => {
    const res = await handleMcpJsonRpc({ jsonrpc: '2.0', id: 6, method: 'foo/bar' }, principal);
    const r = res as { error: { code: number } };
    expect(r.error.code).toBe(-32601);
  });
});
