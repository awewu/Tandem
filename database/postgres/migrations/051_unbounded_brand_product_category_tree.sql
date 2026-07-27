-- Rhautt Nexus - Migration 051
-- Lift brand product category trees from fixed three-level menus to unbounded trees.

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.brand_product_categories
  DROP CONSTRAINT IF EXISTS brand_product_categories_level_check;

ALTER TABLE rhautt_nexus.brand_product_categories
  ADD CONSTRAINT brand_product_categories_level_positive_check
  CHECK (level >= 1);

DROP INDEX IF EXISTS rhautt_nexus.brand_product_categories_tree_idx;

CREATE INDEX IF NOT EXISTS brand_product_categories_tree_idx
  ON rhautt_nexus.brand_product_categories (brand_code, parent_id, sort_order, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_primary_category_idx
  ON rhautt_nexus.products (
    COALESCE(NULLIF(meta -> brand ->> 'primaryCategoryId', ''), NULLIF(meta ->> 'primaryCategoryId', ''))
  )
  WHERE status <> 'archived';
