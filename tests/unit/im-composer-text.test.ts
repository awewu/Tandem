import { describe, expect, it } from 'vitest';
import { insertTextAtSelection, messageBodyForSend } from '@/lib/im/composer-text';

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
});
