@echo off
echo === Resetting PostgreSQL for Prisma ===

echo Step 1: Drop _prisma_migrations tracking table and all tables...
docker exec tandem-postgres psql -U tandem -d tandem -c "DROP TABLE IF EXISTS _prisma_migrations CASCADE;"
docker exec tandem-postgres psql -U tandem -d tandem -c "DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP EXECUTE 'DROP TABLE IF EXISTS ' || r.tablename || ' CASCADE'; END LOOP; END $$;"

echo Step 2: Push schema with force reset...
cd /d E:\Hermes
npx prisma db push --force-reset

echo Step 3: Verify tables...
docker exec tandem-postgres psql -U tandem -d tandem -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"

echo === Done ===
pause
