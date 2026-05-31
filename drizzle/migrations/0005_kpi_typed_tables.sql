-- Migration 0005: KPI 体系强类型表 (B-019 / B-020)
-- 将 KPI 相关集合从 KvStore JSONB 升级为独立强类型 PostgreSQL 表.
-- 现有 KvStore 数据保持不变 (双写过渡期), 迁移完成后可按需清理.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiCycle" (
  "id" text PRIMARY KEY NOT NULL,
  "fiscalYear" integer NOT NULL,
  "name" text NOT NULL,
  "startDate" text NOT NULL,
  "endDate" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "tenantId" text NOT NULL DEFAULT 'default',
  "targetsLockedAt" timestamp(3),
  "closedAt" timestamp(3),
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiCycle_tenantId_status_idx" ON "KpiCycle" ("tenantId", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiCycle_fiscalYear_idx" ON "KpiCycle" ("fiscalYear", "tenantId");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiSubject" (
  "id" text PRIMARY KEY NOT NULL,
  "parentId" text,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "bscPerspective" text,
  "level" integer NOT NULL DEFAULT 1,
  "defaultScope" text NOT NULL DEFAULT 'bonus',
  "defaultUnit" text,
  "defaultMeasureType" text NOT NULL DEFAULT 'numeric',
  "active" boolean NOT NULL DEFAULT true,
  "tenantId" text NOT NULL DEFAULT 'default',
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "KpiSubject_code_tenant_uniq" ON "KpiSubject" ("code", "tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiSubject_parentId_idx" ON "KpiSubject" ("parentId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiSubject_bscPerspective_idx" ON "KpiSubject" ("bscPerspective", "tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiSubject_active_tenant_idx" ON "KpiSubject" ("active", "tenantId");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Kpi" (
  "id" text PRIMARY KEY NOT NULL,
  "cycleId" text NOT NULL,
  "subjectId" text NOT NULL,
  "bscPerspective" text,
  "level" text NOT NULL,
  "parentKpiId" text,
  "assigneeId" text NOT NULL,
  "departmentId" text,
  "title" text NOT NULL,
  "description" text,
  "measureType" text NOT NULL DEFAULT 'numeric',
  "startValue" numeric(18, 4) NOT NULL DEFAULT '0',
  "targetValue" numeric(18, 4) NOT NULL DEFAULT '0',
  "currentValue" numeric(18, 4) NOT NULL DEFAULT '0',
  "unit" text,
  "weight" numeric(6, 2) NOT NULL DEFAULT '0',
  "dataSource" text NOT NULL DEFAULT 'pending',
  "scope" text NOT NULL DEFAULT 'bonus',
  "tenantId" text NOT NULL DEFAULT 'default',
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Kpi_cycleId_level_scope_idx" ON "Kpi" ("cycleId", "level", "scope");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Kpi_assigneeId_cycleId_idx" ON "Kpi" ("assigneeId", "cycleId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Kpi_parentKpiId_idx" ON "Kpi" ("parentKpiId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Kpi_departmentId_cycleId_idx" ON "Kpi" ("departmentId", "cycleId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Kpi_bscPerspective_cycleId_idx" ON "Kpi" ("bscPerspective", "cycleId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Kpi_tenantId_idx" ON "Kpi" ("tenantId");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiCheckIn" (
  "id" text PRIMARY KEY NOT NULL,
  "kpiId" text NOT NULL,
  "asOf" text NOT NULL,
  "cumulativeValue" numeric(18, 4) NOT NULL,
  "delta" numeric(18, 4) NOT NULL DEFAULT '0',
  "source" text NOT NULL DEFAULT 'manual',
  "note" text,
  "createdBy" text NOT NULL,
  "tenantId" text NOT NULL DEFAULT 'default',
  "createdAt" timestamp(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiCheckIn_kpiId_asOf_idx" ON "KpiCheckIn" ("kpiId", "asOf");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiCheckIn_tenantId_idx" ON "KpiCheckIn" ("tenantId");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiSnapshot" (
  "id" text PRIMARY KEY NOT NULL,
  "kpiId" text NOT NULL,
  "date" text NOT NULL,
  "cumulativeValue" numeric(18, 4) NOT NULL,
  "source" text NOT NULL DEFAULT 'erp',
  "breakdown" jsonb,
  "tenantId" text NOT NULL DEFAULT 'default',
  "createdAt" timestamp(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiSnapshot_kpiId_date_idx" ON "KpiSnapshot" ("kpiId", "date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "KpiSnapshot_kpiId_date_uniq" ON "KpiSnapshot" ("kpiId", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiSnapshot_tenantId_date_idx" ON "KpiSnapshot" ("tenantId", "date");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiManualEntry" (
  "id" text PRIMARY KEY NOT NULL,
  "kpiId" text NOT NULL,
  "operatorId" text NOT NULL,
  "operatorRole" text NOT NULL,
  "fromValue" numeric(18, 4) NOT NULL,
  "toValue" numeric(18, 4) NOT NULL,
  "reason" text NOT NULL,
  "evidenceUrl" text,
  "tenantId" text NOT NULL DEFAULT 'default',
  "createdAt" timestamp(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiManualEntry_kpiId_operatorId_idx" ON "KpiManualEntry" ("kpiId", "operatorId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiManualEntry_kpiId_createdAt_idx" ON "KpiManualEntry" ("kpiId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiManualEntry_tenantId_idx" ON "KpiManualEntry" ("tenantId");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiBonusPayout" (
  "id" text PRIMARY KEY NOT NULL,
  "cycleId" text NOT NULL,
  "assigneeId" text NOT NULL,
  "baseBonus" numeric(18, 2) NOT NULL,
  "weightedCompletion" numeric(6, 4) NOT NULL,
  "finalBonus" numeric(18, 2) NOT NULL,
  "contributions" jsonb NOT NULL DEFAULT '[]',
  "calculatedAt" timestamp(3) NOT NULL,
  "calculatedBy" text NOT NULL,
  "committed" boolean NOT NULL DEFAULT false,
  "committedAt" timestamp(3),
  "note" text,
  "tenantId" text NOT NULL DEFAULT 'default'
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiBonusPayout_cycleId_assigneeId_idx" ON "KpiBonusPayout" ("cycleId", "assigneeId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiBonusPayout_committed_cycleId_idx" ON "KpiBonusPayout" ("committed", "cycleId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiBonusPayout_tenantId_idx" ON "KpiBonusPayout" ("tenantId");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "KpiCausalLink" (
  "id" text PRIMARY KEY NOT NULL,
  "cycleId" text NOT NULL,
  "fromKpiId" text NOT NULL,
  "toKpiId" text NOT NULL,
  "strength" numeric(4, 3) NOT NULL DEFAULT '0.5',
  "hypothesis" text,
  "validated" boolean NOT NULL DEFAULT false,
  "validatedAt" timestamp(3),
  "validatedBy" text,
  "validationNote" text,
  "tenantId" text NOT NULL DEFAULT 'default',
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiCausalLink_fromKpiId_cycleId_idx" ON "KpiCausalLink" ("fromKpiId", "cycleId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiCausalLink_toKpiId_cycleId_idx" ON "KpiCausalLink" ("toKpiId", "cycleId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "KpiCausalLink_from_to_cycle_uniq" ON "KpiCausalLink" ("fromKpiId", "toKpiId", "cycleId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KpiCausalLink_tenantId_idx" ON "KpiCausalLink" ("tenantId");
