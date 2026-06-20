/**
 * 搭字手抄 · 块编辑器序列化 (parseMarkdown ⇄ serializeBlocks) 往返一致性
 *
 * 核心契约: 块编辑不破坏底层 content:string 数据模型, Markdown 往返幂等.
 */
import { describe, it, expect } from 'vitest';
import { parseMarkdown, serializeBlocks } from '@/components/shouchao/block-serialize';

function roundtrip(md: string): string {
  return serializeBlocks(parseMarkdown(md));
}

describe('block-editor 序列化', () => {
  it('标题/段落往返一致', () => {
    const md = '# 大标题\n## 小标题\n这是一段正文';
    expect(roundtrip(md)).toBe(md);
  });

  it('无序/有序列表往返一致', () => {
    const md = '- 苹果\n- 香蕉\n1. 第一\n2. 第二';
    expect(roundtrip(md)).toBe(md);
  });

  it('待办块保留勾选状态', () => {
    const md = '- [ ] 未完成\n- [x] 已完成';
    expect(roundtrip(md)).toBe(md);
  });

  it('引用 / 分割线往返一致', () => {
    const md = '> 一句引用\n---';
    expect(roundtrip(md)).toBe(md);
  });

  it('代码块保留多行内容', () => {
    const md = '```\nconst a = 1;\nconst b = 2;\n```';
    expect(roundtrip(md)).toBe(md);
  });

  it('有序列表序号连续, 被打断后重置', () => {
    const blocks = parseMarkdown('1. a\n2. b\n- x\n1. c');
    const out = serializeBlocks(blocks);
    expect(out).toBe('1. a\n2. b\n- x\n1. c');
  });

  it('空内容产生至少一个空段落块', () => {
    const blocks = parseMarkdown('');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('p');
    expect(blocks[0].text).toBe('');
  });

  it('未知行降级为段落, 不丢内容', () => {
    const md = '普通一行没有任何标记';
    expect(roundtrip(md)).toBe(md);
  });
});
