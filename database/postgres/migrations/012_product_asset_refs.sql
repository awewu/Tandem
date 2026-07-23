-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 012
-- D2 产品事实基座 · 素材引用层（P2）
--
-- 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §3 / §6。
-- 权限域：D2 产品（HQ 共享目录）。
--
-- 范围与边界：
--   · asset_refs = 产品挂载的 DAM 制品引用数组（主图/参数表/认证/BIM族/说明书），
--     只存引用（{role, artifactId, objectKey?, filename?, mimeType?}），文件仍在
--     file-artifact / 对象存储，本表不复制文件。
--   · 与既有 meta.imageArtifactId（站点卡片图无损往返）并存，向后兼容。
--   · products 仍是「HQ 共享目录」，本迁移只增量加列，不改 tenant_id / RLS。
--
-- 幂等：ADD COLUMN IF NOT EXISTS，可重复应用。
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('rhautt_nexus.products') IS NOT NULL THEN
    ALTER TABLE rhautt_nexus.products
      ADD COLUMN IF NOT EXISTS asset_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

    RAISE NOTICE 'Migration 012: products.asset_refs ensured';
  ELSE
    RAISE NOTICE 'rhautt_nexus.products absent (public working copy) — skip 012';
  END IF;
END $$;
