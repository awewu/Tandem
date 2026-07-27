-- Rhautt Nexus - Migration 049
-- Brand-owned product category trees for product operations.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.brand_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_code text NOT NULL CHECK (brand_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  parent_id uuid REFERENCES rhautt_nexus.brand_product_categories(id),
  level integer NOT NULL CHECK (level BETWEEN 1 AND 3),
  code text NOT NULL CHECK (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_cn text NOT NULL,
  name_en text,
  slug text,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  description text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS brand_product_categories_code_uidx
  ON rhautt_nexus.brand_product_categories (brand_code, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(code))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS brand_product_categories_tree_idx
  ON rhautt_nexus.brand_product_categories (brand_code, parent_id, level, sort_order, created_at)
  WHERE deleted_at IS NULL;
