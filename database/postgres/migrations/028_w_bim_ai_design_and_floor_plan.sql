-- 028_w_bim_ai_design_and_floor_plan.sql
-- W-BIM-4/5 · 基础设计能力 + AI 设计引擎 + 角色阶梯
-- 1) floor_plans 表新增 pipes / devices / cad_image_url，对齐 designer-workbench 数据模型
-- 2) 创建 ai_design_audits 表，记录 AI 设计引擎调用审计链
-- 本迁移只新增字段/表，不删旧字段、不改写端点。幂等执行。

SET search_path TO rhautt_nexus, public;

-- ── floor_plans 扩展字段 ───────────────────────────────────────────────────
ALTER TABLE rhautt_nexus.floor_plans
  ADD COLUMN IF NOT EXISTS pipes jsonb,
  ADD COLUMN IF NOT EXISTS devices jsonb,
  ADD COLUMN IF NOT EXISTS cad_image_url varchar(2048);

-- ── AI 设计审计链 ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.ai_design_audits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  project_id      varchar(255) NOT NULL,
  user_id         uuid,
  user_role       varchar(64),
  action_type     varchar(32) NOT NULL,
  input           jsonb NOT NULL DEFAULT '{}',
  output          jsonb NOT NULL DEFAULT '{}',
  trust_state     varchar(32),
  model_version   varchar(64),
  kernel_version  varchar(64),
  gate_status     varchar(32),
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_design_audits_tenant_project_idx
  ON rhautt_nexus.ai_design_audits (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS ai_design_audits_tenant_created_idx
  ON rhautt_nexus.ai_design_audits (tenant_id, created_at DESC);
