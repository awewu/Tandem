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

  it('图片块往返一致 (serving URL + 图注)', () => {
    const md = '![封面图](/api/shouchao/attachments/sca_123)';
    expect(roundtrip(md)).toBe(md);
    const blocks = parseMarkdown(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('image');
    expect(blocks[0].src).toBe('/api/shouchao/attachments/sca_123');
    expect(blocks[0].alt).toBe('封面图');
  });

  it('图片与正文混排保持顺序', () => {
    const md = '# 标题\n![图](https://ex.com/a.png)\n正文段落';
    const blocks = parseMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual(['h1', 'image', 'p']);
    expect(roundtrip(md)).toBe(md);
  });

  it('空 alt 的图片往返保留', () => {
    const md = '![](/api/shouchao/attachments/x)';
    expect(roundtrip(md)).toBe(md);
  });

  it('callout 块往返一致并解析出变体', () => {
    const md = '> [!TIP] 记得每天写';
    expect(roundtrip(md)).toBe(md);
    const blocks = parseMarkdown(md);
    expect(blocks[0].type).toBe('callout');
    expect(blocks[0].calloutVariant).toBe('TIP');
    expect(blocks[0].text).toBe('记得每天写');
  });

  it('普通引用不被误判为 callout', () => {
    const md = '> 只是一句普通引用';
    const blocks = parseMarkdown(md);
    expect(blocks[0].type).toBe('quote');
    expect(roundtrip(md)).toBe(md);
  });

  it('GFM 表格往返一致', () => {
    const md = '| 姓名 | 年龄 |\n| --- | --- |\n| 小明 | 18 |';
    expect(roundtrip(md)).toBe(md);
    const blocks = parseMarkdown(md);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].rows).toEqual([['姓名', '年龄'], ['小明', '18']]);
  });

  it('折叠块 (details) 往返一致', () => {
    const md = '<details>\n<summary>点开看</summary>\n\n隐藏的内容\n\n</details>';
    expect(roundtrip(md)).toBe(md);
    const blocks = parseMarkdown(md);
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].text).toBe('点开看');
    expect(blocks[0].body).toBe('隐藏的内容');
  });

  it('表格与标题混排保持顺序', () => {
    const md = '# 名单\n| a | b |\n| --- | --- |\n| 1 | 2 |\n结尾段落';
    const blocks = parseMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual(['h1', 'table', 'p']);
    expect(roundtrip(md)).toBe(md);
  });
});
