-- 派单审计样本（验证驾驶舱线索分配度量：成功率 + 未覆盖地域）
SET search_path TO rhautt_nexus, public;
WITH t AS (SELECT id AS tid FROM rhautt_nexus.tenants WHERE code='DEFAULT'),
     c AS (SELECT id AS cid FROM rhautt_nexus.customers WHERE tenant_id=(SELECT tid FROM t) LIMIT 1)
INSERT INTO rhautt_nexus.dispatch_routing_decisions (tenant_id, intake_customer_id, rule, status, province, city, category, reason, candidates)
SELECT (SELECT tid FROM t), (SELECT cid FROM c), 'geo+category+load', 'routed', '上海', '上海', '中央热水', '命中 上海旗舰店', '[]'::jsonb
UNION ALL
SELECT (SELECT tid FROM t), (SELECT cid FROM c), 'geo+category+load', 'unrouted', '江苏', '南京', '地源热泵', '无经销商可服务所需品类/地域', '[]'::jsonb;
SELECT status, count(*) FROM rhautt_nexus.dispatch_routing_decisions GROUP BY status;
