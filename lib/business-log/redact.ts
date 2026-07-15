import { createHash } from 'crypto';

const MAX_DEPTH = 6;
const MAX_KEYS = 60;
const MAX_ARRAY = 30;
const MAX_STRING = 512;

const SECRET_KEYS = [
  'password', 'passwd', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'credential',
  'privatekey', 'mfasecret', 'otp', 'verificationcode', 'recoverycode', 'invitecode',
];
const CONTENT_KEYS = [
  'body', 'content', 'document', 'file', 'html', 'markdown', 'message', 'prompt', 'raw', 'text',
  'transcript', 'attachment',
];

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSecretKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return normalized.length > 0 && SECRET_KEYS.some((candidate) => normalized.includes(candidate));
}

function isContentKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return normalized.length > 0 && CONTENT_KEYS.some(
    (candidate) => normalized === candidate || normalized.endsWith(candidate),
  );
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function maskPii(value: string): string {
  return value
    .replace(/([A-Z0-9._%+-])[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '$1***$2')
    .replace(/(?<!\d)(1[3-9]\d)\d{4}(\d{4})(?!\d)/g, '$1****$2');
}

function summarizeContent(value: unknown): Record<string, unknown> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return {
    omitted: 'content',
    type: Array.isArray(value) ? 'array' : typeof value,
    length: serialized.length,
    sha256: fingerprint(serialized),
  };
}

function visit(value: unknown, key: string, depth: number): unknown {
  if (isSecretKey(key)) return '[REDACTED]';
  if (isContentKey(key) && value != null) return summarizeContent(value);
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') {
    const masked = maskPii(value);
    return masked.length > MAX_STRING ? `${masked.slice(0, MAX_STRING)}...[truncated:${masked.length}]` : masked;
  }
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((item) => visit(item, '', depth + 1));
    if (value.length > MAX_ARRAY) items.push(`[TRUNCATED:${value.length - MAX_ARRAY}]`);
    return items;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [childKey, childValue] of entries.slice(0, MAX_KEYS)) {
      result[childKey] = visit(childValue, childKey, depth + 1);
    }
    if (entries.length > MAX_KEYS) result._truncatedKeys = entries.length - MAX_KEYS;
    return result;
  }
  return String(value);
}

export function redactBusinessLogData(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  const redacted = visit(value, '', 0);
  if (redacted && typeof redacted === 'object' && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>;
  }
  return { value: redacted };
}

export function redactErrorMessage(message: string): string {
  return maskPii(message)
    .replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, 'postgresql://[REDACTED]')
    .slice(0, MAX_STRING);
}
