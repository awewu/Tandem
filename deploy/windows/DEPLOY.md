# Rhautt Nexus Windows production deployment

This package runs only the Rhautt Nexus frontend and NestJS API:

- Nexus frontend: `127.0.0.1:5000` -> `https://nexus.rhautt.com/`
- Nexus backend: `127.0.0.1:4500` -> `https://nexus.rhautt.com/api/*`

Existing services are not included and must stay under their current runtime
and Nginx configuration:

- Brand console: `127.0.0.1:4012` -> `https://manage.rhautt.com/`
- Legacy brand API: `127.0.0.1:4400` -> existing `web.rhautt.com` routes

## Prerequisites

1. Windows Server x64.
2. Nginx for Windows installed separately.
3. DNS A record for `nexus.rhautt.com` pointing to the production server.
4. Valid TLS certificate files installed at the paths used by Nginx.
5. Existing PostgreSQL database and schema available to the API.

Node.js is included in `runtime/`; a global Node.js installation is not
required for this package.

## Configure

1. Extract the ZIP to a versioned directory.
2. Copy `config\.env.production.example` to `config\.env.production`.
3. Fill the database password and production secrets. Do not put secret values
   in Git, logs, or the deployment ZIP.
4. Keep same-server PostgreSQL connections on `POSTGRES_HOST=127.0.0.1`.
5. Use `OIDC_POST_LOGIN_REDIRECT=/brand` for the current Nexus landing flow.
6. Do not restore or overwrite the existing database from this application
   package.

## Nginx

The active server currently includes:

```nginx
include E:/soft/nginx-1.30.2/conf/conf.d/nexus.rhautt.com.conf;
```

The included Nexus config should proxy `/api/` and `/ws` to `127.0.0.1:4500`
and all other paths to `127.0.0.1:5000`. Do not add `manage.rhautt.com`, 4012,
4400, or `web.rhautt.com` to the Nexus config.

Run `nginx.exe -t` before reloading Nginx.

## Start and verify

```bat
scripts\start-all.cmd
scripts\status.cmd
scripts\health-check.cmd
```

Expected local checks:

- `http://127.0.0.1:5000/` returns HTTP 200 or the expected auth redirect.
- `http://127.0.0.1:4500/api/v2/health` returns `success:true`.

Logs are written under `logs\`. Use `scripts\stop-all.cmd` before replacing or
rolling back a release directory.
