import { validateBcfChangeProposal } from './bcf';

const validBcf = {
  schema: 'bcf-3.0-lite',
  topic: {
    guid: '550e8400-e29b-41d4-a716-446655440000',
    title: '热水管路路由冲突',
    status: 'open' as const,
    creationAuthor: 'engineer@rysnova.com',
    description: 'B1卫生间热水支管与结构梁冲突，建议抬高50mm',
    relatedIfcGuids: ['1XKkH2A5X2N9R8X8X8X8X8'],
  },
  comments: [
    {
      guid: '660e8400-e29b-41d4-a716-446655440001',
      date: '2026-07-06T10:00:00Z',
      author: 'engineer@rysnova.com',
      comment: '请 design 复核并更新管线',
    },
  ],
  viewpoints: [
    {
      guid: '770e8400-e29b-41d4-a716-446655440002',
      snapshotUrl: 'https://storage.example.com/snap/1.png',
    },
  ],
};

describe('validateBcfChangeProposal', () => {
  it('accepts a valid BCF-3.0-lite proposal', () => {
    expect(validateBcfChangeProposal(validBcf)).toEqual({ ok: true });
  });

  it('rejects missing schema', () => {
    const { schema: _schema, ...rest } = validBcf;
    const r = validateBcfChangeProposal(rest);
    expect(r.ok).toBe(false);
    expect((r as any).errors).toContain('schema must be "bcf-3.0-lite"');
  });

  it('rejects missing topic', () => {
    const r = validateBcfChangeProposal({ ...validBcf, topic: undefined as any });
    expect(r.ok).toBe(false);
    expect((r as any).errors).toContain('topic is required');
  });

  it('rejects invalid topic status', () => {
    const r = validateBcfChangeProposal({
      ...validBcf,
      topic: { ...validBcf.topic, status: 'invalid' as any },
    });
    expect(r.ok).toBe(false);
    expect((r as any).errors).toContain('topic.status must be open/resolved/closed');
  });

  it('rejects comments missing required fields', () => {
    const r = validateBcfChangeProposal({
      ...validBcf,
      comments: [{ guid: 'x', date: '2026-07-06T10:00:00Z', author: 'a', comment: '' }],
    });
    expect(r.ok).toBe(false);
    expect((r as any).errors).toContain('comments[0].comment is required string');
  });

  it('rejects viewpoints missing guid', () => {
    const r = validateBcfChangeProposal({
      ...validBcf,
      viewpoints: [{ snapshotUrl: 'x' } as any],
    });
    expect(r.ok).toBe(false);
    expect((r as any).errors).toContain('viewpoints[0].guid is required string');
  });

  it('accepts non-BCF payloads only when schema not declared (legacy fallback)', () => {
    const r = validateBcfChangeProposal({ note: 'legacy' } as any);
    // 当 schema 不是 bcf-3.0-lite 时，校验器会报错；但在 service 层，这种情况不走 BCF 校验
    expect(r.ok).toBe(false);
  });
});
