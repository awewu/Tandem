-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 011
-- D2 产品事实基座 · 定位层（P1）+ MDM-lite 稳定标识预留
--
-- 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §2 / §5.5 / §6。
-- 权限域：D2 产品（HQ 共享目录；product_manager 录入定位）。
--
-- 范围与边界（重要）：
--   · products 仍是「HQ 共享目录」（varchar tenant_id，非 RLS 表，见 004/009）。
--     本迁移【只增量加列】，不改 tenant_id 语义、不强开 RLS、不做 repoint。
--   · positioning = 结构化定位（卖给谁/渠道/用户/市场/卖点），默认空对象；
--     由 NestJS product-catalog.service 归一化后写入（受控词表软约束）。
--   · product_key = 跨品牌稳定产品身份预留列（P4 去重用），本期只建列 + 索引，
--     不启用去重/合并逻辑。
--
-- 幂等：ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS，可重复应用。
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('rhautt_nexus.products') IS NOT NULL THEN
    ALTER TABLE rhautt_nexus.products
      ADD COLUMN IF NOT EXISTS positioning jsonb NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE rhautt_nexus.products
      ADD COLUMN IF NOT EXISTS product_key text;

    CREATE INDEX IF NOT EXISTS products_product_key_idx
      ON rhautt_nexus.products (product_key);

    RAISE NOTICE 'Migration 011: products.positioning + product_key ensured';
  ELSE
    RAISE NOTICE 'rhautt_nexus.products absent (public working copy) — skip 011';
  END IF;
END $$;
