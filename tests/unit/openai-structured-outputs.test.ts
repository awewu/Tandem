/**
 * §B-004 · OpenAI Structured Outputs wire 转换单测
 *
 * 覆盖:
 *  1. undefined / 'text' → undefined (LLM 自由格式)
 *  2. 'json' → { type: 'json_object' } (旧式 兼容)
 *  3. { type:'json_schema', ... } → { type:'json_schema', json_schema: {...} } 严格 schema
 *  4. strict 默认 true, 显式 false 透传
 *  5. complex schema (nested, enum, minItems) 完整透传
 */
import { describe, it, expect } from 'vitest';
import { buildResponseFormat } from '../../lib/taf/provider/openai-compatible';

describe('buildResponseFormat', () => {
  it('undefined → undefined', () => {
    expect(buildResponseFormat(undefined)).toBeUndefined();
  });

  it('text → undefined', () => {
    expect(buildResponseFormat('text')).toBeUndefined();
  });

  it('json → { type: json_object } (旧式)', () => {
    expect(buildResponseFormat('json')).toEqual({ type: 'json_object' });
  });

  it('json_schema · 默认 strict=true', () => {
    const out = buildResponseFormat({
      type: 'json_schema',
      name: 'my_schema',
      schema: { type: 'object', properties: { x: { type: 'string' } } },
    });
    expect(out).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'my_schema',
        schema: { type: 'object', properties: { x: { type: 'string' } } },
        strict: true,
      },
    });
  });

  it('json_schema · 显式 strict=false 透传', () => {
    const out = buildResponseFormat({
      type: 'json_schema',
      name: 'lax',
      strict: false,
      schema: { type: 'object' },
    });
    expect((out as { json_schema: { strict: boolean } }).json_schema.strict).toBe(false);
  });

  it('json_schema · 复杂 schema (enum/required/minItems) 完整透传', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['route', 'tags'],
      properties: {
        route: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
        risk: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
    };
    const out = buildResponseFormat({
      type: 'json_schema',
      name: 'complex',
      schema,
    }) as { json_schema: { schema: typeof schema } };
    expect(out.json_schema.schema).toEqual(schema);
  });
});
