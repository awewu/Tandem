-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 004
-- 落位「无迁移」的租户业务表 + 对已具备租户绑定写入路径的表启用强 RLS
--
-- 背景（见 docs/DATABASE-GAP-ANALYSIS.md §7）：
--   001 落核心账本（customers/opportunities/quotations/contracts/... 已 FORCE RLS）
--   002 落 pipl_consents / design_rysnova_bim_sync / mdm_*（已 FORCE RLS）
--   但以下 NestJS 实体对应的业务表此前无任何 SQL 迁移、无 RLS，
--   隔离仅靠应用层 WHERE tenant_id —— 与「世界级 RLS 强隔离」不符。
--
-- 本迁移分两类处理：
--   A. 阶段一 · 立即强隔离：写入方已全部切到 withRlsTransaction（事务内 SET LOCAL app.tenant_id）
--      → bim_projects / design_projects / floor_plans / diagnosis_sessions / interactions
--      建表 + ENABLE+FORCE ROW LEVEL SECURITY + tenant_isolation
--   B. 阶段二 · 仅建表、暂不启用 RLS：写入方尚未改造（legacy Express / 未转换服务），
--      若现在启用 FORCE RLS 会阻断其写入。先补齐 schema，RLS 待写入方改造后由后续迁移启用。
--      → delivery_records / rysnova_bim_artifacts / lifecycle_links / notifications
--        / analytics_events / price_list_items / products
--
-- 同规范：schema rhautt_nexus · current_tenant_id() · tenant_id = current_tenant_id()
-- tenant_id 一律 uuid NOT NULL REFERENCES tenants(id)，与 001/002 对齐；
-- TypeORM 实体以 string 映射 uuid 列，读取无碍。
-- 注意：列名遵循项目约定——多词列显式 snake_case；唯一例外 bim_projects."costBreakdown"
--       （实体未显式命名，TypeORM 无命名策略 → 列名按属性名原样，故加引号保留驼峰）。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ A. 阶段一 · 建表 + 立即强 RLS                                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── CRM 互动记录（crm.service → withRlsTransaction） ──────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  customer_id uuid NOT NULL,
  opportunity_id uuid,
  actor_user_id uuid,
  type text NOT NULL DEFAULT 'note',
  content text,
  next_action text,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interactions_tenant_customer_idx ON rhautt_nexus.interactions (tenant_id, customer_id);

-- ── 诊断会话（diagnosis.service → withRlsTransaction） ────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.diagnosis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  customer_id uuid,
  opportunity_id uuid,
  report_id uuid,
  pain_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_tier text,
  solutions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_reasoning text,
  share_token_hash text,
  status text NOT NULL DEFAULT 'active',
  source_surface text NOT NULL DEFAULT 'pain-diagnosis.html',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS diagnosis_sessions_tenant_customer_idx ON rhautt_nexus.diagnosis_sessions (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS diagnosis_sessions_status_idx ON rhautt_nexus.diagnosis_sessions (tenant_id, status);

-- ── 设计项目（design.service → withRlsTransaction） ───────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.design_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  customer_id uuid,
  opportunity_id uuid,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS design_projects_tenant_customer_idx ON rhautt_nexus.design_projects (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS design_projects_status_idx ON rhautt_nexus.design_projects (tenant_id, status);

-- ── 户型图（design.service → withRlsTransaction） ─────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.floor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  project_id uuid NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  walls jsonb NOT NULL DEFAULT '{}'::jsonb,
  equipment jsonb NOT NULL DEFAULT '{}'::jsonb,
  rooms jsonb NOT NULL DEFAULT '{}'::jsonb,
  doors jsonb,
  windows jsonb,
  furniture jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS floor_plans_tenant_project_idx ON rhautt_nexus.floor_plans (tenant_id, project_id);

-- ── 瑞诺瓦 BIM 项目（bim.service → withRlsTransaction） ───────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.bim_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  store_id uuid,
  customer_id uuid NOT NULL,
  quotation_id uuid,
  quotation_no text,
  status text NOT NULL DEFAULT 'inherited',
  customer_name text,
  city text,
  project jsonb NOT NULL DEFAULT '{}'::jsonb,
  bom jsonb NOT NULL DEFAULT '[]'::jsonb,
  "costBreakdown" jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_value numeric(14,2) NOT NULL DEFAULT 0,
  system_families text NOT NULL DEFAULT '',
  drawing_url text,
  bom_xlsx_url text,
  acceptance_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted_at timestamptz,
  accepted_by text,
  assigned_to text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bim_projects_tenant_quotation_idx ON rhautt_nexus.bim_projects (tenant_id, quotation_id);
CREATE INDEX IF NOT EXISTS bim_projects_tenant_status_idx ON rhautt_nexus.bim_projects (tenant_id, status);

-- ── 阶段一 RLS 加固：ENABLE + FORCE + tenant_isolation ────────────────────
ALTER TABLE rhautt_nexus.interactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.diagnosis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.design_projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.floor_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.bim_projects       ENABLE ROW LEVEL SECURITY;

ALTER TABLE rhautt_nexus.interactions       FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.diagnosis_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.design_projects    FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.floor_plans        FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.bim_projects       FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interactions_tenant_isolation ON rhautt_nexus.interactions;
CREATE POLICY interactions_tenant_isolation ON rhautt_nexus.interactions
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS diagnosis_sessions_tenant_isolation ON rhautt_nexus.diagnosis_sessions;
CREATE POLICY diagnosis_sessions_tenant_isolation ON rhautt_nexus.diagnosis_sessions
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS design_projects_tenant_isolation ON rhautt_nexus.design_projects;
CREATE POLICY design_projects_tenant_isolation ON rhautt_nexus.design_projects
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS floor_plans_tenant_isolation ON rhautt_nexus.floor_plans;
CREATE POLICY floor_plans_tenant_isolation ON rhautt_nexus.floor_plans
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS bim_projects_tenant_isolation ON rhautt_nexus.bim_projects;
CREATE POLICY bim_projects_tenant_isolation ON rhautt_nexus.bim_projects
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ B. 阶段二 · 仅建表，暂不启用 RLS                                       ║
-- ║   写入方尚未切到 withRlsTransaction；启用 FORCE RLS 会阻断其写入。      ║
-- ║   待对应服务改造后，由后续迁移（005）补 ENABLE+FORCE+policy。          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── 交付记录（delivery，当前 legacy 引擎写入） ───────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.delivery_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  contract_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz,
  completed_at timestamptz,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_records_tenant_contract_idx ON rhautt_nexus.delivery_records (tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS delivery_records_status_idx ON rhautt_nexus.delivery_records (tenant_id, status);

-- ── Rysnova 交付物 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.rysnova_bim_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  project_id uuid,
  customer_id uuid,
  artifact_type text NOT NULL DEFAULT 'bim_model',
  name text NOT NULL,
  file_key text,
  bim_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rysnova_bim_artifacts_tenant_project_idx ON rhautt_nexus.rysnova_bim_artifacts (tenant_id, project_id);

-- ── 生命周期串联（lifecycle，当前 legacy 引擎写入） ──────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.lifecycle_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  customer_id uuid NOT NULL,
  opportunity_id uuid,
  quotation_id uuid,
  contract_id uuid,
  design_project_id uuid,
  stage text NOT NULL DEFAULT 'lead',
  transitions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lifecycle_links_tenant_customer_idx ON rhautt_nexus.lifecycle_links (tenant_id, customer_id);

-- ── 通知 ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_tenant_user_read_idx ON rhautt_nexus.notifications (tenant_id, user_id, read_at);

-- ── 行为分析事件 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  user_id uuid,
  customer_id uuid,
  event_type text NOT NULL,
  surface text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_tenant_type_time_idx ON rhautt_nexus.analytics_events (tenant_id, event_type, created_at);

-- ── 经销商价目项（依赖共享 products；product-catalog 服务尚未改造） ──────
CREATE TABLE IF NOT EXISTS rhautt_nexus.price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  product_id uuid NOT NULL,
  dealer_price numeric(14,2) NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_list_items_tenant_dealer_product_idx ON rhautt_nexus.price_list_items (tenant_id, dealer_id, product_id);

-- ── 共享产品目录（HQ 共享；tenant_id 为非 uuid 哨兵 'rhautt_shared'，不纳入 uuid RLS） ──
CREATE TABLE IF NOT EXISTS rhautt_nexus.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'rhautt_shared',
  sku text NOT NULL,
  name text NOT NULL,
  brand text,
  category text,
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  list_price numeric(14,2) NOT NULL DEFAULT 0,
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CNY',
  status text NOT NULL DEFAULT 'active',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_uidx ON rhautt_nexus.products (tenant_id, sku);
CREATE INDEX IF NOT EXISTS products_status_idx ON rhautt_nexus.products (status);

-- ════════════════════════════════════════════════════════════════════════
-- 阶段二待办（不在本迁移执行）：
--   待 delivery / rysnova-bim-artifact / lifecycle / notification / analytics /
--   product-catalog 写入方切到 withRlsTransaction 后，新增 005_*.sql 对
--   delivery_records / rysnova_bim_artifacts / lifecycle_links / notifications /
--   analytics_events / price_list_items 启用 ENABLE+FORCE RLS + tenant_isolation。
--   products 为共享目录（非 uuid 租户哨兵），维持 HQ 写、全租户读，不纳入 uuid RLS。
-- ════════════════════════════════════════════════════════════════════════
