import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Journal = {
  entries: Array<{ idx: number; when: number; tag: string }>;
};

const migrationsDir = join(process.cwd(), 'drizzle', 'migrations');
const journal = JSON.parse(
  readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
) as Journal;

describe('migration manifest', () => {
  it('registers every numbered SQL migration exactly once', () => {
    const sqlTags = readdirSync(migrationsDir)
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .map((name) => name.slice(0, -4))
      .sort();
    const journalTags = journal.entries.map((entry) => entry.tag).sort();

    expect(journalTags).toEqual(sqlTags);
  });

  it('keeps journal indexes contiguous and timestamps unique', () => {
    const timestamps = new Set<number>();
    for (let index = 0; index < journal.entries.length; index++) {
      const entry = journal.entries[index];
      expect(entry.idx).toBe(index);
      expect(entry.when).toBeGreaterThan(0);
      expect(timestamps.has(entry.when)).toBe(false);
      timestamps.add(entry.when);
    }
  });
});
