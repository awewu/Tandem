-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 008
-- 设计方案签章/放行台账（design_releases）
--
-- 背景（W1 精算归位 · 决议#4「设备制造商不承担设计责任、经销商自负合规」）：
--   POST /design/calc 产出七系统 + 五恒维度 + 必算校验闸（软闸）结论。
--   方案签章状态机：draft → reviewed → released。
--   软闸：闸 blocked 时默认拦截 released；经销商可【显式签字越过】（留审计）后放行。
--   本表记录每次放行的闸快照、签字越过审计、免责声明确认。
--
-- design.service 走 withRlsTransaction（事务内 SET LOCAL app.tenant_id），
-- 与 004 阶段一同规范：建表 + ENABLE+FORCE ROW LEVEL SECURITY + tenant_isolation。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.design_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  project_id uuid,
  customer_id uuid,
  -- 签章状态机：draft → reviewed → released
  status text NOT NULL DEFAULT 'draft',
  -- 校验闸快照（runCalc 输出：systems / comfortDimensions / gate）
  calc_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  gate_pass boolean,            -- 闸整体结论：true/false/null(数据不足)
  gate_blocked boolean NOT NULL DEFAULT false,
  -- 软闸签字越过审计
  override_required boolean NOT NULL DEFAULT false,
  override_signed boolean NOT NULL DEFAULT false,
  override_by uuid,
  override_reason text,
  override_signed_at timestamptz,
  -- 签章人/时间
  reviewed_by uuid,
  reviewed_at timestamptz,
  released_by uuid,
  released_at timestamptz,
  -- 免责声明确认（经销商责任主体）
  disclaimer_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS design_releases_tenant_project_idx ON rhautt_nexus.design_releases (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS design_releases_tenant_status_idx ON rhautt_nexus.design_releases (tenant_id, status);

ALTER TABLE rhautt_nexus.design_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.design_releases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS design_releases_tenant_isolation ON rhautt_nexus.design_releases;
CREATE POLICY design_releases_tenant_isolation ON rhautt_nexus.design_releases
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
