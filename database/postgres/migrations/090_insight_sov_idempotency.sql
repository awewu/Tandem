-- 090 · 竞品 AI SoV 自动入账幂等（修真问题：至少一次投递导致重复计数）
-- 背景：growth GEO 探测命中竞品 → 事件 geo.competitor.cited → insight 落 ai_sov 计数点。
--       事件总线是 at-least-once，重投递会把同一次探测重复计入，绝对量级被虚增。
-- 设计：自动入账行以 source='geo-probe:<probeId>' 标注来源，
--       对「自动口径」加唯一索引 (tenant_id, category, competitor, source)，写入走 ON CONFLICT DO NOTHING。
--       仅约束 geo-probe: 前缀的系统态行；手工录入台账（source 为空或其它来源）不受影响，可重复记录。
SET search_path TO rhautt_nexus, public;

-- 先清理历史重复（同租户/品类/竞品/来源只保留最早一条），否则唯一索引建不上
DELETE FROM rhautt_nexus.insight_competitor a
 USING rhautt_nexus.insight_competitor b
 WHERE a.dimension = 'ai_sov'
   AND b.dimension = 'ai_sov'
   AND a.source LIKE 'geo-probe:%'
   AND b.source LIKE 'geo-probe:%'
   AND a.tenant_id = b.tenant_id
   AND a.category = b.category
   AND a.competitor = b.competitor
   AND a.source = b.source
   AND (a.captured_at, a.id) > (b.captured_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS insight_competitor_ai_sov_probe_uniq
  ON rhautt_nexus.insight_competitor (tenant_id, category, competitor, source)
  WHERE dimension = 'ai_sov' AND source LIKE 'geo-probe:%';
