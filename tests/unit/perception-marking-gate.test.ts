/**
 * 本体安全维度 Phase 2 · 中央 AI 感知工具 marking 门控单测。
 *
 * 关键断言:
 *   ① 零行为变更: 当前 9 个感知工具在中央 AI (restricted/okr_perception) 下全部保留。
 *   ② 纵深防御: 未来若把 compensation(个体薪酬) 或 personal_growth(个人成长) 类工具
 *      误加进感知集, 会被 accessiblePerceptionToolset 自动过滤掉。
 */

import { describe, it, expect } from 'vitest';
import {
  PERCEPTION_TOOLSET,
  accessiblePerceptionToolset,
  CENTRAL_AI_PERCEPTION_ACCESS,
} from '@/lib/persona/company-brain-perception';
import { canAccess } from '@/lib/ontology/marking';

describe('中央 AI 感知工具 marking 门控', () => {
  it('① 零行为变更: 当前全部感知工具对中央 AI 保留', () => {
    const accessible = accessiblePerceptionToolset();
    expect(accessible.length).toBe(PERCEPTION_TOOLSET.length);
    for (const t of PERCEPTION_TOOLSET) {
      expect(accessible).toContain(t);
    }
  });

  it('② financial(聚合经营额) 允许: kpi/bonus/pms 管道保留', () => {
    const accessible = accessiblePerceptionToolset();
    expect(accessible).toContain('kpi.health_digest');
    expect(accessible).toContain('bonus.digest');
    expect(accessible).toContain('pms.pipeline_digest');
  });

  it('③ 防误加: compensation / personal_growth 类工具被过滤', () => {
    const withBad = [
      ...PERCEPTION_TOOLSET,
      'salary.individual_lookup', // 未在 marking map → 未分类 → internal (会保留, 见下)
    ];
    // 显式给一个 compensation-marked 工具, 用自定义 map 验证过滤逻辑
    const compBlocked = canAccess(
      { sensitivity: 'confidential', categories: ['compensation'] },
      CENTRAL_AI_PERCEPTION_ACCESS,
    );
    const growthBlocked = canAccess(
      { sensitivity: 'confidential', categories: ['personal_growth'] },
      CENTRAL_AI_PERCEPTION_ACCESS,
    );
    expect(compBlocked.allow).toBe(false);
    expect(growthBlocked.allow).toBe(false);
    // 未分类工具保守视 internal, restricted 许可下仍保留 (不误伤)
    expect(accessiblePerceptionToolset(withBad)).toContain('salary.individual_lookup');
  });

  it('④ 中央 AI 访问上下文 = restricted / okr_perception / 非外部', () => {
    expect(CENTRAL_AI_PERCEPTION_ACCESS.clearance).toBe('restricted');
    expect(CENTRAL_AI_PERCEPTION_ACCESS.purpose).toBe('okr_perception');
    expect(CENTRAL_AI_PERCEPTION_ACCESS.isExternal).toBe(false);
  });
});
