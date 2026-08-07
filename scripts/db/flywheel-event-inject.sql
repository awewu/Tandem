-- 注入一条 pending crm.deal.signed 事件（DEFAULT 租户），验证 CockpitService 事件消费链。
SET search_path TO rhautt_nexus, public;
INSERT INTO rhautt_nexus.mdm_outbox_events
  (tenant_id, event_type, aggregate_type, aggregate_id, payload, status, attempts)
SELECT id, 'crm.deal.signed', 'opportunity', gen_random_uuid(),
       jsonb_build_object('dealerId','D-Flywheel-EVT','amount',200000,'signedAt','2026-08-03T10:00:00Z'),
       'pending', 0
FROM rhautt_nexus.tenants WHERE code='DEFAULT';
SELECT event_type, status, payload->>'dealerId' AS dealer, payload->>'amount' AS amount
FROM rhautt_nexus.mdm_outbox_events WHERE event_type='crm.deal.signed' AND status='pending';
