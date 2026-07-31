/**
 * PMS 感知 skill · pms.pipeline_digest 结构单测
 *
 * 验证中央 AI "销售之眼" 的 skill 契约: 绿区 · 代行允许 · 只读 · schema 合规。
 * 注: execute 走 assembleCockpit (真 Drizzle db), 属集成范畴, 这里只验静态契约。
 * 注册进 registry + PERCEPTION_TOOLSET 的接线待 builtin.ts/perception WIP 落定后补。
 */
import { describe, it, expect } from 'vitest';
import { PmsPipelineDigestSkill } from '@/lib/taf/skills/pms-skills';

describe('pms.pipeline_digest · skill 契约', () => {
  it('是绿区 · 代行允许 · 只读感知工具', () => {
    expect(PmsPipelineDigestSkill.id).toBe('pms.pipeline_digest');
    expect(PmsPipelineDigestSkill.zone).toBe('green');
    expect(PmsPipelineDigestSkill.proxyAllowed).toBe(true);
    // 只读感知不声明写动作 dataScope 越权
    expect(PmsPipelineDigestSkill.dataScope).toBeUndefined();
  });

  it('function-calling schema 名合规 (^[a-zA-Z0-9_-]+$, 无点)', () => {
    const name = PmsPipelineDigestSkill.schema.function.name;
    expect(name).toBe('pms_pipeline_digest');
    expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('描述与标签覆盖销售/管道语义 (供 skill 检索命中)', () => {
    expect(PmsPipelineDigestSkill.tags).toContain('销售');
    expect(PmsPipelineDigestSkill.tags).toContain('管道');
    expect(PmsPipelineDigestSkill.description).toContain('赢单率');
  });
});
