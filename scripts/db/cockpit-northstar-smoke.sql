-- Cockpit 北极星数据层 smoke：真 PG 复现 CockpitService.applyDeal
-- 验证：068 schema + inbox 幂等(唯一约束) + 求和重算 dealer_success + 北极星聚合 + ON CONFLICT upsert
SET search_path TO rhautt_nexus, public;
SET app.tenant_id = 'e5e40000-0000-4000-8000-000000000001';   -- 迁移009 播种的 Everhot 租户
SET app.actor_id = 'smoke';

\echo '--- 清理上次 smoke 数据 ---'
DELETE FROM growth_dealer_deal_inbox WHERE dealer_id IN ('D-Shanghai','D-Beijing');
DELETE FROM dealer_success_snapshot WHERE dealer_id IN ('D-Shanghai','D-Beijing');
DELETE FROM growth_north_star_snapshot WHERE metric IN ('active_profitable_dealers','network_gmv') AND period='2026-07';

\echo '--- 成交事件入 inbox（evt-1 故意重投两次，验证幂等）---'
INSERT INTO growth_dealer_deal_inbox (tenant_id, source_event_id, dealer_id, amount, period) VALUES
  (current_tenant_id(), 'evt-1', 'D-Shanghai', 88000, '2026-07') ON CONFLICT (tenant_id, source_event_id) DO NOTHING;
INSERT INTO growth_dealer_deal_inbox (tenant_id, source_event_id, dealer_id, amount, period) VALUES
  (current_tenant_id(), 'evt-1', 'D-Shanghai', 88000, '2026-07') ON CONFLICT (tenant_id, source_event_id) DO NOTHING;  -- 重投
INSERT INTO growth_dealer_deal_inbox (tenant_id, source_event_id, dealer_id, amount, period) VALUES
  (current_tenant_id(), 'evt-2', 'D-Shanghai', 120000, '2026-07') ON CONFLICT (tenant_id, source_event_id) DO NOTHING;
INSERT INTO growth_dealer_deal_inbox (tenant_id, source_event_id, dealer_id, amount, period) VALUES
  (current_tenant_id(), 'evt-3', 'D-Beijing', 60000, '2026-07') ON CONFLICT (tenant_id, source_event_id) DO NOTHING;

\echo '--- inbox 行数（应为 3，evt-1 只计一次）---'
SELECT count(*) AS inbox_rows FROM growth_dealer_deal_inbox WHERE tenant_id=current_tenant_id() AND period='2026-07';

\echo '--- 由 inbox 求和重算 dealer_success（upsert）---'
INSERT INTO dealer_success_snapshot (tenant_id, dealer_id, period, active, gmv, profit_proxy, deals)
SELECT tenant_id, dealer_id, period, true, SUM(amount), ROUND(SUM(amount)*0.28, 2), COUNT(*)
FROM growth_dealer_deal_inbox WHERE tenant_id=current_tenant_id() AND period='2026-07'
GROUP BY tenant_id, dealer_id, period
ON CONFLICT (tenant_id, dealer_id, period)
DO UPDATE SET gmv=EXCLUDED.gmv, profit_proxy=EXCLUDED.profit_proxy, deals=EXCLUDED.deals, active=true;

\echo '--- 经销商成功度（D-Shanghai 应 gmv=208000 deals=2 profit_proxy=58240）---'
SELECT dealer_id, gmv, profit_proxy, deals FROM dealer_success_snapshot
WHERE tenant_id=current_tenant_id() AND period='2026-07' ORDER BY gmv DESC;

\echo '--- 重算北极星 ---'
INSERT INTO growth_north_star_snapshot (tenant_id, metric, value, period)
SELECT current_tenant_id(), 'active_profitable_dealers',
       count(*) FILTER (WHERE active AND profit_proxy>0), '2026-07'
FROM dealer_success_snapshot WHERE tenant_id=current_tenant_id() AND period='2026-07'
ON CONFLICT (tenant_id, metric, period) DO UPDATE SET value=EXCLUDED.value;
INSERT INTO growth_north_star_snapshot (tenant_id, metric, value, period)
SELECT current_tenant_id(), 'network_gmv', COALESCE(SUM(gmv),0), '2026-07'
FROM dealer_success_snapshot WHERE tenant_id=current_tenant_id() AND period='2026-07'
ON CONFLICT (tenant_id, metric, period) DO UPDATE SET value=EXCLUDED.value;

\echo '--- 北极星（应 active_profitable_dealers=2, network_gmv=268000）---'
SELECT metric, value FROM growth_north_star_snapshot
WHERE tenant_id=current_tenant_id() AND period='2026-07' ORDER BY metric;
