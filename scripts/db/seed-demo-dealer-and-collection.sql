-- seed-demo-dealer-and-collection.sql
-- 开发/演示：为 everhot 租户铺一个 demo 经销商 + 其收款配置，
-- 使公开问诊完成能把线索派给该经销商，且「可退定金」路由到经销商各自收款路径（每家不同）。
-- 幂等：按固定 id 先删后插。
-- 注意：dealer_id 需与 Nest 的 PUBLIC_DIAGNOSIS_DEALER_ID 一致。

SET search_path TO rhautt_nexus, public;

\set TENANT 'e5e40000-0000-4000-8000-000000000001'
\set DEALER 'd0000000-0000-4000-8000-000000000001'

BEGIN;

DELETE FROM rhautt_nexus.dealer_collection_configs WHERE tenant_id = :'TENANT' AND dealer_id = :'DEALER';
DELETE FROM rhautt_nexus.dealers WHERE id = :'DEALER';

INSERT INTO rhautt_nexus.dealers (id, tenant_id, code, name, province, city, status, contract_level, contact, created_at, updated_at)
VALUES (:'DEALER', :'TENANT', 'DEMO-SH-001', '演示经销商·上海旗舰店', '上海', '上海', 'active', 'gold', '{"phone":"021-00000000"}'::jsonb, now(), now());

-- 收款配置：在线支付链接（演示）；可退定金默认 2000 元。不同经销商可配不同 channel（link/qr/offline）。
INSERT INTO rhautt_nexus.dealer_collection_configs (id, tenant_id, dealer_id, channel, pay_url, qr_image_url, offline_note, merchant_ref, default_deposit_amount, active, created_at, updated_at)
VALUES (gen_random_uuid(), :'TENANT', :'DEALER', 'link', 'https://example.com/pay/demo-sh-001', NULL, '如需线下支付，请联系门店顾问', 'DEMO-MERCHANT-001', 2000, true, now(), now());

COMMIT;

SELECT d.name, c.channel, c.pay_url, c.default_deposit_amount
  FROM rhautt_nexus.dealers d
  JOIN rhautt_nexus.dealer_collection_configs c ON c.dealer_id = d.id
 WHERE d.id = :'DEALER';
