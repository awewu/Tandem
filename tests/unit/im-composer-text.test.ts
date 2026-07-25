import { describe, expect, it } from 'vitest';
import { buildPersonMentionToken, insertTextAtSelection, messageBodyForSend } from '@/lib/im/composer-text';
import { parseMentions } from '@/lib/types/im';

describe('IM composer text', () => {
  it('preserves pasted multiline text exactly', () => {
    const pasted = '第一行\r\n第二行\n\n第四行';
    const result = insertTextAtSelection('前后', pasted, 1, 1);

    expect(result.value).toBe(`前${pasted}后`);
    expect(result.caret).toBe(1 + pasted.length);
  });

  it('replaces the selected range without changing line breaks', () => {
    const result = insertTextAtSelection('开始-旧内容-结束', '新内容\n第二行', 3, 6);
    expect(result.value).toBe('开始-新内容\n第二行-结束');
  });

  it('preserves meaningful leading and trailing whitespace when sending', () => {
    const body = '  第一行\n第二行\n  ';
    expect(messageBodyForSend(body)).toBe(body);
    expect(messageBodyForSend(' \n\t ')).toBe('');
  });

  it('builds a person mention token that the IM service parser understands', () => {
    const token = buildPersonMentionToken({ userId: 'user-2', name: '张三' });

    expect(token).toBe('@[张三](user-2:notify) ');
    expect(parseMentions(`请 ${token} 看一下`)).toMatchObject([
      { userId: 'user-2', kind: 'notify' },
    ]);
  });

  it('sanitizes display names that would break the mention token syntax', () => {
    const token = buildPersonMentionToken({ userId: 'user-3', name: '李四(研发)[A]' });

    expect(token).toBe('@[李四研发A](user-3:notify) ');
    expect(parseMentions(token)).toMatchObject([
      { userId: 'user-3', kind: 'notify' },
    ]);
  });

  it('keeps insertion behavior stable when inserting a person mention token', () => {
    expect(insertTextAtSelection('hello world', '@[张三](user-2:notify) ', 6, 11)).toEqual({
      value: 'hello @[张三](user-2:notify) ',
      caret: 27,
    });
  });
});
