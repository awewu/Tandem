SET search_path TO rhautt_nexus, public;

INSERT INTO rhautt_nexus.rbac_permissions (code, name, domain, action, description, sort_order) VALUES
  ('product.catalog.view', '查看产品库页面', 'product.catalog', 'view', '允许打开产品库页面。', 90),
  ('product.catalog.read', '查看产品列表', 'product.catalog', 'read', '允许查看产品库列表和产品详情。', 91),
  ('product.catalog.create', '新建产品', 'product.catalog', 'create', '允许新建产品库产品。', 92),
  ('product.catalog.update', '编辑产品', 'product.catalog', 'update', '允许编辑产品库产品。', 93),
  ('product.catalog.delete', '删除产品', 'product.catalog', 'delete', '允许删除或归档产品库产品。', 94),
  ('product.catalog.publish', '发布产品内容', 'product.catalog', 'publish', '允许发布产品内容和执行产品内容状态流转。', 95),
  ('product.content.read', '查看产品内容', 'product.content', 'read', '允许查看产品内容、关系和覆盖率。', 100),
  ('product.content.create', '新建产品内容', 'product.content', 'create', '允许新建产品内容和产品关系。', 101),
  ('product.content.update', '编辑产品内容', 'product.content', 'update', '允许编辑产品内容和产品关系。', 102),
  ('product.content.delete', '删除产品内容', 'product.content', 'delete', '允许删除产品关系或产品内容记录。', 103),
  ('brand.library.view', '查看品牌库页面', 'brand.library', 'view', '允许打开品牌库和品牌官网管理页面。', 110),
  ('brand.library.read', '查看品牌库', 'brand.library', 'read', '允许查看品牌站点、品牌分类和品牌产品挂载。', 111),
  ('brand.library.create', '新建品牌库内容', 'brand.library', 'create', '允许新建品牌站点、分类和产品挂载。', 112),
  ('brand.library.update', '编辑品牌库内容', 'brand.library', 'update', '允许编辑品牌站点、分类和产品挂载。', 113),
  ('brand.library.delete', '删除品牌库内容', 'brand.library', 'delete', '允许删除或归档品牌站点、分类和产品挂载。', 114),
  ('brand.library.publish', '发布品牌库内容', 'brand.library', 'publish', '允许发布品牌官网和产品挂载内容。', 115),
  ('brand.asset.update', '更新品牌资源', 'brand.asset', 'update', '允许上传和更新品牌 Logo 等品牌资源。', 120)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO rhautt_nexus.rbac_role_permissions (tenant_id, role_id, permission_code)
SELECT r.tenant_id, r.id, p.code
FROM rhautt_nexus.rbac_roles r
CROSS JOIN rhautt_nexus.rbac_permissions p
WHERE r.code IN ('platform_admin', 'hq_admin')
  AND p.code LIKE ANY (ARRAY['product.%', 'brand.%'])
ON CONFLICT DO NOTHING;

INSERT INTO rhautt_nexus.rbac_role_permissions (tenant_id, role_id, permission_code)
SELECT r.tenant_id, r.id, p.code
FROM rhautt_nexus.rbac_roles r
JOIN rhautt_nexus.rbac_permissions p ON p.code IN (
  'product.catalog.view',
  'product.catalog.read',
  'product.catalog.create',
  'product.catalog.update',
  'product.catalog.delete',
  'product.catalog.publish',
  'product.content.read',
  'product.content.create',
  'product.content.update',
  'product.content.delete',
  'brand.library.view',
  'brand.library.read',
  'brand.library.create',
  'brand.library.update',
  'brand.library.delete',
  'brand.library.publish',
  'brand.asset.update'
)
WHERE r.code = 'brand_admin'
ON CONFLICT DO NOTHING;
