/**
 * Reassign ownership of every public-schema table & sequence to the app role.
 *
 * Why: this DB was bootstrapped under the `postgres` superuser (Prisma era), so
 * ~40 core tables (KvStore, User, ...) are owned by `postgres`, while newer
 * Drizzle migrations created tables owned by `tandem`. Migrations run as
 * `tandem` then fail with "must be owner of table KvStore" when they try to
 * CREATE INDEX / ALTER on a postgres-owned table (e.g. migration 0006).
 *
 * This unifies ownership under the app role so future migrations work.
 *
 * Connects as the `postgres` superuser via local trust auth. Targeted on
 * purpose: alters only public tables + sequences, never shared objects
 * (databases/tablespaces), unlike `REASSIGN OWNED BY postgres`.
 *
 * Usage:  node scripts/reassign-table-ownership.mjs [targetRole]
 *   targetRole defaults to 'tandem'.
 */
import pg from 'pg';

const targetRole = process.argv[2] || 'tandem';
const superConn = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGSUPERUSER || 'postgres',
  password: process.env.PGSUPERPASSWORD || undefined,
  database: process.env.PGDATABASE || 'tandem',
};

const c = new pg.Client(superConn);
await c.connect();

const me = (await c.query('SELECT current_user, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super')).rows[0];
console.log('connected as:', me);
if (!me.super) {
  console.error('Refusing to continue: not a superuser.');
  await c.end();
  process.exit(1);
}

const before = (await c.query(
  "SELECT tableowner, count(*)::int n FROM pg_tables WHERE schemaname='public' GROUP BY tableowner ORDER BY n DESC",
)).rows;
console.log('ownership before:', before);

const result = await c.query(
  `DO $$
   DECLARE r record;
   BEGIN
     FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tableowner <> '${targetRole}' LOOP
       EXECUTE format('ALTER TABLE public.%I OWNER TO ${targetRole}', r.tablename);
     END LOOP;
     FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' AND sequenceowner <> '${targetRole}' LOOP
       EXECUTE format('ALTER SEQUENCE public.%I OWNER TO ${targetRole}', r.sequencename);
     END LOOP;
     FOR r IN SELECT viewname FROM pg_views WHERE schemaname='public' AND viewowner <> '${targetRole}' LOOP
       EXECUTE format('ALTER VIEW public.%I OWNER TO ${targetRole}', r.viewname);
     END LOOP;
   END $$;`,
);
void result;

const after = (await c.query(
  "SELECT tableowner, count(*)::int n FROM pg_tables WHERE schemaname='public' GROUP BY tableowner ORDER BY n DESC",
)).rows;
console.log('ownership after:', after);

await c.end();
console.log(`\n✓ public tables/sequences/views reassigned to '${targetRole}'.`);
