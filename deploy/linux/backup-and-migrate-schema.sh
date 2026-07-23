#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Missing deploy/linux/.env" >&2
  exit 1
fi

compose() {
  docker compose --env-file .env -f compose.yml "$@"
}

compose config --quiet

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="rhautt_nexus_before_migration_${timestamp}.dump"
mkdir -p backups

compose run --rm --no-deps -e BACKUP_NAME="$backup_name" postgres-tools sh -ec '
  pg_dump \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --no-owner \
    --no-acl \
    --file="/backups/$BACKUP_NAME"
'

if [ ! -s "backups/$backup_name" ]; then
  echo "Backup was not created: backups/$backup_name" >&2
  exit 1
fi

echo "Backup created: backups/$backup_name"
compose run --rm --no-deps api node scripts/db/apply-migrations.js --dry-run

if [ "${APPLY_MIGRATIONS:-0}" != "1" ]; then
  echo "Dry-run complete. Re-run with APPLY_MIGRATIONS=1 to apply pending migrations."
  exit 0
fi

compose run --rm --no-deps api node scripts/db/apply-migrations.js
compose run --rm --no-deps api node scripts/db/apply-migrations.js --status
