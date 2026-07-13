import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerMcpServer,
  unregisterMcpServer,
  listMcpServers,
  getAllMcpTools,
  invokeMcp,
} from '@/lib/agent-runtime/mcp-bridge';
import type { ToolSchema } from '@/lib/taf/provider/types';

// B-002 通路: 锁定 tool-loop 接入 MCP 所依赖的桥接契约 (注册→暴露→4道闸→stub).
// 不连真实 server / 不调 LLM, 纯确定性.

const TOOL_READ: ToolSchema = {
  type: 'function',
  function: { name: 'list_issues', description: '列出 issue', parameters: { type: 'object', properties: {} } },
};
const TOOL_WRITE: ToolSchema = {
  type: 'function',
  function: { name: 'create_issue', description: '创建 issue', parameters: { type: 'object', properties: {} } },
};

const SERVER = 'testmcp';

function registerStub() {
  registerMcpServer({
    name: SERVER,
    description: '测试 MCP server',
    transport: 'http',
    endpoint: 'http://127.0.0.1:0/mcp',
    tools: [TOOL_READ, TOOL_WRITE],
    enabled: true,
    mode: 'stub',
    gateway: {
      requireBaselineGuard: false,
      requireOkrDriftCheck: false,
      dataScope: ['list_'],   // 只允许 list_* 工具
      actionScope: [],
    },
  });
}

describe('mcp-bridge · B-002 通路契约', () => {
  beforeEach(() => {
    unregisterMcpServer(SERVER);
  });

  it('注册后出现在 listMcpServers', () => {
    registerStub();
    expect(listMcpServers().some((s) => s.name === SERVER)).toBe(true);
  });

  it('getAllMcpTools 暴露 server 前缀 + sanitized 名 (tool-loop 据此下发给 LLM)', () => {
    registerStub();
    const names = getAllMcpTools().map((t) => t.function.name);
    expect(names).toContain('testmcp__list_issues');
    expect(names).toContain('testmcp__create_issue');
  });

  it('禁用的 server 不暴露工具', () => {
    registerMcpServer({
      name: SERVER, description: 'x', transport: 'http', endpoint: 'http://x/mcp',
      tools: [TOOL_READ], enabled: false, mode: 'stub',
    });
    const names = getAllMcpTools().map((t) => t.function.name);
    expect(names.some((n) => n.startsWith('testmcp__'))).toBe(false);
  });

  it('dataScope 闸: 白名单内工具放行 (stub 返回 not-implemented, 但已过闸)', async () => {
    registerStub();
    const res = await invokeMcp(`${SERVER}.list_issues`, {}, { actorUserId: 'u1' });
    expect(res.gatewayChecks?.dataScope).toBe('pass');
    // stub 模式: 过闸后仍返回 not-implemented
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/V1 stub|not.implemented/i);
  });

  it('dataScope 闸: 白名单外工具被拒 (不会执行)', async () => {
    registerStub();
    const res = await invokeMcp(`${SERVER}.create_issue`, {}, { actorUserId: 'u1' });
    expect(res.ok).toBe(false);
    expect(res.gatewayChecks?.dataScope).toBe('denied');
    expect(res.error).toMatch(/dataScope/);
  });

  it('未注册 server → 明确报错', async () => {
    const res = await invokeMcp('ghost.do_thing', {}, { actorUserId: 'u1' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not registered/);
  });

  it('非法 toolId (无点) → 报错', async () => {
    const res = await invokeMcp('nodot', {}, { actorUserId: 'u1' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid MCP tool id/);
  });
});
