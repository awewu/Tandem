/**
 * Full demo reset — purge the legacy 「晨光智能热水 / chenguang.com」 showcase data
 * so the Everhot seed can repopulate the DB from scratch on next boot.
 *
 * SAFE BY DEFAULT: runs as a DRY-RUN (counts only, no mutations).
 * To actually delete, pass --commit:
 *
 *   node scripts/reset-showcase.mjs            # dry-run, prints what WOULD be deleted
 *   node scripts/reset-showcase.mjs --commit   # performs the deletion (DESTRUCTIVE)
 *
 * PRESERVES:
 *   - All non-chenguang.com Users (tandem.local dev accounts + partner.local) and their auth
 *   - The anchor organization (Tandem Owner / org_anchor_default)
 *   - Launchpad / Course / learning infrastructure tables
 *
 * Re-seed: after a --commit run, restart `next dev` and hit any page —
 * boot's seedShowcaseIfEmpty() will inject the Everhot dataset fresh.
 */
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const COMMIT = process.argv.includes('--commit');
const OLD_DOMAIN = 'chenguang.com';
const ANCHOR_ORG_ID = 'org_anchor_default';

// KvStore collections that are 100% showcase/demo content — wiped wholesale.
const SHOWCASE_COLLECTIONS = [
  'cycles', 'objectives', 'key_results', 'check_ins', 'initiatives', 'ttis',
  'one_on_one_meetings', 'review360_cycles',
  'decision_cards',
  'memories', 'memory_downgrades', 'memory_promotions',
  'im_channels', 'im_memberships', 'im_messages',
  'personas', 'persona_constitutions', 'stewards',
  'intranet_posts', 'knowledge_nodes',
  'kpi_cycles', 'kpi_subjects', 'kpis', 'kpi_snapshots',
  'materials', 'bitable_tables', 'shouchao_notes',
  'company_brain_decisions', 'company_brain_reflections',
  'governance_projects', 'governance_templates',
];

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
console.log(`Mode: ${COMMIT ? '\x1b[31mCOMMIT (DESTRUCTIVE)\x1b[0m' : 'DRY-RUN (no changes)'}\n`);

const c = new pg.Client({ connectionString: url });
await c.connect();

// 1. Old chenguang users
const users = (await c.query(`SELECT id FROM "User" WHERE email LIKE $1`, [`%@${OLD_DOMAIN}`])).rows.map((r) => r.id);
console.log(`chenguang.com users: ${users.length}`);

// 2. Auth KvStore rows tied to those users
//    auth_password / auth_user_extras → id = userId
//    auth_session / auth_event       → data->>'userId' = userId
const authById = ['auth_password', 'auth_user_extras'];
const authByData = ['auth_session', 'auth_event'];

async function countKv(collection, where, params) {
  const r = await c.query(`SELECT count(*)::int n FROM "KvStore" WHERE collection=$1 ${where}`, [collection, ...params]);
  return r.rows[0].n;
}

let plan = [];
for (const col of authById) {
  const n = users.length ? await countKv(col, `AND id = ANY($2)`, [users]) : 0;
  plan.push({ target: `KvStore/${col}`, n, kind: 'auth-by-id' });
}
for (const col of authByData) {
  const n = users.length ? await countKv(col, `AND data->>'userId' = ANY($2)`, [users]) : 0;
  plan.push({ target: `KvStore/${col}`, n, kind: 'auth-by-data' });
}
for (const col of SHOWCASE_COLLECTIONS) {
  const r = await c.query(`SELECT count(*)::int n FROM "KvStore" WHERE collection=$1`, [col]);
  plan.push({ target: `KvStore/${col}`, n: r.rows[0].n, kind: 'showcase' });
}
// Organizations: delete all EXCEPT anchor
const orgN = (await c.query(
  `SELECT count(*)::int n FROM "KvStore" WHERE collection='organizations' AND id <> $1`, [ANCHOR_ORG_ID],
)).rows[0].n;
plan.push({ target: `KvStore/organizations (non-anchor)`, n: orgN, kind: 'orgs' });

// Typed GA tables owned by old users (Document / CalendarEvent / DriveFile)
async function countTyped(table, col) {
  if (!users.length) return 0;
  const r = await c.query(`SELECT count(*)::int n FROM "${table}" WHERE "${col}" = ANY($1)`, [users]);
  return r.rows[0].n;
}
const typed = [
  ['Document', 'ownerId'], ['CalendarEvent', 'ownerId'], ['DriveFile', 'ownerId'],
];
for (const [t, col] of typed) {
  let n = 0;
  try { n = await countTyped(t, col); } catch { n = -1; /* table/col absent */ }
  if (n >= 0) plan.push({ target: `${t} (owner in old users)`, n, kind: 'typed' });
}

console.log('── deletion plan ──');
console.table(plan.filter((p) => p.n !== 0));
const totalRows = plan.reduce((s, p) => s + (p.n > 0 ? p.n : 0), 0) + users.length;
console.log(`Total rows to delete (incl. ${users.length} Users): ~${totalRows}\n`);

if (!COMMIT) {
  console.log('DRY-RUN complete. Re-run with --commit to apply.');
  await c.end();
  process.exit(0);
}

// ---- COMMIT ----
await c.query('BEGIN');
try {
  for (const [t, col] of typed) {
    if (users.length) {
      try { await c.query(`DELETE FROM "${t}" WHERE "${col}" = ANY($1)`, [users]); } catch { /* absent */ }
    }
  }
  for (const col of authById) {
    if (users.length) await c.query(`DELETE FROM "KvStore" WHERE collection=$1 AND id = ANY($2)`, [col, users]);
  }
  for (const col of authByData) {
    if (users.length) await c.query(`DELETE FROM "KvStore" WHERE collection=$1 AND data->>'userId' = ANY($2)`, [col, users]);
  }
  for (const col of SHOWCASE_COLLECTIONS) {
    await c.query(`DELETE FROM "KvStore" WHERE collection=$1`, [col]);
  }
  await c.query(`DELETE FROM "KvStore" WHERE collection='organizations' AND id <> $1`, [ANCHOR_ORG_ID]);
  if (users.length) await c.query(`DELETE FROM "User" WHERE id = ANY($1)`, [users]);
  await c.query('COMMIT');
  console.log('\x1b[32m✓ COMMIT done. Restart next dev to re-seed Everhot.\x1b[0m');
} catch (err) {
  await c.query('ROLLBACK');
  console.error('ROLLBACK due to error:', err.message);
  process.exitCode = 1;
}
await c.end();
