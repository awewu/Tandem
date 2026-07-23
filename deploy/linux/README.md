# Linux deployment

This stack builds the current monorepo into one immutable Node 20 image and
runs each application as a separate Compose service. PostgreSQL remains an
external managed dependency. MongoDB, Redis, uploads, storage, and logs use
Docker volumes.

## Prepare

1. Copy `.env.example` to `.env` on the Linux server.
2. Replace every `replace-*` value. Reuse the production JWT, phone hash, and
   PII encryption keys when existing encrypted data must remain readable.
3. Fill `OIDC_CLIENT_SECRET` from the production secret manager only. The
   callback is `https://nexus.rhautt.com/api/v2/auth/sso/callback`; `/hub` is
   only the post-login business landing page.
4. Keep `APP_BIND_IP=127.0.0.1` when host Nginx is used.
5. Install `nginx-rhautt-nexus.conf` only after adapting it to the server's
   existing Nginx layout and validating with `nginx -t`.

## Validate and start

```sh
docker compose --env-file .env -f compose.yml config --quiet
docker compose --env-file .env -f compose.yml build
docker compose --env-file .env -f compose.yml up -d
docker compose --env-file .env -f compose.yml ps
curl -fsS http://127.0.0.1:3300/api/v2/health
curl -fsS http://127.0.0.1:4000/
```

The public Hub destinations are build-time locked to:

- Brand console: `https://manage.rhautt.com/`
- Rysnova diagnosis: `https://rhautt.com/`

Database migrations are not run automatically by application startup. Back up
the target database, review pending migrations, then run the repository's
curated migration runner as an explicit release step.

```sh
chmod +x backup-and-migrate-schema.sh
./backup-and-migrate-schema.sh
APPLY_MIGRATIONS=1 ./backup-and-migrate-schema.sh
```

The second command creates another PostgreSQL 18 custom-format backup before
it applies any pending schema migration. It does not import local development
rows into production. Data merging must use an explicitly reviewed table and
tenant scope.
