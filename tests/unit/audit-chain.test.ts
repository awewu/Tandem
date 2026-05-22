/**
 * SHA256 audit chain integrity test.
 *
 * Tests the pure verification logic, not the persistence layer.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

/** Mirror of the chain hash function in lib/audit/log.ts */
function chainHash(prevHash: string, action: string, actorId: string, ts: string): string {
  return createHash('sha256').update(`${prevHash}|${action}|${actorId}|${ts}`).digest('hex');
}

describe('Audit chain SHA256 integrity', () => {
  it('produces deterministic hash for same inputs', () => {
    const h1 = chainHash('genesis', 'kpi.cycle_created', 'admin', '2026-01-01T00:00:00Z');
    const h2 = chainHash('genesis', 'kpi.cycle_created', 'admin', '2026-01-01T00:00:00Z');
    expect(h1).toBe(h2);
  });

  it('different action breaks the chain', () => {
    const h1 = chainHash('prev', 'kpi.cycle_created', 'admin', '2026-01-01T00:00:00Z');
    const h2 = chainHash('prev', 'kpi.cycle_closed', 'admin', '2026-01-01T00:00:00Z');
    expect(h1).not.toBe(h2);
  });

  it('different actor breaks the chain', () => {
    const h1 = chainHash('prev', 'kpi.bonus_committed', 'a', '2026-01-01T00:00:00Z');
    const h2 = chainHash('prev', 'kpi.bonus_committed', 'b', '2026-01-01T00:00:00Z');
    expect(h1).not.toBe(h2);
  });

  it('chain verification: replay confirms each entry', () => {
    const entries = [
      { action: 'kpi.cycle_created', actorId: 'admin', ts: '2026-01-01T00:00:00Z' },
      { action: 'kpi.cycle_activated', actorId: 'admin', ts: '2026-01-02T00:00:00Z' },
      { action: 'kpi.bonus_committed', actorId: 'hr', ts: '2026-12-01T00:00:00Z' },
      { action: 'kpi.year_end_close', actorId: 'admin', ts: '2026-12-31T23:59:59Z' },
    ];
    let prev = 'genesis';
    const hashes: string[] = [];
    for (const e of entries) {
      const h = chainHash(prev, e.action, e.actorId, e.ts);
      hashes.push(h);
      prev = h;
    }
    expect(hashes).toHaveLength(4);
    // Verify chain by replay
    let verifyPrev = 'genesis';
    for (let i = 0; i < entries.length; i++) {
      const expected = chainHash(verifyPrev, entries[i].action, entries[i].actorId, entries[i].ts);
      expect(hashes[i]).toBe(expected);
      verifyPrev = expected;
    }
  });

  it('tampered entry breaks subsequent chain', () => {
    let prev = 'genesis';
    const h1 = chainHash(prev, 'kpi.cycle_created', 'admin', '2026-01-01T00:00:00Z');
    prev = h1;
    const h2 = chainHash(prev, 'kpi.bonus_committed', 'hr', '2026-06-01T00:00:00Z');

    // Re-compute h2 starting from a tampered h1 should give different hash
    const tamperedPrev = chainHash('genesis', 'kpi.cycle_closed', 'admin', '2026-01-01T00:00:00Z');
    const tamperedH2 = chainHash(tamperedPrev, 'kpi.bonus_committed', 'hr', '2026-06-01T00:00:00Z');
    expect(h2).not.toBe(tamperedH2);
  });
});
