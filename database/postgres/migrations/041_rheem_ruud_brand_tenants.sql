-- 041: Rheem / Ruud 品牌运营租户（官网产品事实库导入前置）。
--
-- 模型 B：每个品牌使用独立 UUID 门牌。Everhot 已由 009 建立，本迁移补齐
-- Rheem 与 Ruud。按 code 幂等，不迁移、不删除任何既有产品。

SET search_path TO rhautt_nexus, public;

INSERT INTO tenants (id, code, name, tenant_type, status, settings)
VALUES
  (
    '4aee0000-0000-4000-8000-000000000001',
    'rheem',
    'Rheem 瑞美 · 品牌运营',
    'hq',
    'active',
    '{"brand":"rheem","module":"section1-brand-ops","site":"rheem.com.cn"}'::jsonb
  ),
  (
    '7aad0000-0000-4000-8000-000000000001',
    'ruud',
    'Ruud 路德 · 品牌运营',
    'hq',
    'active',
    '{"brand":"ruud","module":"section1-brand-ops","site":"ruud.com.cn"}'::jsonb
  )
ON CONFLICT (code) DO NOTHING;
