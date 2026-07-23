-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 025
-- 定金 · 经销商收款路由（问诊转化漏斗「促定金」· 赋能经销商）
--   dealer_collection_configs → 每个经销商各自的收款路径（线下/收款码/自有链接/自有商户）
--   deposit_orders            → 可退定金订单 + 状态机（created→awaiting_payment→paid→refunded/cancelled/expired）
--
-- 定位：平台不收款，钱进「线索所属经销商」各自的收款路径；此处仅路由 + 跟踪 + 触发派单/CRM。
-- 诚实红线：不存支付密钥（密钥走安全配置）；仅存展示给消费者的收款方式与订单状态。
-- 与 001/002/015 同规范：schema rhautt_nexus · current_tenant_id() · ENABLE+FORCE RLS · 租户隔离。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- ── 经销商收款路径配置（每家不同；由经销商自维护） ─────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.dealer_collection_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'offline'
    CHECK (channel IN ('offline','qr','link','wechat_merchant','alipay_merchant')),
  pay_url text,
  qr_image_url text,
  offline_note text,
  merchant_ref text,                                    -- 商户参考号（不含密钥）
  default_deposit_amount numeric,                        -- 经销商设定的默认定金（元）
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dealer_id)
);
CREATE INDEX IF NOT EXISTS dealer_collection_dealer_idx
  ON rhautt_nexus.dealer_collection_configs (tenant_id, dealer_id);

-- ── 可退定金订单 ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rhautt_nexus.deposit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid,
  store_id uuid,
  customer_id uuid,
  opportunity_id uuid,
  report_id text,                                        -- 关联问诊报告
  amount numeric,                                        -- 定金金额（元，可空=待经销商确认）
  currency text NOT NULL DEFAULT 'CNY',
  channel text NOT NULL DEFAULT 'offline',
  state text NOT NULL DEFAULT 'created'
    CHECK (state IN ('created','awaiting_payment','paid','refunded','cancelled','expired')),
  instruction jsonb NOT NULL DEFAULT '{}'::jsonb,        -- 给消费者看的支付指引快照
  note text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deposit_orders_tenant_idx ON rhautt_nexus.deposit_orders (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS deposit_orders_dealer_idx ON rhautt_nexus.deposit_orders (tenant_id, dealer_id, state);
CREATE INDEX IF NOT EXISTS deposit_orders_report_idx ON rhautt_nexus.deposit_orders (tenant_id, report_id);

-- ── RLS 加固（租户隔离强 RLS，同 015 决策审计模式） ─────────────────────────
ALTER TABLE rhautt_nexus.dealer_collection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.dealer_collection_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dealer_collection_tenant_isolation ON rhautt_nexus.dealer_collection_configs;
CREATE POLICY dealer_collection_tenant_isolation ON rhautt_nexus.dealer_collection_configs
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.deposit_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.deposit_orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deposit_orders_tenant_isolation ON rhautt_nexus.deposit_orders;
CREATE POLICY deposit_orders_tenant_isolation ON rhautt_nexus.deposit_orders
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
