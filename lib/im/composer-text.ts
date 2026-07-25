export function messageBodyForSend(input: string): string {
  return input.trim().length > 0 ? input : '';
}

export function insertTextAtSelection(
  value: string,
  text: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): { value: string; caret: number } {
  const start = Math.max(0, Math.min(selectionStart ?? value.length, value.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, value.length));
  return {
    value: value.slice(0, start) + text + value.slice(end),
    caret: start + text.length,
  };
}

export function buildPersonMentionToken(input: {
  userId: string;
  name: string;
  kind?: 'notify' | 'assign' | 'consult' | 'persona';
}): string {
  const safeName = input.name.replace(/[\[\]\(\)]/g, '').trim() || input.userId;
  return `@[${safeName}](${input.userId}:${input.kind ?? 'notify'}) `;
}
