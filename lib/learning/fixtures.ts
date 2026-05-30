/**
 * Learning fixtures · P2 MVP 期 mock 数据
 *
 * P5 数据通路打通后, 这些应来自真实 LessonStore.
 */

import type { Lesson } from './types';

export const FIXTURE_LESSONS: Lesson[] = [
  {
    id: 'l_onboarding_culture',
    title: '公司文化与价值观',
    category: 'onboarding',
    requirement: 'mandatory_once',
    durationMin: 12,
    summary: '了解我们为什么存在 / 反对什么 / 鼓励什么',
    sourceRefs: [{ type: 'memory', id: 'mem_culture' }],
    rewardMode: 'strategy',
    rewardScore: 3,
  },
  {
    id: 'l_onboarding_org',
    title: '组织架构与汇报关系',
    category: 'onboarding',
    requirement: 'mandatory_once',
    durationMin: 8,
    summary: '快速看懂团队结构 + 30/60/90 天目标',
    sourceRefs: [{ type: 'document', id: 'doc_org' }],
  },
  {
    id: 'l_compliance_data_security',
    title: '数据安全 v3.2',
    category: 'compliance',
    requirement: 'mandatory_quarterly',
    durationMin: 15,
    summary: '红线: 客户数据 / 个人 PII / 商业秘密 三类处理规范',
    sourceRefs: [{ type: 'memory', id: 'mem_red_security' }],
  },
  {
    id: 'l_compliance_ethics',
    title: '反贿赂与廉洁',
    category: 'compliance',
    requirement: 'mandatory_quarterly',
    durationMin: 10,
    summary: '员工守则 § 4-7 · 灰区案例库',
    sourceRefs: [{ type: 'memory', id: 'mem_red_ethics' }],
  },
  {
    id: 'l_products_a',
    title: '产品 A 深潜',
    category: 'products',
    requirement: 'recommended',
    durationMin: 25,
    summary: '产品 A 价值主张 / 客户故事 / 核心数据',
    sourceRefs: [{ type: 'material', id: 'mat_product_a' }],
    rewardMode: 'pm',
    rewardScore: 5,
  },
  {
    id: 'l_processes_decision_card',
    title: '决议流程 SOP',
    category: 'processes',
    requirement: 'recommended',
    durationMin: 8,
    summary: '什么情况开议事室 / 17 分钟硬上限怎么用',
    sourceRefs: [{ type: 'memory', id: 'mem_sop_decision' }],
    rewardMode: 'pm',
    rewardScore: 4,
  },
  {
    id: 'l_tracks_manager',
    title: '新晋经理训练营',
    category: 'tracks',
    requirement: 'elective',
    durationMin: 60,
    summary: '从 IC 到经理的转型 · 1on1 / KR 设计 / 团队效能',
    sourceRefs: [{ type: 'material', id: 'mat_manager_track' }],
    rewardMode: 'strategy',
    rewardScore: 10,
  },
];

/** 按类别分组 */
export function groupLessonsByCategory(): Record<string, Lesson[]> {
  const out: Record<string, Lesson[]> = {};
  for (const l of FIXTURE_LESSONS) {
    (out[l.category] ??= []).push(l);
  }
  return out;
}
