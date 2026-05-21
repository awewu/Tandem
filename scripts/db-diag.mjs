import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}
let url = process.env.DATABASE_URL;
const u = new URL(url);
if (u.searchParams.has('schema')) u.searchParams.delete('schema');
url = u.toString();
console.log('Connecting to:', url.replace(/:[^@]*@/, ':***@'));

const c = new pg.Client({ connectionString: url });
await c.connect();
console.log('current_database:', (await c.query('SELECT current_database()')).rows[0].current_database);
console.log('current_user:', (await c.query('SELECT current_user')).rows[0].current_user);
console.log('search_path:', (await c.query('SHOW search_path')).rows[0].search_path);
console.log('schemas:', (await c.query("SELECT schema_name FROM information_schema.schemata ORDER BY 1")).rows.map(r => r.schema_name).join(', '));
console.log('public exists?', (await c.query("SELECT 1 FROM pg_namespace WHERE nspname='public'")).rowCount > 0);
const tables = (await c.query("SELECT schemaname||'.'||tablename AS t FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY 1")).rows.map(r => r.t);
console.log('existing tables:', tables.length);
for (const t of tables) console.log('  ', t);
// Try to create something in public
try {
  await c.query('CREATE TABLE IF NOT EXISTS public._diag_probe (id int)');
  await c.query('DROP TABLE public._diag_probe');
  console.log('PROBE: can create in public ✓');
} catch (e) {
  console.log('PROBE: CANNOT create in public:', e.message);
}
await c.end();
