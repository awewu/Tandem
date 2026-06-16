---
trigger: always_on
---

# Database & Environment Rules

## Two Postgres Instances — CRITICAL
| Instance | Host | Used by app? |
|---|---|---|
| Native Postgres | `localhost:5432` | ✅ YES — this is the real DB |
| Docker container `tandem-postgres` | `localhost:5440` | ❌ NO — isolated, never use |

**Always** connect via `DATABASE_URL` in `.env.local`:  
`postgresql://tandem:tandem@localhost:5432/tandem?schema=public`

To run SQL against the real DB use a Node script with the `pg` / `postgres` package reading `.env.local`.  
**Never** use `docker exec tandem-postgres psql` — that hits the wrong DB.

## Schema Mutation Rules
- **`drizzle-kit push` / `npm run db:push` are BANNED.**  
  The `User` table retains legacy Prisma columns (`departmentId`, `managerId`, `ssoBindings`, `failedLoginCount`, `lockedUntil`, `lastLoginAt`, `lastLoginIp`).  
  Drizzle schema omits them → push always reports DATA LOSS and would delete real columns.
- To add new tables or columns: write **idempotent DDL** (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN IF NOT EXISTS`) and run via a Node migration script.

## Auth Storage
- Password hash: `KvStore` collection `auth_password`, id = `userId`, `data = { id, hash, historyHashes }`, algorithm `scrypt$N$r$p$salt$hash` (`lib/auth/password.ts`).
- Extended user fields (department, manager, etc.): `KvStore` collection `auth_user_extras`.

## .env.local Keys Present
`DATABASE_URL`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `DEEPSEEK_API_KEY`.  
No Ollama / Doubao / Qwen / Anthropic keys configured.
