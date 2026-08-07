-- 注入 diagnosis.completed(→到访) + quotation.created(→方案) 事件，验证漏斗中段订阅。
SET search_path TO rhautt_nexus, public;
INSERT INTO rhautt_nexus.mdm_outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload, status, attempts)
SELECT id, 'diagnosis.completed', 'diagnosis', gen_random_uuid(), '{}'::jsonb, 'pending', 0
FROM rhautt_nexus.tenants WHERE code='DEFAULT';
INSERT INTO rhautt_nexus.mdm_outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload, status, attempts)
SELECT id, 'quotation.created', 'quotation', gen_random_uuid(), '{}'::jsonb, 'pending', 0
FROM rhautt_nexus.tenants WHERE code='DEFAULT';
SELECT event_type, status FROM rhautt_nexus.mdm_outbox_events WHERE event_type IN ('diagnosis.completed','quotation.created') AND status='pending';
