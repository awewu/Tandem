import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createNote } from '@/lib/shouchao/service';
import { getShouchaoStore, isDedicatedShouchaoDatabaseEnabled, __resetShouchaoStoreForTests } from '@/lib/shouchao/store';
import { GET as exportShouchao } from '@/app/api/internal/shouchao/export/route';

const OLD_ENV = {
  SHOUCHAO_DATABASE_URL: process.env.SHOUCHAO_DATABASE_URL,
  SHOUCHAO_INTERNAL_TOKEN: process.env.SHOUCHAO_INTERNAL_TOKEN,
  DISABLE_DEMO_SEED: process.env.DISABLE_DEMO_SEED,
};

beforeEach(() => {
  delete process.env.SHOUCHAO_DATABASE_URL;
  delete process.env.SHOUCHAO_INTERNAL_TOKEN;
  process.env.DISABLE_DEMO_SEED = '1';
  __resetShouchaoStoreForTests();
  setStore(createInMemoryStore());
});

afterEach(() => {
  if (OLD_ENV.SHOUCHAO_DATABASE_URL === undefined) delete process.env.SHOUCHAO_DATABASE_URL;
  else process.env.SHOUCHAO_DATABASE_URL = OLD_ENV.SHOUCHAO_DATABASE_URL;
  if (OLD_ENV.SHOUCHAO_INTERNAL_TOKEN === undefined) delete process.env.SHOUCHAO_INTERNAL_TOKEN;
  else process.env.SHOUCHAO_INTERNAL_TOKEN = OLD_ENV.SHOUCHAO_INTERNAL_TOKEN;
  if (OLD_ENV.DISABLE_DEMO_SEED === undefined) delete process.env.DISABLE_DEMO_SEED;
  else process.env.DISABLE_DEMO_SEED = OLD_ENV.DISABLE_DEMO_SEED;
  __resetShouchaoStoreForTests();
});

describe('Shouchao storage boundary', () => {
  it('falls back to the Tandem store when SHOUCHAO_DATABASE_URL is not configured', async () => {
    expect(isDedicatedShouchaoDatabaseEnabled()).toBe(false);
    const note = await createNote({ ownerId: 'u1', tenantId: 'default', title: 'fallback', content: 'kept' });

    expect(await getStore().shouchaoNotes.get(note.id)).toMatchObject({ title: 'fallback' });
    expect(await getShouchaoStore().shouchaoNotes.get(note.id)).toMatchObject({ content: 'kept' });
  });
});

describe('internal Shouchao export', () => {
  it('requires the system token to read all Shouchao data', async () => {
    process.env.SHOUCHAO_INTERNAL_TOKEN = 'secret-token';
    await createNote({ ownerId: 'alice', tenantId: 'default', title: 'a', content: 'A' });

    const denied = await exportShouchao(
      new NextRequest('http://tandem.local/api/internal/shouchao/export?collection=notes'),
    );
    expect(denied.status).toBe(403);
  });

  it('returns notes across owners for Tandem backend jobs', async () => {
    process.env.SHOUCHAO_INTERNAL_TOKEN = 'secret-token';
    await exportShouchao(
      new NextRequest('http://tandem.local/api/internal/shouchao/export?collection=notes', {
        headers: { authorization: 'Bearer secret-token' },
      }),
    );
    const a = await createNote({ ownerId: 'alice', tenantId: 'default', title: 'alice note', content: 'A' });
    const b = await createNote({ ownerId: 'bob', tenantId: 'default', title: 'bob note', content: 'B' });

    const res = await exportShouchao(
      new NextRequest('http://tandem.local/api/internal/shouchao/export?collection=notes', {
        headers: { authorization: 'Bearer secret-token' },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    const ids = json.collections.notes.items.map((n: { id: string }) => n.id);
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(json.mode).toBe('tandem-fallback');
  });

  it('uses a cursor so equal-timestamp records are not skipped between pages', async () => {
    process.env.SHOUCHAO_INTERNAL_TOKEN = 'secret-token';
    await exportShouchao(
      new NextRequest('http://tandem.local/api/internal/shouchao/export?collection=notes', {
        headers: { authorization: 'Bearer secret-token' },
      }),
    );

    const sameTs = '2026-07-27T00:00:00.000Z';
    const a = await createNote({ ownerId: 'alice', tenantId: 'default', title: 'same-a', content: 'A' });
    const b = await createNote({ ownerId: 'bob', tenantId: 'default', title: 'same-b', content: 'B' });
    await getStore().shouchaoNotes.update(a.id, { updatedAt: sameTs });
    await getStore().shouchaoNotes.update(b.id, { updatedAt: sameTs });

    const first = await exportShouchao(
      new NextRequest(`http://tandem.local/api/internal/shouchao/export?collection=notes&since=2026-07-26T00:00:00.000Z&limit=1`, {
        headers: { authorization: 'Bearer secret-token' },
      }),
    );
    const firstJson = await first.json();
    expect(firstJson.collections.notes.items).toHaveLength(1);
    expect(firstJson.collections.notes.hasMore).toBe(true);

    const second = await exportShouchao(
      new NextRequest(`http://tandem.local/api/internal/shouchao/export?collection=notes&cursor=${firstJson.collections.notes.nextCursor}&limit=10`, {
        headers: { authorization: 'Bearer secret-token' },
      }),
    );
    const secondJson = await second.json();
    const firstIds = firstJson.collections.notes.items.map((n: { id: string }) => n.id);
    const secondIds = secondJson.collections.notes.items.map((n: { id: string }) => n.id);
    expect([...firstIds, ...secondIds]).toEqual(expect.arrayContaining([a.id, b.id]));
  });
});
