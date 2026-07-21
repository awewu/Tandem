import { describe, it, expect } from 'vitest';
import { buildOffTopicNudge, DEFAULT_OFF_TOPIC_NUDGE } from '@/lib/persona/off-topic-nudge';

describe('buildOffTopicNudge', () => {
  it('returns empty when disabled', () => {
    expect(buildOffTopicNudge({ enabled: false, offTopic: true })).toBe('');
  });

  it('returns empty when not off-topic', () => {
    expect(buildOffTopicNudge({ enabled: true, offTopic: false })).toBe('');
  });

  it('returns default nudge when enabled + off-topic + no custom text', () => {
    const out = buildOffTopicNudge({ enabled: true, offTopic: true });
    expect(out).toContain(DEFAULT_OFF_TOPIC_NUDGE);
    expect(out.startsWith('\n\n')).toBe(true);
  });

  it('uses custom text when provided', () => {
    const out = buildOffTopicNudge({ enabled: true, offTopic: true, customText: '回去搬砖啦' });
    expect(out).toContain('回去搬砖啦');
    expect(out).not.toContain(DEFAULT_OFF_TOPIC_NUDGE);
  });

  it('falls back to default when custom text is blank', () => {
    const out = buildOffTopicNudge({ enabled: true, offTopic: true, customText: '   ' });
    expect(out).toContain(DEFAULT_OFF_TOPIC_NUDGE);
  });
});
