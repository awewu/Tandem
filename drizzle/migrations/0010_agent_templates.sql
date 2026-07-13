-- Migration 0010: AgentTemplate 强类型表 (分身编队 B-037 · M1)
-- 基础 Agent 模板 (员工从此 fork 技能分身)。双轨来源 internal / external_market。
-- 从 KvStore collection 'agent_templates' 升级为独立强类型表 (无存量数据, 无回填风险)。
-- 全部 IF NOT EXISTS / 幂等 DO 块, 可安全重跑。
-- 详见 docs/PERSONA-SQUAD-ARCHITECTURE.md §3.1 + lib/infra/drizzle-schema.ts agentTemplate。

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AgentTemplate" (
  "id" text PRIMARY KEY NOT NULL,
  "tenantId" text NOT NULL DEFAULT 'default',
  "name" text NOT NULL,
  "specialty" text NOT NULL,
  "origin" text NOT NULL DEFAULT 'internal',
  "externalRef" text,
  "basePrompt" text NOT NULL,
  "defaultSkills" jsonb NOT NULL DEFAULT '[]',
  "defaultKnowledgeTags" jsonb NOT NULL DEFAULT '[]',
  "status" text NOT NULL DEFAULT 'draft',
  "createdBy" text NOT NULL,
  "reviewedBy" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentTemplate_tenantId_status_idx" ON "AgentTemplate" ("tenantId", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentTemplate_tenantId_specialty_idx" ON "AgentTemplate" ("tenantId", "specialty");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentTemplate_origin_idx" ON "AgentTemplate" ("origin", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "AgentTemplate_tenantId_name_uniq" ON "AgentTemplate" ("tenantId", "name");

-- CHECK 约束 (枚举完整性) — 幂等: 仅在约束不存在时施加
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentTemplate_origin_chk') THEN
    ALTER TABLE "AgentTemplate" ADD CONSTRAINT "AgentTemplate_origin_chk"
      CHECK ("origin" IN ('internal', 'external_market'));
  END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentTemplate_status_chk') THEN
    ALTER TABLE "AgentTemplate" ADD CONSTRAINT "AgentTemplate_status_chk"
      CHECK ("status" IN ('draft', 'published', 'archived'));
  END IF;
END $$;

-- 完整性护栏: external_market 来源必须有 reviewedBy (§19 出站 + skill-gateway 审查)
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentTemplate_external_reviewed_chk') THEN
    ALTER TABLE "AgentTemplate" ADD CONSTRAINT "AgentTemplate_external_reviewed_chk"
      CHECK ("origin" <> 'external_market' OR "reviewedBy" IS NOT NULL);
  END IF;
END $$;
