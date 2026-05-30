/**
 * §B-003 · Anthropic Prompt Caching wire transform 单测
 *
 * 覆盖:
 *  1. 普通消息 (无 cacheControl) → content 透传 string
 *  2. ephemeral + string content → 包成 [{type:'text', text, cache_control:{type:'ephemeral'}}]
 *  3. ephemeral + ContentPart[] → 仅最后一个 text part 上挂 cache_control
 *  4. role/name/toolCallId/toolCalls 字段保留
 *  5. ephemeral + image-only content → 不强加 cache_control (避免 wire 错误)
 */
import { describe, it, expect } from 'vitest';
import { transformMessageForWire } from '../../lib/taf/provider/openai-compatible';
import type { ChatMessage } from '../../lib/taf/provider/types';

describe('transformMessageForWire · prompt caching', () => {
  it('passes through ordinary message with string content', () => {
    const m: ChatMessage = { role: 'user', content: 'hello' };
    const wire = transformMessageForWire(m);
    expect(wire.role).toBe('user');
    expect(wire.content).toBe('hello');
    expect('cache_control' in wire).toBe(false);
  });

  it('wraps string content in [{text, cache_control}] when cacheControl=ephemeral', () => {
    const m: ChatMessage = {
      role: 'system',
      content: 'big system prompt',
      cacheControl: 'ephemeral',
    };
    const wire = transformMessageForWire(m);
    expect(wire.role).toBe('system');
    expect(wire.content).toEqual([
      { type: 'text', text: 'big system prompt', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('attaches cache_control only to last text part when content is ContentPart[]', () => {
    const m: ChatMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'first' },
        { type: 'image_url', imageUrl: { url: 'http://x' } },
        { type: 'text', text: 'last big block' },
      ],
      cacheControl: 'ephemeral',
    };
    const wire = transformMessageForWire(m);
    const parts = wire.content as Array<Record<string, unknown>>;
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ type: 'text', text: 'first' }); // 无 cache_control
    expect(parts[1]).toEqual({ type: 'image_url', imageUrl: { url: 'http://x' } });
    expect(parts[2]).toEqual({
      type: 'text',
      text: 'last big block',
      cache_control: { type: 'ephemeral' },
    });
  });

  it('preserves role/name/toolCallId/toolCalls', () => {
    const m: ChatMessage = {
      role: 'tool',
      content: 'result',
      name: 'my_fn',
      toolCallId: 'call_123',
      toolCalls: [{ id: 'c', type: 'function', function: { name: 'f', arguments: '{}' } }],
    };
    const wire = transformMessageForWire(m);
    expect(wire.role).toBe('tool');
    expect(wire.name).toBe('my_fn');
    expect(wire.tool_call_id).toBe('call_123');
    expect(Array.isArray(wire.tool_calls)).toBe(true);
  });

  it('does not crash on image-only content with cacheControl (last part not text)', () => {
    const m: ChatMessage = {
      role: 'user',
      content: [{ type: 'image_url', imageUrl: { url: 'http://img' } }],
      cacheControl: 'ephemeral',
    };
    const wire = transformMessageForWire(m);
    const parts = wire.content as Array<Record<string, unknown>>;
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('image_url');
    expect('cache_control' in parts[0]).toBe(false);
  });
});
