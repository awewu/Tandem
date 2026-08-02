import { describe, it, expect } from 'vitest';
import { parseMailQuery, hasStructuredCriteria } from '@/lib/mail/search-query';

describe('parseMailQuery', () => {
  it('parses free text', () => {
    const q = parseMailQuery('报价 合同');
    expect(q.text).toBe('报价 合同');
    expect(hasStructuredCriteria(q)).toBe(false);
  });

  it('parses from/to/cc/subject operators', () => {
    const q = parseMailQuery('from:alice@x.com to:bob subject:报价 cc:carol');
    expect(q.from).toBe('alice@x.com');
    expect(q.to).toBe('bob');
    expect(q.subject).toBe('报价');
    expect(q.cc).toBe('carol');
    expect(hasStructuredCriteria(q)).toBe(true);
  });

  it('parses has:attachment', () => {
    expect(parseMailQuery('has:attachment').hasAttachment).toBe(true);
    expect(parseMailQuery('has:attachments').hasAttachment).toBe(true);
  });

  it('parses is:unread / is:read / is:starred', () => {
    expect(parseMailQuery('is:unread').seen).toBe(false);
    expect(parseMailQuery('is:read').seen).toBe(true);
    expect(parseMailQuery('is:starred').flagged).toBe(true);
    expect(parseMailQuery('is:flagged').flagged).toBe(true);
  });

  it('parses before/after/since dates and ignores invalid', () => {
    const q = parseMailQuery('before:2026-01-31 after:2026-01-01');
    expect(q.before).toBe('2026-01-31');
    expect(q.since).toBe('2026-01-01');
    const bad = parseMailQuery('before:notadate');
    expect(bad.before).toBeUndefined();
    expect(bad.text).toBe('before:notadate');
  });

  it('parses in:all and specific folders', () => {
    expect(parseMailQuery('in:all').allFolders).toBe(true);
    const q = parseMailQuery('in:sent in:drafts');
    expect(q.folders).toEqual(['sent', 'drafts']);
    expect(parseMailQuery('in:spam').folders).toEqual(['junk']);
  });

  it('keeps quoted phrases intact', () => {
    const q = parseMailQuery('subject:"季度 报价单" 你好');
    expect(q.subject).toBe('季度 报价单');
    expect(q.text).toBe('你好');
  });

  it('mixes operators with free text', () => {
    const q = parseMailQuery('from:alice 合同 has:attachment is:unread');
    expect(q.from).toBe('alice');
    expect(q.text).toBe('合同');
    expect(q.hasAttachment).toBe(true);
    expect(q.seen).toBe(false);
  });

  it('treats unknown operators as free text', () => {
    const q = parseMailQuery('foo:bar baz');
    expect(q.text).toBe('foo:bar baz');
  });
});
