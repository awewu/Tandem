-- 派单引擎真机 E2E：目录 + 未归属客户 + 注入 lead.captured → 引擎自动派单落决策。
SET search_path TO rhautt_nexus, public;

-- 1) 经销商路由目录（foundation 行，tenant_id NULL 全租户可读）
INSERT INTO rhautt_nexus.dispatch_dealer_directory (tenant_id, dealer_id, name, province, city, categories, contract_level, active)
SELECT NULL, d.id, '上海旗舰经销商', '上海', '上海', ARRAY['中央热水'], 'A', true
FROM rhautt_nexus.dealers d JOIN rhautt_nexus.tenants t ON d.tenant_id=t.id
WHERE t.code='DEFAULT' AND d.code='DEFAULT-DEALER'
ON CONFLICT DO NOTHING;

-- 2) 未归属客户（DEFAULT 租户，dealer_id NULL，上海 + 中央热水）
INSERT INTO rhautt_nexus.customers (tenant_id, phone_hash, phone_encrypted, name, city, source, profile)
SELECT id, 'e2e-dispatch-hash-1', 'v1:x', '派单E2E客户', '上海', 'geo', '{"systems":["中央热水"],"province":"上海"}'::jsonb
FROM rhautt_nexus.tenants WHERE code='DEFAULT'
ON CONFLICT (tenant_id, phone_hash) DO NOTHING;

-- 3) 注入 lead.captured（引擎将在 DEFAULT 租户 RLS 内派单）
INSERT INTO rhautt_nexus.mdm_outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload, status, attempts)
SELECT c.tenant_id, 'lead.captured', 'customer', c.id, jsonb_build_object('customerId', c.id), 'pending', 0
FROM rhautt_nexus.customers c WHERE c.phone_hash='e2e-dispatch-hash-1';

SELECT 'dir' AS k, count(*) FROM rhautt_nexus.dispatch_dealer_directory
UNION ALL SELECT 'cust', count(*) FROM rhautt_nexus.customers WHERE phone_hash='e2e-dispatch-hash-1';
