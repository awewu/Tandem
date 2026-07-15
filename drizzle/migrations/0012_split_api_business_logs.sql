-- Split technical HTTP request logs from domain business events.
CREATE TABLE IF NOT EXISTS "ApiLog" (
  "id" text PRIMARY KEY NOT NULL,
  "requestId" text,
  "tenantId" text DEFAULT 'default' NOT NULL,
  "actorId" text DEFAULT 'anonymous' NOT NULL,
  "actorType" text DEFAULT 'anonymous' NOT NULL,
  "source" text DEFAULT 'api' NOT NULL,
  "category" text DEFAULT 'system' NOT NULL,
  "operation" text NOT NULL,
  "action" text NOT NULL,
  "method" text NOT NULL,
  "path" text NOT NULL,
  "route" text,
  "targetType" text,
  "targetId" text,
  "statusCode" integer NOT NULL,
  "outcome" text NOT NULL,
  "level" text DEFAULT 'info' NOT NULL,
  "durationMs" integer,
  "summary" text NOT NULL,
  "requestData" jsonb,
  "details" jsonb,
  "createdAt" timestamp(3) DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ApiLog_tenant_created_idx" ON "ApiLog" ("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ApiLog_tenant_actor_idx" ON "ApiLog" ("tenantId", "actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ApiLog_tenant_route_idx" ON "ApiLog" ("tenantId", "route", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ApiLog_tenant_outcome_idx" ON "ApiLog" ("tenantId", "outcome", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ApiLog_requestId_idx" ON "ApiLog" ("requestId");

INSERT INTO "ApiLog" (
  "id", "requestId", "tenantId", "actorId", "actorType", "source", "category",
  "operation", "action", "method", "path", "route", "targetType", "targetId",
  "statusCode", "outcome", "level", "durationMs", "summary", "requestData", "details", "createdAt"
)
SELECT
  "id", "requestId", "tenantId", "actorId", "actorType", "source", "category",
  "operation", "action", COALESCE("method", 'UNKNOWN'), COALESCE("path", COALESCE("route", '/unknown')),
  "route", "targetType", "targetId", COALESCE("statusCode", 0), "outcome", "level",
  "durationMs", "summary", "requestData", "details", "createdAt"
FROM "BusinessLog"
WHERE "source" IN ('api', 'middleware', 'edge')
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "BusinessLog" WHERE "source" IN ('api', 'middleware', 'edge');

ALTER TABLE "BusinessLog" ALTER COLUMN "source" SET DEFAULT 'domain';
