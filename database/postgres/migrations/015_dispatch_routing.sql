-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 015
-- 问诊→经销商智能派单（线索交接层 P1 · LEAD-HANDOFF-DESIGN §3/§5/§6）
--   dispatch_dealer_directory  → 派单路由目录（底座 foundation 行 tenant_id=NULL 全租户可读；
--                                 仅路由字段，无 PII、无成本价；解决 dealers 表 FORCE RLS 跨租户读不到的障碍）
--   dispatch_routing_decisions → 派单决策审计（落获客暂存池租户，租户隔离强 RLS）
-- 与 001/002 同规范：schema rhautt_nexus · current_tenant_id() · ENABLE+FORCE RLS
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ── 派单路由目录（底座 · foundation 行 tenant_id 为 NULL 全租户可读） ─────────
-- 由 HQ/招商在经销商上线时维护的「可派单索引」。派单器（系统态）跨租户读此目录，
-- 而非直接读 FORCE-RLS 的 rhautt_nexus.dealers（避免暴露经销商经营数据）。
CREATE TABLE IF NOT EXISTS rhautt_nexus.dispatch_dealer_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES rhautt_nexus.tenants(id),      -- NULL = foundation（跨租户可读）
  dealer_id uuid NOT NULL,                                  -- 对应 dealers.id（其真实归属租户见 dealer_tenant_id）
  dealer_tenant_id uuid,                                    -- 经销商真实租户（供后续系统态迁移落库）
  store_id uuid,
  name text NOT NULL,
  province text,
  city text,
  categories text[] NOT NULL DEFAULT ARRAY[]::text[],       -- 可服务品类（对齐问诊痛点 id：hot_water/heating/fresh_air/water_quality/air/smart）
  contract_level text,                                      -- S/A/B：合约等级权重
  active boolean NOT NULL DEFAULT true,
  active_load integer NOT NULL DEFAULT 0,                   -- 在派负载（派单器自增，负载均衡用）
  capacity integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_id)
);
CREATE INDEX IF NOT EXISTS dispatch_dir_active_idx ON rhautt_nexus.dispatch_dealer_directory (active, city);

-- ── 派单决策审计（租户隔离 · 落获客暂存池租户） ─────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.dispatch_routing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  intake_customer_id uuid NOT NULL,
  intake_opportunity_id uuid,
  source text,
  city text,
  province text,
  category text,                                            -- 主品类（问诊首要痛点）
  rule text NOT NULL DEFAULT 'geo+category+load',
  chosen_dealer_id uuid,
  chosen_store_id uuid,
  chosen_dealer_tenant_id uuid,
  score numeric,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,            -- 候选打分明细（Top-N，供申诉/复盘）
  reason text,
  status text NOT NULL DEFAULT 'routed' CHECK (status IN ('routed','unrouted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispatch_dec_tenant_idx ON rhautt_nexus.dispatch_routing_decisions (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS dispatch_dec_customer_idx ON rhautt_nexus.dispatch_routing_decisions (tenant_id, intake_customer_id);

-- ── RLS 加固 ─────────────────────────────────────────────────────────────
-- 目录：底座 foundation 行（tenant_id IS NULL）全租户可读；tenant-private 行按租户隔离（同 002 mdm 模式）
ALTER TABLE rhautt_nexus.dispatch_dealer_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.dispatch_dealer_directory FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispatch_dir_scope ON rhautt_nexus.dispatch_dealer_directory;
CREATE POLICY dispatch_dir_scope ON rhautt_nexus.dispatch_dealer_directory
  USING (tenant_id IS NULL OR tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = rhautt_nexus.current_tenant_id());

-- 决策审计：租户隔离强 RLS
ALTER TABLE rhautt_nexus.dispatch_routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.dispatch_routing_decisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispatch_dec_tenant_isolation ON rhautt_nexus.dispatch_routing_decisions;
CREATE POLICY dispatch_dec_tenant_isolation ON rhautt_nexus.dispatch_routing_decisions
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
