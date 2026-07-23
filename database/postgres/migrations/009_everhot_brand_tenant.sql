-- 009: 种子 Everhot 品牌运营租户（板块一 · 品牌管理）。
-- 目的：让 Everhot 后台在 rhautt_nexus / RLS 环境下以「专属品牌运营租户」运作，
--       使 RLS 覆盖表（audit_logs / file_artifacts / outbox / 未来品牌 CRM）按此
--       租户 UUID 由 DB 层 current_tenant_id() 强隔离。
--
-- 固定 UUID（供 brand-console 的 BRAND_TENANT 与 everhot 脚本的 EVERHOT_TENANT_ID 引用）：
--   e5e40000-0000-4000-8000-000000000001
--
-- 范围与边界（重要）：
--   · products 仍是「HQ 共享目录」（varchar tenant_id + brand 过滤，非 RLS 表）。
--     本迁移【只种子租户】，不改 products 结构、不强开 products 的 FORCE RLS
--     （那会影响 rhautt/rheem/ruud 跨品牌共享，需平台级评审）。
--   · 将现有 brand='everhot' 产品行「归属」到该租户 UUID，是一次性数据激活步骤，
--     须与「brand-console/脚本 tenant env 同步切到该 UUID」成对执行——见集成文档
--     §7 激活清单。为避免自动迁移与运行时 env 脱钩导致公开产品流为空，
--     该 repoint 默认【注释关闭】，由 ops 显式开启。
--
-- 幂等：租户按 code 存在性判断，可重复应用。

DO $$
DECLARE
  everhot_tenant CONSTANT uuid := 'e5e40000-0000-4000-8000-000000000001';
BEGIN
  -- 仅当 rhautt_nexus.tenants 存在（RLS 底座已建）才种子；public 工作副本环境跳过。
  IF to_regclass('rhautt_nexus.tenants') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM rhautt_nexus.tenants WHERE id = everhot_tenant OR code = 'everhot'
    ) THEN
      INSERT INTO rhautt_nexus.tenants (id, code, name, tenant_type, status, settings)
      VALUES (
        everhot_tenant,
        'everhot',
        'Everhot 恒热 · 品牌运营',
        'hq',
        'active',
        '{"brand":"everhot","module":"section1-brand-ops","site":"everhot.com.cn"}'::jsonb
      );
      RAISE NOTICE 'Seeded Everhot brand-operations tenant %', everhot_tenant;
    ELSE
      RAISE NOTICE 'Everhot tenant already present, skipping seed';
    END IF;

    -- ── 一次性数据激活（默认关闭）──────────────────────────────────────────
    -- 开启前置条件：brand-console BRAND_TENANT 与 everhot 脚本 EVERHOT_TENANT_ID
    -- 均已设为上面的 UUID，且站点公开只读端点使用同一租户。否则勿开启。
    -- IF to_regclass('rhautt_nexus.products') IS NOT NULL THEN
    --   UPDATE rhautt_nexus.products
    --      SET tenant_id = everhot_tenant::text
    --    WHERE brand = 'everhot' AND tenant_id <> everhot_tenant::text;
    -- END IF;
  ELSE
    RAISE NOTICE 'rhautt_nexus.tenants absent (public working copy) — skip Everhot tenant seed';
  END IF;
END $$;
