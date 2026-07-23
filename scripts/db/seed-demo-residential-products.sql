-- seed-demo-residential-products.sql
-- 开发/演示环境：为 everhot 住宅五系统铺底「带牌价」demo 产品，
-- 让「初步选型报价（诚实版）」能用真实 listPrice 聚合出三档区间。
--
-- 诚实红线对齐（diagnosis-quote.ts）：区间只来自这些真实牌价的分布（min/median/max 求和），
--   不引入面积×魔数。价格为演示用途、非最终报价（最终以现场勘测/设计为准）。
-- 匹配口径（product-catalog.service.priceBandsForSystems）：按系统关键词命中
--   [category, name, positioning.valueProposition, positioning.painPoints, positioning.scenarios]。
-- 幂等：先按 sku 前缀清理旧 demo 行，再插入。可反复执行。
--
-- 租户：everhot 品牌运营租户（与 .env EVERHOT_TENANT_ID 一致）。

SET search_path TO rhautt_nexus, public;

\set TENANT 'e5e40000-0000-4000-8000-000000000001'

BEGIN;

DELETE FROM rhautt_nexus.products
 WHERE tenant_id = :'TENANT' AND sku LIKE 'demo-res-%';

INSERT INTO rhautt_nexus.products
  (id, tenant_id, sku, name, brand, category, spec, list_price, cost_price, currency, status, meta, positioning, asset_refs, created_at, updated_at)
VALUES
  -- 中央热水（keywords: 热水 / 中央热水）
  (gen_random_uuid(), :'TENANT', 'demo-res-hw-1', '中央热水系统·基础机组', 'everhot', '中央热水', '{}'::jsonb,  8000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-hw-2', '中央热水系统·零冷水循环', 'everhot', '中央热水', '{}'::jsonb, 15000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-hw-3', '中央热水系统·大宅高阶', 'everhot', '中央热水', '{}'::jsonb, 26000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),

  -- 采暖 / 地暖（keywords: 采暖 / 地暖 / 暖气）
  (gen_random_uuid(), :'TENANT', 'demo-res-ht-1', '地暖采暖系统·标准', 'everhot', '采暖地暖', '{}'::jsonb, 20000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-ht-2', '地暖采暖系统·舒适', 'everhot', '采暖地暖', '{}'::jsonb, 38000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-ht-3', '地暖采暖系统·大宅', 'everhot', '采暖地暖', '{}'::jsonb, 60000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),

  -- 净水 / 软水（keywords: 净水 / 软水 / 水处理 / 过滤）
  (gen_random_uuid(), :'TENANT', 'demo-res-wt-1', '全屋净水软水系统·入门', 'everhot', '净水软水水处理', '{}'::jsonb,  6000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-wt-2', '全屋净水软水系统·标准', 'everhot', '净水软水水处理', '{}'::jsonb, 12000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-wt-3', '全屋净水软水系统·高阶', 'everhot', '净水软水水处理', '{}'::jsonb, 22000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),

  -- 新风 / 除湿（keywords: 新风 / 除湿）
  (gen_random_uuid(), :'TENANT', 'demo-res-fa-1', '新风除湿系统·标准', 'everhot', '新风除湿', '{}'::jsonb, 12000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-fa-2', '新风除湿系统·舒适', 'everhot', '新风除湿', '{}'::jsonb, 22000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-fa-3', '新风除湿系统·大宅', 'everhot', '新风除湿', '{}'::jsonb, 38000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),

  -- 中央空调 / 五恒（keywords: 空调 / 全空气 / 恒温 / 五恒）
  (gen_random_uuid(), :'TENANT', 'demo-res-ac-1', '中央空调系统·标准', 'everhot', '中央空调全空气', '{}'::jsonb, 35000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-ac-2', '五恒恒温系统·舒适', 'everhot', '五恒恒温空调', '{}'::jsonb, 60000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-ac-3', '五恒恒温系统·大宅高阶', 'everhot', '五恒恒温空调', '{}'::jsonb, 95000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),

  -- 智能控制（keywords: 智能 / 智控 / 控制 / econet）
  (gen_random_uuid(), :'TENANT', 'demo-res-sc-1', '智能控制中枢·基础', 'everhot', '智能控制', '{}'::jsonb,  8000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-sc-2', '智能控制中枢·联动', 'everhot', '智能控制', '{}'::jsonb, 18000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
  (gen_random_uuid(), :'TENANT', 'demo-res-sc-3', '智能控制中枢·全屋高阶', 'everhot', '智能控制', '{}'::jsonb, 35000, 0, 'CNY', 'active', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now());

COMMIT;

SELECT category, count(*), min(list_price), max(list_price)
  FROM rhautt_nexus.products
 WHERE tenant_id = :'TENANT' AND sku LIKE 'demo-res-%'
 GROUP BY category ORDER BY category;
