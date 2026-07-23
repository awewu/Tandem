/**
 * A2 · 个人蒸馏检测纯逻辑 (structure / summarize / link + 签名幂等)
 */
import { describe, it, expect } from 'vitest';
import {
  detectStructurable,
  detectLongForSummary,
  buildCandidates,
  signatureOf,
  jaccard,
  tokenizeMixed,
  type DistillNote,
} from '@/lib/shouchao/distill-detect';

function note(id: string, title: string, content: string): DistillNote {
  return { id, title, content };
}

describe('detectStructurable', () => {
  it('GFM 表格 → true', () => {
    expect(detectStructurable(note('1', 't', '| a | b |\n| 1 | 2 |'))).toBe(true);
  });
  it('多行清单 → true', () => {
    expect(detectStructurable(note('1', 't', '- 苹果\n- 香蕉\n- 橙子'))).toBe(true);
  });
  it('多行键值 → true', () => {
    expect(detectStructurable(note('1', 't', '姓名: 张三\n年龄: 30\n城市: 上海'))).toBe(true);
  });
  it('普通段落 → false', () => {
    expect(detectStructurable(note('1', 't', '这是一段普通的随笔，没有结构。'))).toBe(false);
  });
});

describe('detectLongForSummary', () => {
  it('超长且无摘要 → true', () => {
    expect(detectLongForSummary(note('1', 't', '正'.repeat(900)))).toBe(true);
  });
  it('短文 → false', () => {
    expect(detectLongForSummary(note('1', 't', '短'))).toBe(false);
  });
  it('已有摘要开头 → false', () => {
    expect(detectLongForSummary(note('1', 't', `摘要: 概览\n${'正'.repeat(900)}`))).toBe(false);
  });
});

describe('signatureOf', () => {
  it('与 noteIds 顺序无关 (排序后拼)', () => {
    expect(signatureOf('link', ['b', 'a'])).toBe(signatureOf('link', ['a', 'b']));
    expect(signatureOf('link', ['a', 'b'])).toBe('link:a,b');
  });
});

describe('jaccard / tokenizeMixed', () => {
  it('相同文本相似度 1, 无交集 0', () => {
    expect(jaccard(tokenizeMixed('年假政策'), tokenizeMixed('年假政策'))).toBe(1);
    expect(jaccard(tokenizeMixed('abc'), tokenizeMixed('xyz'))).toBe(0);
  });
});

describe('buildCandidates', () => {
  it('相近两条笔记 → link 候选', () => {
    const notes = [
      note('a', '年假政策', '公司年假政策：满一年 5 天，满十年 10 天，需提前申请。'),
      note('b', '年假申请', '年假政策申请流程：提前一周，满一年 5 天，走审批。'),
      note('c', '午餐', '今天吃了螺蛳粉。'),
    ];
    const drafts = buildCandidates(notes);
    const link = drafts.find((d) => d.type === 'link');
    expect(link).toBeTruthy();
    expect(link!.noteIds.sort()).toEqual(['a', 'b']);
    expect(link!.signature).toBe('link:a,b');
  });

  it('已互链的两条不再产 link 候选', () => {
    const notes = [
      note('a', '年假政策', '年假政策：满一年 5 天。相关 [[年假申请]]'),
      note('b', '年假申请', '年假政策申请流程：提前一周，满一年 5 天。相关 [[年假政策]]'),
    ];
    expect(buildCandidates(notes).some((d) => d.type === 'link')).toBe(false);
  });

  it('确定性: 同输入同输出签名集合', () => {
    const notes = [note('a', '清单', '- x\n- y\n- z'), note('b', '长文', '正'.repeat(900))];
    const s1 = buildCandidates(notes).map((d) => d.signature).sort();
    const s2 = buildCandidates(notes).map((d) => d.signature).sort();
    expect(s1).toEqual(s2);
    expect(s1).toContain('structure:a');
    expect(s1).toContain('summarize:b');
  });
});
