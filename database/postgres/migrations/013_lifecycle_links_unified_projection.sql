-- 013 · 生命周期真相源收敛（#2 闭环）
-- ---------------------------------------------------------------------------
-- 背景：客户生命周期此前有两套割裂的库——
--   · Postgres rhautt_nexus.lifecycle_links：CRM/事件消费者在 RLS 事务内串联
--     头段（获客→签约），仅 stage + 时间线；
--   · Mongo LifecycleLink：遗留 Express 引擎写尾段（交接→生命周期），含 14 态
--     富字段（installedAssets/iot/servicePlan），客户门户与总部 rollup 只读它。
-- 二者键不同、词表不同、互不回填 → 闭环断裂。
--
-- 决议（方向 B）：收敛到 Postgres lifecycle_links 单一真相源。本迁移为其补齐
-- 承接/生命周期富字段（全部 additive、nullable、幂等），使一行 {tenant, customer}
-- 同时承载 funnel 串联与富生命周期投影。派生态词表与 PROJECT_STATES 一致。
-- ---------------------------------------------------------------------------

ALTER TABLE rhautt_nexus.lifecycle_links
  -- 14 态权威投影（与 lifecycle-states.ts / PROJECT_STATES 一致；默认与 stage 同步）
  ADD COLUMN IF NOT EXISTS project_state          text        NOT NULL DEFAULT 'lead-created',
  ADD COLUMN IF NOT EXISTS customer_visible_state  text,
  ADD COLUMN IF NOT EXISTS progress_percent        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_milestone       text,
  ADD COLUMN IF NOT EXISTS lifecycle_stage         text,
  ADD COLUMN IF NOT EXISTS handover_status         text        NOT NULL DEFAULT 'pending',
  -- 归属（供客户视图/rollup 的 dealer/store 归属过滤；RLS 仅隔离 tenant）
  ADD COLUMN IF NOT EXISTS dealer_id               uuid,
  ADD COLUMN IF NOT EXISTS store_id                uuid,
  -- 外部制品引用
  ADD COLUMN IF NOT EXISTS design_package_id       text,
  ADD COLUMN IF NOT EXISTS rysnova_bim_package_id     text,
  ADD COLUMN IF NOT EXISTS project_address         text,
  -- 富字段（JSON 投影，由 Nest 侧纯函数 normalize/build 计算）
  ADD COLUMN IF NOT EXISTS systems                 jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS iot                     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS devices                 jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS installed_assets        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS service_plan            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accepted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS created_by              uuid,
  ADD COLUMN IF NOT EXISTS updated_by              uuid;

-- 既有行 stage 迁移到规范词表（历史 'lead'/'signed' → 'lead-created'/'contract-pending'）。
UPDATE rhautt_nexus.lifecycle_links SET stage = 'lead-created'      WHERE stage = 'lead';
UPDATE rhautt_nexus.lifecycle_links SET stage = 'contract-pending'  WHERE stage = 'signed';
-- project_state 与 stage 对齐（既有行的默认值补齐）。
UPDATE rhautt_nexus.lifecycle_links SET project_state = stage
  WHERE project_state = 'lead-created' AND stage <> 'lead-created';

-- 按合同定位承接行（handover 以 contractId 落位）。
CREATE INDEX IF NOT EXISTS lifecycle_links_tenant_contract_idx
  ON rhautt_nexus.lifecycle_links (tenant_id, contract_id);
-- 客户视图/rollup 的 dealer/store 归属过滤。
CREATE INDEX IF NOT EXISTS lifecycle_links_tenant_dealer_state_idx
  ON rhautt_nexus.lifecycle_links (tenant_id, dealer_id, project_state);
