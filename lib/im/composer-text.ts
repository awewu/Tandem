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

type PersonMentionKind = 'notify' | 'assign' | 'consult' | 'persona';

export interface PendingPersonMention {
  userId: string;
  name: string;
  kind?: PersonMentionKind;
  start: number;
  end: number;
  text: string;
}

export function buildPersonMentionDisplay(input: { userId: string; name: string }): string {
  const displayName = input.name.trim() || input.userId;
  return `@${displayName} `;
}

export function buildPersonMentionToken(input: {
  userId: string;
  name: string;
  kind?: PersonMentionKind;
}): string {
  const safeName = input.name.replace(/[\[\]\(\)]/g, '').trim() || input.userId;
  return `@[${safeName}](${input.userId}:${input.kind ?? 'notify'}) `;
}

export function reconcilePendingPersonMentionRanges(
  previous: string,
  next: string,
  mentions: PendingPersonMention[],
): PendingPersonMention[] {
  if (previous === next) return mentions;

  let prefixLength = 0;
  while (
    prefixLength < previous.length &&
    prefixLength < next.length &&
    previous[prefixLength] === next[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previous.length - prefixLength &&
    suffixLength < next.length - prefixLength &&
    previous[previous.length - 1 - suffixLength] === next[next.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const previousEditEnd = previous.length - suffixLength;
  const delta = next.length - previous.length;

  return mentions.flatMap((mention) => {
    let start = mention.start;
    let end = mention.end;

    if (end <= prefixLength) {
      // Edit is after this mention.
    } else if (start >= previousEditEnd) {
      start += delta;
      end += delta;
    } else {
      return [];
    }

    if (start < 0 || end > next.length || next.slice(start, end) !== mention.text) {
      return [];
    }
    return [{ ...mention, start, end }];
  });
}

export function encodePendingPersonMentionsForSend(input: string, mentions: PendingPersonMention[]): string {
  return [...mentions]
    .sort((a, b) => b.start - a.start)
    .reduce((body, mention) => {
      if (
        mention.start < 0 ||
        mention.end < mention.start ||
        mention.end > body.length ||
        body.slice(mention.start, mention.end) !== mention.text
      ) {
        return body;
      }
      const token = buildPersonMentionToken(mention).trimEnd();
      return body.slice(0, mention.start) + token + body.slice(mention.end);
    }, input);
}
