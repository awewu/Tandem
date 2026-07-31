-- Migration 0018: Kpi.coOwnerIds 跨体系联合持有 + KpiTargetAmendment 目标修订签批流
-- 幂等 DDL, 遵循 §02-database-env.md 规则 (禁止 drizzle-kit push).

--> statement-breakpoint
ALTER TABLE "Kpi" ADD COLUMN IF NOT EXISTS "coOwnerIds" jsonb;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiTargetAmendment" (
  "id" text PRIMARY KEY NOT NULL,
  "kpiId" text NOT NULL,
  "cycleId" text NOT NULL,
  "requestedBy" text NOT NULL,
  "fromTargetValue" numeric(18, 4) NOT NULL,
  "toTargetValue" numeric(18, 4) NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewedBy" text,
  "reviewedAt" timestamp(3),
  "reviewNote" text,
  "tenantId" text NOT NULL DEFAULT 'default',
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiTargetAmendment_kpiId_status_idx" ON "KpiTargetAmendment" ("kpiId", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiTargetAmendment_cycleId_idx" ON "KpiTargetAmendment" ("cycleId", "tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiTargetAmendment_status_tenant_idx" ON "KpiTargetAmendment" ("status", "tenantId");
