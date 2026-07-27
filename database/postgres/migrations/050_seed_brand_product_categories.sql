-- Rhautt Nexus - Migration 050
-- Seed brand-owned product category trees used by the marketing product console.

SET search_path TO rhautt_nexus, public;

WITH seed_roots(brand_code, code, name_cn, name_en, slug, sort_order) AS (
  VALUES
    ('everhot', 'home', '家用', 'Residential', 'home', 10),
    ('everhot', 'commercial', '商用', 'Commercial', 'commercial', 20),
    ('rheem', 'home', '家用', 'Residential', 'home', 10),
    ('rheem', 'commercial', '商用', 'Commercial', 'commercial', 20),
    ('ruud', 'home', '家用', 'Residential', 'home', 10),
    ('ruud', 'commercial', '商用', 'Commercial', 'commercial', 20)
),
inserted_roots AS (
  INSERT INTO rhautt_nexus.brand_product_categories (
    brand_code, parent_id, level, code, name_cn, name_en, slug, sort_order, status, description
  )
  SELECT brand_code, NULL::uuid, 1, code, name_cn, name_en, slug, sort_order, 'active', 'default-seed'
  FROM seed_roots
  ON CONFLICT DO NOTHING
  RETURNING id, brand_code, code
),
roots AS (
  SELECT id, brand_code, code
  FROM inserted_roots
  UNION ALL
  SELECT c.id, c.brand_code, c.code
  FROM rhautt_nexus.brand_product_categories c
  JOIN seed_roots s ON s.brand_code = c.brand_code AND s.code = c.code
  WHERE c.parent_id IS NULL AND c.deleted_at IS NULL
),
seed_children(brand_code, parent_code, code, name_cn, name_en, slug, sort_order) AS (
  VALUES
    ('everhot', 'home', 'central-air-conditioning', '家用中央空调', NULL, 'central-air-conditioning', 10),
    ('everhot', 'home', 'floor-heating', '地暖系统', NULL, 'floor-heating', 20),
    ('everhot', 'home', 'total-heat-fresh-air', '全热新风', NULL, 'total-heat-fresh-air', 30),
    ('everhot', 'commercial', 'hot-water-system', '热水系统', NULL, 'hot-water-system', 10),
    ('everhot', 'commercial', 'gas-condensing-wall-hung-boiler', '燃气冷凝壁挂炉', NULL, 'gas-condensing-wall-hung-boiler', 20),
    ('everhot', 'commercial', 'zero-cold-water-gas-water-heater', '零冷水燃气热水器', NULL, 'zero-cold-water-gas-water-heater', 30),
    ('everhot', 'commercial', 'air-source-water-heater', '空气能热水器', NULL, 'air-source-water-heater', 40),
    ('everhot', 'commercial', 'storage-gas-water-heater', '容积式燃气热水器', NULL, 'storage-gas-water-heater', 50),
    ('everhot', 'commercial', 'electric-water-heater', '电热水器', NULL, 'electric-water-heater', 60),
    ('everhot', 'commercial', 'heating-hot-water-combi', '采暖热水两联供', NULL, 'heating-hot-water-combi', 70),
    ('rheem', 'home', 'central-hot-water', '中央热水系统', NULL, 'central-hot-water', 10),
    ('rheem', 'home', 'floor-heating-manifold', '地暖分集水器系统', NULL, 'floor-heating-manifold', 20),
    ('rheem', 'home', 'total-heat-fresh-air', '全热交换新风机', NULL, 'total-heat-fresh-air', 30),
    ('rheem', 'home', 'econet-control', 'Econet 智控系统', NULL, 'econet-control', 40),
    ('rheem', 'commercial', 'commercial-hot-water', '商用热水系统', NULL, 'commercial-hot-water', 10),
    ('rheem', 'commercial', 'commercial-heat-pump', '商用热泵系统', NULL, 'commercial-heat-pump', 20),
    ('ruud', 'home', 'central-air-conditioning', '中央空调系统', NULL, 'central-air-conditioning', 10),
    ('ruud', 'home', 'hot-water-system', '热水系统', NULL, 'hot-water-system', 20),
    ('ruud', 'commercial', 'commercial-air-conditioning', '商用中央空调', NULL, 'commercial-air-conditioning', 10),
    ('ruud', 'commercial', 'commercial-hot-water', '商用热水系统', NULL, 'commercial-hot-water', 20)
)
INSERT INTO rhautt_nexus.brand_product_categories (
  brand_code, parent_id, level, code, name_cn, name_en, slug, sort_order, status, description
)
SELECT s.brand_code, r.id, 2, s.code, s.name_cn, s.name_en, s.slug, s.sort_order, 'active', 'default-seed'
FROM seed_children s
JOIN roots r ON r.brand_code = s.brand_code AND r.code = s.parent_code
ON CONFLICT DO NOTHING;
