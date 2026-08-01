export interface MailSearchPerson {
  name?: string;
  address?: string;
}

export interface MailSearchMessage {
  uid: number;
  from?: MailSearchPerson[];
  to?: MailSearchPerson[];
  subject?: string;
  textBody?: string;
  htmlBody?: string;
}

export function normalizeMailSearchQuery(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN');
}

function stripHtmlForSearch(value: string | undefined): string {
  return (value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function personSearchText(
  people: MailSearchPerson[] | undefined,
  resolveName?: (address: string) => string | undefined,
): string {
  return (people ?? [])
    .flatMap((person) => {
      const address = person.address?.trim() ?? '';
      return [person.name, address, address ? resolveName?.(address) : undefined];
    })
    .filter(Boolean)
    .join(' ');
}

export function emailMatchesSearch(
  message: MailSearchMessage,
  normalizedQuery: string,
  resolveName?: (address: string) => string | undefined,
): boolean {
  if (!normalizedQuery) return true;
  const haystack = [
    message.subject,
    personSearchText(message.from, resolveName),
    personSearchText(message.to, resolveName),
    message.textBody,
    stripHtmlForSearch(message.htmlBody),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('zh-CN');
  return haystack.includes(normalizedQuery);
}

export function mergeMailSearchResults<T extends { uid: number }>(remote: T[], local: T[]): T[] {
  const seen = new Set<number>();
  const merged: T[] = [];
  for (const item of [...remote, ...local]) {
    if (seen.has(item.uid)) continue;
    seen.add(item.uid);
    merged.push(item);
  }
  return merged;
}
