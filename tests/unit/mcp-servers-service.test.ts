/**
 * MCP Server 持久化服务 · 回归锁 (B-002)
 *
 * 覆盖: upsert → DB 落库 → syncMcpServersToRegistry 进内存注册表 →
 *       getAllMcpTools 可见 (stub server 配 tools) → delete 后注销。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  listMcpServerRecords,
  upsertMcpServerRecord,
  deleteMcpServerRecord,
  syncMcpServersToRegistry,
} from '@/lib/settings/mcp-servers';
import { listMcpServers, getMcpServer, unregisterMcpServer } from '@/lib/agent-runtime/mcp-bridge';

describe('mcp-servers 持久化服务', () => {
  beforeEach(() => {
    setStore(createInMemoryStore());
    // 清掉上轮残留的内存注册
    for (const s of listMcpServers()) unregisterMcpServer(s.name);
  });

  it('upsert 落库 + 再 upsert 同名是更新而非新增', async () => {
    await upsertMcpServerRecord({ name: 'github', description: 'v1', endpoint: 'https://a/sse', transport: 'sse' }, 'admin1');
    await upsertMcpServerRecord({ name: 'github', description: 'v2', endpoint: 'https://b/sse', transport: 'sse' }, 'admin1');
    const recs = await listMcpServerRecords();
    expect(recs.length).toBe(1);
    expect(recs[0].description).toBe('v2');
    expect(recs[0].endpoint).toBe('https://b/sse');
  });

  it('默认值: mode=stub, enabled=false, baseline 守门=true', async () => {
    await upsertMcpServerRecord({ name: 'linear', endpoint: 'https://x/sse', transport: 'sse' }, 'admin1');
    const rec = (await listMcpServerRecords())[0];
    expect(rec.mode).toBe('stub');
    expect(rec.enabled).toBe(false);
    expect(rec.requireBaselineGuard).toBe(true);
  });

  it('sync 把 DB 记录注册进 mcp-bridge 内存注册表 (scope 字符串拆成数组)', async () => {
    await upsertMcpServerRecord(
      { name: 'github', endpoint: 'https://a/sse', transport: 'sse', enabled: true, dataScope: 'list_, get_', actionScope: '' },
      'admin1',
    );
    await syncMcpServersToRegistry();
    const reg = getMcpServer('github');
    expect(reg).toBeDefined();
    expect(reg?.enabled).toBe(true);
    expect(reg?.gateway?.dataScope).toEqual(['list_', 'get_']);
    expect(reg?.gateway?.actionScope).toEqual([]);
  });

  it('sync 注销已从 DB 删除的 server', async () => {
    await upsertMcpServerRecord({ name: 'github', endpoint: 'https://a/sse', transport: 'sse', enabled: true }, 'admin1');
    await syncMcpServersToRegistry();
    expect(getMcpServer('github')).toBeDefined();

    await deleteMcpServerRecord('github');
    expect(getMcpServer('github')).toBeUndefined(); // delete 内已注销
    await syncMcpServersToRegistry();
    expect(getMcpServer('github')).toBeUndefined();
    expect((await listMcpServerRecords()).length).toBe(0);
  });

  it('delete 不存在的 server 返回 false', async () => {
    expect(await deleteMcpServerRecord('ghost')).toBe(false);
  });
});
