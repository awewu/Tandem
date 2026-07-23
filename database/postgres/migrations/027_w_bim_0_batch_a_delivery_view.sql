-- 027_w_bim_0_batch_a_delivery_view.sql
-- W-BIM-0 · 批 A：C 交付语义归位 delivery/lifecycle
-- 1) lifecycle_links 增加 bim_project_id 索引（与 bim_projects 关联）
-- 2) delivery_records 增加 bim_project_id（可选，用于快速过滤）
-- 3) 创建视图 v_bim_project_delivery，聚合 bim_projects + lifecycle_links
--    + delivery_records + contracts，供 rysnova-bim 只读聚合查询
-- 本迁移只新增字段/视图，不删旧字段、不改写端点。幂等执行。

SET search_path TO rhautt_nexus, public;

-- ── lifecycle_links 增加 bim_project_id ───────────────────────────────────
ALTER TABLE rhautt_nexus.lifecycle_links
  ADD COLUMN IF NOT EXISTS bim_project_id uuid;

CREATE INDEX IF NOT EXISTS lifecycle_links_bim_project_id_idx
  ON rhautt_nexus.lifecycle_links (tenant_id, bim_project_id);

-- ── delivery_records 增加 bim_project_id（可选过滤）──────────────────────
ALTER TABLE rhautt_nexus.delivery_records
  ADD COLUMN IF NOT EXISTS bim_project_id uuid;

CREATE INDEX IF NOT EXISTS delivery_records_bim_project_id_idx
  ON rhautt_nexus.delivery_records (tenant_id, bim_project_id);

-- ── 聚合视图：rysnova-bim 项目容器 + 交付/生命周期数据 ───────────────────
-- 视图保持 bim_projects 的行级别，用 LATERAL/LEFT JOIN 聚合关联表。
-- 注意：RLS 策略会继承到底层基表；直接访问视图时须在当前租户上下文内。
CREATE OR REPLACE VIEW rhautt_nexus.v_bim_project_delivery AS
SELECT
  p.id,
  p.tenant_id,
  p.dealer_id,
  p.store_id,
  p.customer_id,
  p.quotation_id,
  p.quotation_no,
  p.status,
  p.customer_name,
  p.city,
  p.project,
  p.bom,
  p."costBreakdown" AS cost_breakdown,
  p.paid_value,
  p.system_families,
  p.drawing_url,
  p.bom_xlsx_url,
  p.acceptance_checklist,
  p.accepted_at,
  p.accepted_by,
  p.assigned_to,
  p.meta,
  p.created_at,
  p.updated_at,

  -- lifecycle 聚合：每 bim_project 取最新一条
  l.id AS lifecycle_link_id,
  l.stage AS lifecycle_stage,
  l.project_state,
  l.customer_visible_state,
  l.progress_percent,
  l.current_milestone,
  l.lifecycle_stage AS lifecycle_detail_stage,
  l.handover_status,
  l.rysnova_bim_package_id,
  l.design_project_id,
  l.contract_id AS lifecycle_contract_id,

  -- delivery 聚合：每 bim_project 取最新一条
  d.id AS delivery_record_id,
  d.status AS delivery_status,
  d.checklist AS delivery_checklist,

  -- contract 聚合：每报价单取最新一条
  c.id AS contract_id,
  c.contract_no,
  c.total_amount AS contract_total_amount,
  c.status AS contract_status,
  c.signed_at AS contract_signed_at,
  NULL::text AS signed_pdf_key
FROM rhautt_nexus.bim_projects p
LEFT JOIN LATERAL (
  SELECT * FROM rhautt_nexus.lifecycle_links l
  WHERE l.bim_project_id = p.id AND l.tenant_id = p.tenant_id
  ORDER BY l.updated_at DESC, l.created_at DESC
  LIMIT 1
) l ON true
LEFT JOIN LATERAL (
  SELECT * FROM rhautt_nexus.delivery_records d
  WHERE d.bim_project_id = p.id AND d.tenant_id = p.tenant_id
  ORDER BY d.updated_at DESC, d.created_at DESC
  LIMIT 1
) d ON true
LEFT JOIN LATERAL (
  SELECT * FROM rhautt_nexus.contracts c
  WHERE c.quotation_id = p.quotation_id AND c.tenant_id = p.tenant_id
  ORDER BY c.updated_at DESC, c.created_at DESC
  LIMIT 1
) c ON true;

-- 为视图字段建简单索引，帮助 planner 选择正确关联路径
CREATE INDEX IF NOT EXISTS contracts_quotation_id_idx
  ON rhautt_nexus.contracts (tenant_id, quotation_id);
