-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 024
-- 施工交付过程管控（套件2 · 交付管控原生化，替 Legacy technicalDelivery 壳）
--   delivery_projects    → 施工项目（1 合同 1 项目，幂等）
--   delivery_milestones  → 里程碑节点（进场→隐蔽→主材→调试→收尾，逐节点推进）
--   delivery_payments    → 进度款（节点完成才解锁：定金/进度款/尾款，防误触发）
--   delivery_evidence    → 验收留证（隐蔽工程强制影像/电子签，过节点前置）
-- 与 001/002/015 同规范：schema rhautt_nexus · current_tenant_id() · ENABLE+FORCE RLS
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ── 施工项目（合同生效后派生；租户隔离强 RLS） ─────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.delivery_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  store_id uuid,
  contract_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  quotation_id uuid,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in-progress','acceptance-pending','delivered','cancelled')),
  current_milestone_key text,
  total_amount numeric NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contract_id)                        -- 1 合同 1 项目（幂等）
);
CREATE INDEX IF NOT EXISTS delivery_proj_tenant_status_idx ON rhautt_nexus.delivery_projects (tenant_id, status);
CREATE INDEX IF NOT EXISTS delivery_proj_customer_idx ON rhautt_nexus.delivery_projects (tenant_id, customer_id);

-- ── 里程碑节点（模板实例化，逐节点推进） ───────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.delivery_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  project_id uuid NOT NULL,
  key text NOT NULL,                                     -- enter|concealed|main-material|commissioning|finishing
  label text NOT NULL,
  seq integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in-progress','completed')),
  requires_evidence boolean NOT NULL DEFAULT false,      -- 隐蔽工程：过节点前必须留证
  requires_acceptance boolean NOT NULL DEFAULT false,    -- 需验收签认
  unlocks_payment_key text,                              -- 完成后解锁的款项 kind（progress/final）
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id, key)
);
CREATE INDEX IF NOT EXISTS delivery_ms_project_idx ON rhautt_nexus.delivery_milestones (tenant_id, project_id, seq);

-- ── 进度款（节点解锁；locked→payable→paid） ────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.delivery_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  project_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deposit','progress','final')),
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'locked'
    CHECK (status IN ('locked','payable','paid','cancelled')),
  unlocked_by_milestone_key text,                        -- NULL = 立即可收（如定金）
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id, kind)
);
CREATE INDEX IF NOT EXISTS delivery_pay_project_idx ON rhautt_nexus.delivery_payments (tenant_id, project_id);

-- ── 验收留证（隐蔽工程影像/电子签；过节点前置证据） ─────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.delivery_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  project_id uuid NOT NULL,
  milestone_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('photo','esign','doc')),
  object_key text,                                       -- 对象存储 key（复用 rysnova-bim 存储适配器）
  note text,
  signer_id text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_evi_milestone_idx ON rhautt_nexus.delivery_evidence (tenant_id, milestone_id);

-- ── RLS 加固（四表租户隔离强 RLS，同 015 决策审计模式） ─────────────────────
ALTER TABLE rhautt_nexus.delivery_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.delivery_projects FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_proj_tenant_isolation ON rhautt_nexus.delivery_projects;
CREATE POLICY delivery_proj_tenant_isolation ON rhautt_nexus.delivery_projects
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.delivery_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.delivery_milestones FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_ms_tenant_isolation ON rhautt_nexus.delivery_milestones;
CREATE POLICY delivery_ms_tenant_isolation ON rhautt_nexus.delivery_milestones
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.delivery_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.delivery_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_pay_tenant_isolation ON rhautt_nexus.delivery_payments;
CREATE POLICY delivery_pay_tenant_isolation ON rhautt_nexus.delivery_payments
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.delivery_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.delivery_evidence FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_evi_tenant_isolation ON rhautt_nexus.delivery_evidence;
CREATE POLICY delivery_evi_tenant_isolation ON rhautt_nexus.delivery_evidence
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
