/**
 * 多模态图片管道 · 回归锁 (B 加厚)
 *
 * 覆盖两段:
 *   1. buildUserContent: 文本+图片 → ContentPart[]; 无图 → 纯字符串 (向后兼容)
 *   2. transformMessageForWire: ContentPart 的 camelCase imageUrl → OpenAI 线协议 snake_case image_url
 *      (这是图片真正能发到模型的关键 —— 不转则被 API 拒/忽略)
 */
import { describe, it, expect } from 'vitest';
import { buildUserContent } from '@/lib/agent-runtime/tool-loop';
import { transformMessageForWire } from '@/lib/taf/provider/openai-compatible';
import type { ContentPart } from '@/lib/taf/provider/types';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANS';
const HTTP_URL = 'https://example.com/a.png';

describe('buildUserContent', () => {
  it('无图片 → 返回纯字符串 (现有调用方零变化)', () => {
    expect(buildUserContent('你好', [])).toBe('你好');
    expect(buildUserContent('你好', undefined)).toBe('你好');
  });

  it('有图片 → 返回 [文本, ...image_url] ContentPart 数组', () => {
    const out = buildUserContent('看这张图', [HTTP_URL, DATA_URL]) as ContentPart[];
    expect(Array.isArray(out)).toBe(true);
    expect(out[0]).toEqual({ type: 'text', text: '看这张图' });
    expect(out[1]).toEqual({ type: 'image_url', imageUrl: { url: HTTP_URL } });
    expect(out[2]).toEqual({ type: 'image_url', imageUrl: { url: DATA_URL } });
  });

  it('过滤空白 / 非法 (非 http、非 data:image) 项', () => {
    const out = buildUserContent('q', ['', '  ', 'ftp://x', 'data:text/plain;base64,xx', HTTP_URL]);
    expect(Array.isArray(out)).toBe(true);
    const arr = out as ContentPart[];
    // 只剩 1 张合法图片
    expect(arr.filter((p) => p.type === 'image_url')).toHaveLength(1);
  });

  it('全部图片非法 → 退回纯字符串', () => {
    expect(buildUserContent('q', ['ftp://x', ''])).toBe('q');
  });
});

describe('transformMessageForWire · 多模态线协议', () => {
  it('camelCase imageUrl → snake_case image_url', () => {
    const wire = transformMessageForWire({
      role: 'user',
      content: [
        { type: 'text', text: '看图' },
        { type: 'image_url', imageUrl: { url: HTTP_URL } },
      ],
    });
    const content = wire.content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({ type: 'text', text: '看图' });
    expect(content[1]).toEqual({ type: 'image_url', image_url: { url: HTTP_URL } });
    // 确认没把内部的 camelCase 漏到线上
    expect(JSON.stringify(content)).not.toContain('imageUrl');
  });

  it('纯字符串 content 原样保留', () => {
    const wire = transformMessageForWire({ role: 'user', content: '纯文本' });
    expect(wire.content).toBe('纯文本');
  });

  it('cacheControl=ephemeral + 多模态: 图片仍转 snake_case, cache_control 挂最后文本 part', () => {
    const wire = transformMessageForWire({
      role: 'user',
      content: [
        { type: 'image_url', imageUrl: { url: HTTP_URL } },
        { type: 'text', text: '末尾文本' },
      ],
      cacheControl: 'ephemeral',
    });
    const content = wire.content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({ type: 'image_url', image_url: { url: HTTP_URL } });
    expect(content[1]).toMatchObject({ type: 'text', text: '末尾文本', cache_control: { type: 'ephemeral' } });
  });
});
