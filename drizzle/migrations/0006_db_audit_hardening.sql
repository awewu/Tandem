-- Migration 0006: DB 审计硬化 (docs/DB-AUDIT-2026-06-09.md)
-- 1) 回填 KvStore.tenantId 列 (C1): 存量行 tenantId 永远是 'default', 列与索引是死的.
--    从 JSONB data->>'tenantId' 回填, 使列与 KvStore_tenant_idx 索引复活, 支持 list 下推.
-- 2) 为热路径 JSONB 查询建表达式 partial 索引 (C4): refresh token / 邀请码 / auth event userId.
-- 全部 IF NOT EXISTS / 幂等, 可安全重跑.

--> statement-breakpoint
UPDATE "KvStore"
SET "tenantId" = COALESCE("data"->>'tenantId', 'default')
WHERE "tenantId" = 'default'
  AND "data"->>'tenantId' IS NOT NULL
  AND "data"->>'tenantId' <> 'default';

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KvStore_authSession_refreshHash_idx"
  ON "KvStore" (("data"->>'refreshTokenHash'))
  WHERE collection = 'auth_session';

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KvStore_authSession_userId_idx"
  ON "KvStore" (("data"->>'userId'))
  WHERE collection = 'auth_session';

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KvStore_authInvite_codeHash_idx"
  ON "KvStore" (("data"->>'codeHash'))
  WHERE collection = 'auth_invite';

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KvStore_authEvent_userId_idx"
  ON "KvStore" (("data"->>'userId'))
  WHERE collection = 'auth_event';

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KvStore_collection_tenant_idx"
  ON "KvStore" ("collection", "tenantId");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User" ("deletedAt");
