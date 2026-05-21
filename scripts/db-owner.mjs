import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete('schema');
const c = new pg.Client({ connectionString: u.toString() });
await c.connect();
console.log('schema owner:', (await c.query("SELECT nspname, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='public'")).rows[0]);
console.log('db owner:   ', (await c.query("SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()")).rows[0]);
console.log('memberships:', (await c.query("SELECT pg_has_role(current_user, 'pg_database_owner', 'MEMBER') AS dbo, pg_has_role(current_user, 'postgres', 'MEMBER') AS pg")).rows[0]);
// Try fixing
try {
  await c.query('ALTER SCHEMA public OWNER TO tandem');
  console.log('ALTER OWNER ✓');
} catch (e) { console.log('ALTER OWNER:', e.message); }
try {
  await c.query('GRANT ALL ON SCHEMA public TO tandem');
  console.log('GRANT ALL ✓');
} catch (e) { console.log('GRANT:', e.message); }
try {
  await c.query('CREATE TABLE IF NOT EXISTS public._diag_probe2 (id int)');
  await c.query('DROP TABLE public._diag_probe2');
  console.log('PROBE2: can create in public ✓');
} catch (e) { console.log('PROBE2:', e.message); }
await c.end();
