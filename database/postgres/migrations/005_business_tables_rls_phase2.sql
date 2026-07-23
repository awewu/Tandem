-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 005
-- 阶段二 · 对 004 中「仅建表、暂缓 RLS」的租户业务表启用强 RLS
--
-- 背景（见 docs/DATABASE-GAP-ANALYSIS.md §7.4）：
--   004 已建表但未启用 RLS 的 6 张表，写入/读取路径已核实安全：
--     - delivery_records / rysnova_bim_artifacts / lifecycle_links / notifications
--       / analytics_events：当前 NestJS 为 stub 或委托 legacy Express，
--       而 legacy 使用内存存储（memoryDb），**不写 Postgres rhautt_nexus**；
--       Postgres 侧无任何写入/读取路径 → 启用 FORCE RLS 安全，且对未来写入方
--       形成「安全默认 / fail-fast」：未绑定租户上下文的写入将被 DB 拒绝。
--     - price_list_items：唯一读路径 product-catalog.service.getDealerPrice
--       已切到 withRlsTransaction（事务内 SET LOCAL app.tenant_id）。
--
-- 共享目录 products 维持排除：tenant_id 为非 uuid 哨兵 'rhautt_shared'，
-- HQ 写、全租户读，不纳入 current_tenant_id()::uuid 隔离。
--
-- 同规范：schema rhautt_nexus · current_tenant_id() · tenant_isolation
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.delivery_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.rysnova_bim_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.lifecycle_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.analytics_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.price_list_items   ENABLE ROW LEVEL SECURITY;

ALTER TABLE rhautt_nexus.delivery_records   FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.rysnova_bim_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.lifecycle_links    FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.notifications      FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.analytics_events   FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.price_list_items   FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_records_tenant_isolation ON rhautt_nexus.delivery_records;
CREATE POLICY delivery_records_tenant_isolation ON rhautt_nexus.delivery_records
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS rysnova_bim_artifacts_tenant_isolation ON rhautt_nexus.rysnova_bim_artifacts;
CREATE POLICY rysnova_bim_artifacts_tenant_isolation ON rhautt_nexus.rysnova_bim_artifacts
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS lifecycle_links_tenant_isolation ON rhautt_nexus.lifecycle_links;
CREATE POLICY lifecycle_links_tenant_isolation ON rhautt_nexus.lifecycle_links
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS notifications_tenant_isolation ON rhautt_nexus.notifications;
CREATE POLICY notifications_tenant_isolation ON rhautt_nexus.notifications
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS analytics_events_tenant_isolation ON rhautt_nexus.analytics_events;
CREATE POLICY analytics_events_tenant_isolation ON rhautt_nexus.analytics_events
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS price_list_items_tenant_isolation ON rhautt_nexus.price_list_items;
CREATE POLICY price_list_items_tenant_isolation ON rhautt_nexus.price_list_items
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- ════════════════════════════════════════════════════════════════════════
-- 收口后仍开口的 foundation 项（不在本迁移；见 §7.2/§7.4）：
--   - auth（users）/ tenant（dealers/stores）：需独立特权 DB 路径/角色，
--     不能简单按 user.tenantId 绑定事务（登录/HQ 引导态先于租户上下文）。
--   - bim.publicLookup：跨租户公开读，需 SECURITY DEFINER 函数或 BYPASSRLS 只读角色。
-- ════════════════════════════════════════════════════════════════════════
