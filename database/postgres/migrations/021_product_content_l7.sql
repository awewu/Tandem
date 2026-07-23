-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 021
-- D2 产品事实基座 · L7 营销供给层（i18n + SEO/GEO + 富营销内容）
--
-- 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §10（🔒 设计锁定 2026-07-05）。
-- 权限域：D2 产品（品牌运营租户 UUID 门牌，模型 B）。
--
-- 范围与边界（重要）：
--   · product_content = 每「产品 × locale」一行的营销供给层，跟随产品的品牌运营
--     租户（tenant_id uuid），FORCE RLS 强隔离（对齐 018 规范）。
--   · L7a i18n：locale（BCP-47）+ 本地化 name + display_currency（展示币，非定价）。
--   · L7b SEO/GEO：seo jsonb + gtin + mpn（schema.org Product/Offer 全球贸易标识）。
--     JSON-LD 不落库——由 product-catalog.service.buildJsonLd() 读时计算投影，避免漂移。
--   · L7c 富营销内容：marketing jsonb（headline/subhead/featureBenefits/highlights/faq）。
--   · 发布态：status draft/published；只有 published 进公开只读供给（L5）。
--   · 定价永不入 L7（归 price_list_items / D4）；公开投影延续脱敏红线（无 cost/PII）。
--
-- 规范对齐 004/018：schema rhautt_nexus · current_tenant_id() · tenant_id = current_tenant_id()
--   写入方走 withRlsTransaction；tenant_id 引用 tenants(id)。
-- 幂等：CREATE TABLE/INDEX/POLICY IF NOT EXISTS（+ DROP POLICY IF EXISTS），可重复应用。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

DO $$
BEGIN
  IF to_regclass('rhautt_nexus.products') IS NULL THEN
    RAISE NOTICE 'rhautt_nexus.products absent (public working copy) — skip 020';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS rhautt_nexus.product_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
    product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id) ON DELETE CASCADE,
    -- L7a i18n
    locale text NOT NULL,                       -- BCP-47, e.g. zh-CN / en-US
    name text,                                  -- localized display name
    display_currency text NOT NULL DEFAULT 'CNY',
    -- L7b SEO/GEO
    seo jsonb NOT NULL DEFAULT '{}'::jsonb,      -- {metaTitle, metaDescription, canonical, ogImage, keywords[]}
    gtin text,                                  -- schema.org gtin
    mpn text,                                   -- schema.org mpn
    -- L7c rich marketing content
    marketing jsonb NOT NULL DEFAULT '{}'::jsonb,-- {headline, subhead, featureBenefits[], highlights[], faq[]}
    -- publish gate
    status text NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'published')),
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, product_id, locale)
  );

  CREATE INDEX IF NOT EXISTS product_content_product_locale_idx
    ON rhautt_nexus.product_content (product_id, locale);
  CREATE INDEX IF NOT EXISTS product_content_tenant_status_idx
    ON rhautt_nexus.product_content (tenant_id, status);

  -- 强 RLS：写入方（product-catalog.service）走 withRlsTransaction，立即启用。
  ALTER TABLE rhautt_nexus.product_content ENABLE ROW LEVEL SECURITY;
  ALTER TABLE rhautt_nexus.product_content FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS product_content_tenant_isolation ON rhautt_nexus.product_content;
  CREATE POLICY product_content_tenant_isolation ON rhautt_nexus.product_content
    USING (tenant_id = rhautt_nexus.current_tenant_id())
    WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

  RAISE NOTICE 'Migration 021: product_content (L7 marketing supply) ensured with FORCE RLS';
END $$;
