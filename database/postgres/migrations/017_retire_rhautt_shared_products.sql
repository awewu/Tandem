-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 017
-- 退役 rhautt_shared 共享哨兵产品行（模型B 第1律 · 门牌裁定）
--
-- 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §5.6（🔒 模型B）。
-- 背景：线上盘点证实真产品（24 个 everhot，带定位/素材）落在品牌运营租户 UUID
--   下；rhautt_shared 门牌仅有 10 行早期 dev 占位（瑞合/Rheem/Ruud）。模型B 采
--   「品牌运营租户 UUID = 唯一门牌」，rhautt_shared 哨兵退役。
--
-- 本迁移：把 tenant_id='rhautt_shared' 的产品行**移入** products_archive（可回滚），
--   再从 products 删除。读路径不动（公开站读 EVERHOT_TENANT_ID，本就不服务这批行）。
--   price_list_items 不动（这批 dev 占位无真实经销商价盘；如有孤儿价行，
--   getDealerPrice 回落 listPrice=0，不致命）。
--
-- 幂等/安全：仅触碰 tenant_id='rhautt_shared'；products 非 RLS，无策略干扰。
-- 回滚：INSERT INTO products SELECT <cols> FROM products_archive WHERE archived_reason LIKE '%017%'。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

DO $$
DECLARE
  moved integer;
BEGIN
  IF to_regclass('rhautt_nexus.products') IS NOT NULL THEN
    -- 归档表：镜像 products 结构（含默认值/约束），幂等建 + 归档元列。
    CREATE TABLE IF NOT EXISTS rhautt_nexus.products_archive
      (LIKE rhautt_nexus.products INCLUDING ALL);
    ALTER TABLE rhautt_nexus.products_archive
      ADD COLUMN IF NOT EXISTS archived_at     timestamptz NOT NULL DEFAULT now();
    ALTER TABLE rhautt_nexus.products_archive
      ADD COLUMN IF NOT EXISTS archived_reason text;

    -- 移入归档（仅共享哨兵残留）。
    INSERT INTO rhautt_nexus.products_archive
      SELECT p.*, now(), 'model-B §5.6: rhautt_shared sentinel retired (migration 017)'
      FROM rhautt_nexus.products p
      WHERE p.tenant_id = 'rhautt_shared';
    GET DIAGNOSTICS moved = ROW_COUNT;

    DELETE FROM rhautt_nexus.products WHERE tenant_id = 'rhautt_shared';

    RAISE NOTICE 'Migration 017: archived + removed % rhautt_shared sentinel product(s)', moved;
  ELSE
    RAISE NOTICE 'rhautt_nexus.products absent — skip 017';
  END IF;
END $$;
