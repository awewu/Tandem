-- 091 · 竞品情报纳入我方品牌（修口径缺陷：我方缺席自己的竞争格局）
-- 背景：ai_sov 此前只入账**竞品**被引，份额是「竞品之间的份额」，
--       却极易被误读为全量份额；且「我方与头部差距」根本算不出来（无我方口径）。
-- 设计：GEO 探测已发 geo.brand.cited（我方被引），对称入账即可补齐 universe。
--       用 is_self 标记我方行，让份额/差距/威胁评分有正确参照系。
SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.insight_competitor
  ADD COLUMN IF NOT EXISTS is_self boolean NOT NULL DEFAULT false;

-- 格局查询按 (租户,品类,维度,时间) 走，补一条覆盖索引避免全表扫
CREATE INDEX IF NOT EXISTS insight_competitor_sov_window_idx
  ON rhautt_nexus.insight_competitor (tenant_id, category, dimension, captured_at DESC);
