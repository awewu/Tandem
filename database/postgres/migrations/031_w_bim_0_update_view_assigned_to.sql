-- W-BIM-0 · 批 B：更新 v_bim_project_delivery 视图，使 assigned_to 优先从 lifecycle_links 读取，
-- 与 BimService.assign 双写目标一致。

BEGIN;

DROP VIEW IF EXISTS rhautt_nexus.v_bim_project_delivery;

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
  COALESCE(l.assigned_to, p.assigned_to) AS assigned_to,
  p.meta,
  p.created_at,
  p.updated_at,

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

  d.id AS delivery_record_id,
  d.status AS delivery_status,
  d.checklist AS delivery_checklist,

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

COMMENT ON VIEW rhautt_nexus.v_bim_project_delivery IS
  'W-BIM-0 聚合视图：BIM 项目 + 生命周期 + 交付 + 合同；assigned_to 优先取 lifecycle_links。';

COMMIT;
