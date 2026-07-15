-- Queryable API access and business-operation logs.
-- AuditLog remains the immutable evidence chain; BusinessLog is optimized for search and AI retrieval.

CREATE TABLE IF NOT EXISTS "BusinessLog" (
  "id" text PRIMARY KEY NOT NULL,
  "requestId" text,
  "tenantId" text DEFAULT 'default' NOT NULL,
  "actorId" text DEFAULT 'anonymous' NOT NULL,
  "actorType" text DEFAULT 'anonymous' NOT NULL,
  "kind" text NOT NULL,
  "source" text DEFAULT 'api' NOT NULL,
  "category" text DEFAULT 'system' NOT NULL,
  "operation" text NOT NULL,
  "action" text NOT NULL,
  "method" text,
  "path" text,
  "route" text,
  "targetType" text,
  "targetId" text,
  "statusCode" integer,
  "outcome" text NOT NULL,
  "level" text DEFAULT 'info' NOT NULL,
  "durationMs" integer,
  "summary" text NOT NULL,
  "requestData" jsonb,
  "details" jsonb,
  "createdAt" timestamp(3) DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "BusinessLog_tenant_created_idx"
  ON "BusinessLog" ("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "BusinessLog_tenant_actor_idx"
  ON "BusinessLog" ("tenantId", "actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "BusinessLog_tenant_operation_idx"
  ON "BusinessLog" ("tenantId", "operation", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "BusinessLog_tenant_outcome_idx"
  ON "BusinessLog" ("tenantId", "outcome", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "BusinessLog_requestId_idx"
  ON "BusinessLog" ("requestId");
