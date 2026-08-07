-- 073 · GEO 内容资产记录所用策略（AgenticGEO 自进化闭环的归因基础）
-- 生成内容时记下用了哪些 GEO 策略（statistics/cite-sources/…）；
-- 当该内容被第 7 层实验复投出 lift 后，即可归因"哪些策略真的提升了出现率"，
-- 反哺 selectStrategies 的权重（哪个策略 lift 高，下次优先选）。
SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.growth_copy_asset
  ADD COLUMN IF NOT EXISTS strategy_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 已存在的表 rhautt_app 已有列级权限（071 授的是 ALL TABLES），新增列自动继承，无需额外 GRANT。
