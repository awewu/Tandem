/**
 * 单测 · 业务红线清单 DB 读写服务 (Admin 热更新)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  getHardRefuseConfig,
  getHardRefuseTopics,
  saveHardRefuseConfig,
  matchHardRefuseLive,
} from '@/lib/governance/hard-refuse-service';
import { DEFAULT_HARD_REFUSE_TOPICS } from '@/lib/governance/hard-refuse-redlines';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('hard-refuse-service', () => {
  it('DB 无记录 → 回落出厂默认', async () => {
    const cfg = await getHardRefuseConfig('default');
    expect(cfg.source).toBe('default');
    expect(cfg.enabled).toBe(true);
    expect(cfg.topics.length).toBe(DEFAULT_HARD_REFUSE_TOPICS.length);
  });

  it('保存后 DB 覆盖默认 + source=db', async () => {
    await saveHardRefuseConfig(
      { enabled: true, topics: [{ id: 'x', label: '测试', keywords: ['禁词甲'], redirect: '转人工' }] },
      'admin@tandem.local',
      'default',
    );
    const cfg = await getHardRefuseConfig('default');
    expect(cfg.source).toBe('db');
    expect(cfg.topics).toHaveLength(1);
    expect(cfg.topics[0].keywords).toContain('禁词甲');
  });

  it('matchHardRefuseLive 命中 DB 自定义关键词', async () => {
    await saveHardRefuseConfig(
      { enabled: true, topics: [{ id: 'x', label: '测试', keywords: ['绝密项目X'], redirect: '转人工' }] },
      'admin@tandem.local',
      'default',
    );
    const r = await matchHardRefuseLive('绝密项目X 什么时候上线', 'default');
    expect(r.hit).toBe(true);
    expect(r.label).toBe('测试');
  });

  it('enabled=false → 全部放行', async () => {
    await saveHardRefuseConfig(
      { enabled: false, topics: [{ id: 'x', label: '测试', keywords: ['涨薪'], redirect: '转人工' }] },
      'admin@tandem.local',
      'default',
    );
    const r = await matchHardRefuseLive('我想涨薪', 'default');
    expect(r.hit).toBe(false);
  });

  it('sanitize: 丢弃空 label / 空关键词的主题', async () => {
    await saveHardRefuseConfig(
      {
        enabled: true,
        topics: [
          { id: 'ok', label: '有效', keywords: ['词', '词', ' '], redirect: '' },
          { label: '', keywords: ['x'] },
          { label: '无词', keywords: [] },
        ],
      },
      'admin@tandem.local',
      'default',
    );
    const topics = await getHardRefuseTopics('default');
    expect(topics).toHaveLength(1);
    expect(topics[0].label).toBe('有效');
    expect(topics[0].keywords).toEqual(['词']); // 去重 + 去空
    expect(topics[0].redirect.length).toBeGreaterThan(0); // 空 redirect 补默认话术
  });

  it('全部主题无效 → 拒绝保存', async () => {
    await expect(
      saveHardRefuseConfig({ topics: [{ label: '', keywords: [] }] }, 'admin@tandem.local', 'default'),
    ).rejects.toThrow();
  });
});
