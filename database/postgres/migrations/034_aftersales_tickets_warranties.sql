-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 034
-- 售后域原生化（aftersales）：承接 dealer 前端 /aftersales 的工单 + 保修台账，
-- 替换前端本地 mock（aftersales-data.ts）。
--   service_tickets → 售后工单（安装/维修/保养/投诉；派工/状态/关闭）
--   warranties      → 保修台账（按系统/产品登记，到期状态由 end_date 派生）
-- 与 001/004/024 同规范：schema rhautt_nexus · current_tenant_id() · ENABLE+FORCE RLS
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ── 售后工单 ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.service_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  store_id uuid,
  ticket_no text NOT NULL,
  customer_id uuid,
  customer_name text,
  phone text,
  bim_project_id uuid,
  category text NOT NULL DEFAULT 'repair'
    CHECK (category IN ('installation','repair','maintenance','complaint','other')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','assigned','in-progress','resolved','closed')),
  assigned_to text,
  resolution text,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ticket_no)
);
CREATE INDEX IF NOT EXISTS service_tickets_tenant_status_idx ON rhautt_nexus.service_tickets (tenant_id, status);
CREATE INDEX IF NOT EXISTS service_tickets_tenant_customer_idx ON rhautt_nexus.service_tickets (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS service_tickets_dealer_idx ON rhautt_nexus.service_tickets (tenant_id, dealer_id, status);

-- ── 保修台账 ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  store_id uuid,
  warranty_no text NOT NULL,
  customer_id uuid,
  customer_name text,
  bim_project_id uuid,
  product_name text,
  system_family text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','void')),
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, warranty_no)
);
CREATE INDEX IF NOT EXISTS warranties_tenant_customer_idx ON rhautt_nexus.warranties (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS warranties_tenant_end_idx ON rhautt_nexus.warranties (tenant_id, end_date);

-- ── RLS：租户强隔离（与 004/024 同规范） ───────────────────────────────────
ALTER TABLE rhautt_nexus.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.service_tickets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_tickets_tenant_isolation ON rhautt_nexus.service_tickets;
CREATE POLICY service_tickets_tenant_isolation ON rhautt_nexus.service_tickets
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.warranties FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS warranties_tenant_isolation ON rhautt_nexus.warranties;
CREATE POLICY warranties_tenant_isolation ON rhautt_nexus.warranties
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
