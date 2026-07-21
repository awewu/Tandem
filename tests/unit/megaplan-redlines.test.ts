/**
 * 单测 · 四方案归因 + 业务红线硬拒 + 快慢双轨门控 (2026-07 治理倒置)
 */
import { describe, it, expect } from 'vitest';
import { matchHardRefuse, HARD_REFUSE_TOPICS } from '@/lib/governance/hard-refuse-redlines';
import { megaplanOutcomeFor } from '@/lib/persona/megaplan';
import { shouldFullCritique } from '@/lib/persona/answer-pipeline';

describe('业务红线硬拒 · matchHardRefuse', () => {
  it('命中薪资类关键词 → hit + redirect', () => {
    const r = matchHardRefuse('帮我算一下我该涨薪多少');
    expect(r.hit).toBe(true);
    expect(r.topicId).toBe('compensation');
    expect(r.redirect).toBeTruthy();
  });

  it('命中裁员类关键词 → hit', () => {
    expect(matchHardRefuse('这个人该不该裁员').hit).toBe(true);
  });

  it('普通业务问题 → 不命中', () => {
    expect(matchHardRefuse('这个季度 OKR 进度怎么样').hit).toBe(false);
  });

  it('空输入 → 不命中', () => {
    expect(matchHardRefuse('').hit).toBe(false);
    expect(matchHardRefuse('   ').hit).toBe(false);
  });

  it('每个红线主题都有关键词与转人工指引', () => {
    for (const t of HARD_REFUSE_TOPICS) {
      expect(t.keywords.length).toBeGreaterThan(0);
      expect(t.redirect.length).toBeGreaterThan(0);
    }
  });
});

describe('四方案归因 · megaplanOutcomeFor', () => {
  it('选 AI 推荐 → adopted', () => {
    expect(megaplanOutcomeFor('ai').outcome).toBe('adopted');
  });
  it('选 SOP → modified', () => {
    expect(megaplanOutcomeFor('sop').outcome).toBe('modified');
  });
  it('选最佳实践 → modified', () => {
    expect(megaplanOutcomeFor('best_practice').outcome).toBe('modified');
  });
  it('选个人补充 → overruled', () => {
    expect(megaplanOutcomeFor('personal').outcome).toBe('overruled');
  });
});

describe('快慢双轨 · shouldFullCritique', () => {
  it('复杂/决策类问题 → 跑全环', () => {
    expect(shouldFullCritique('我们应该砍哪个项目?', 100).full).toBe(true);
  });

  it('简单短问题 + 短回答 → 快道跳过 critique', () => {
    expect(shouldFullCritique('你好', 30).full).toBe(false);
  });

  it('回答过长 → 即便非决策类也跑全环 (可能夹带结论)', () => {
    expect(shouldFullCritique('介绍下公司', 800).full).toBe(true);
  });
});
