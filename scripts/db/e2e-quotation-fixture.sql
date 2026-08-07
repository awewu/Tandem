-- E2E 报价 fixture：挂到真实 opp 的 project/customer，满足 opportunities.quotation_id FK，用于 sign 全链验证。
SET search_path TO rhautt_nexus, public;
INSERT INTO rhautt_nexus.quotations (
  id, tenant_id, customer_id, quotation_no, version, status,
  product_module_id, product_deployment_mode, product_namespace, product_data_namespace,
  currency, bom, cost_snapshot, price_snapshot, margin_snapshot, approval_state,
  quotation_lock, source, project, system_families, econet_premium, tax_profile, project_id
) VALUES (
  gen_random_uuid(), '3b5885a6-0d88-4ee9-b1f0-e02f63e1bd99', 'cbadef63-eb0e-4f53-97ae-de2d93f6184a',
  'Q-E2E-001', 1, 'approved',
  'rhautt-shared-platform', 'shared', 'rhautt_shared', 'rhautt_shared',
  'CNY', '[]'::jsonb, '{}'::jsonb, '{"total":300000}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  '{}'::jsonb, 'e2e', '{}'::jsonb, '{}'::text[], '{}'::jsonb, '{}'::jsonb,
  'aabbe2ab-7913-495d-b188-2797a187397c'
)
RETURNING id, quotation_no, status;
