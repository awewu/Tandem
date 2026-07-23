-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 018
-- Entitlement 订阅授权 —— 商业化多租户 SaaS 的模块订阅账本。
--
-- 背景：Rysnova 作为独立软件公司，按「模块」售卖给租户（如 Rhautt Comfort）。
--   每条记录 = 某租户对某个可售模块的一份订阅（套餐/状态/席位/有效期）。
--   登录 token 的 entitlement 声明 + EntitlementGuard 依据此表放行受保护端点。
--
-- 可售模块（module_id，底座 auth/tenant/entitlement/compliance/mdm 不单独售卖，恒可用）：
--   板块一: site · product-catalog · growth
--   板块二: crm · diagnosis · quote · design · delivery · lifecycle · rysnova-bim
--   横向:   analytics
--
-- 规范对齐 004：schema rhautt_nexus · current_tenant_id() · tenant_id = current_tenant_id()
--   tenant_id uuid NOT NULL REFERENCES tenants(id)；写入方走 withRlsTransaction。
--   平台开通（跨租户）由 platform_admin 以 scopeOverride={tenantId} 事务写入，满足 WITH CHECK。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.tenant_module_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  module_id text NOT NULL,
  plan text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'suspended', 'canceled', 'expired')),
  seats integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_id)
);

CREATE INDEX IF NOT EXISTS tenant_module_subscriptions_tenant_status_idx
  ON rhautt_nexus.tenant_module_subscriptions (tenant_id, status);

-- 强 RLS：写入方（entitlement.service）已走 withRlsTransaction，立即启用。
ALTER TABLE rhautt_nexus.tenant_module_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.tenant_module_subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_module_subscriptions_tenant_isolation ON rhautt_nexus.tenant_module_subscriptions;
CREATE POLICY tenant_module_subscriptions_tenant_isolation ON rhautt_nexus.tenant_module_subscriptions
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
