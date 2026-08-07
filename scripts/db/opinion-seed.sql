-- 舆情样本（品牌健康度正声量占比验证）
SET search_path TO rhautt_nexus, public;
INSERT INTO rhautt_nexus.growth_opinion_mention (tenant_id, source, content, sentiment, intent, severity)
SELECT id, 'xiaohongshu', '瑞美中央热水安装体验很好，很满意', 'positive', 'general', 'P3' FROM rhautt_nexus.tenants WHERE code='DEFAULT';
INSERT INTO rhautt_nexus.growth_opinion_mention (tenant_id, source, content, sentiment, intent, severity)
SELECT id, 'zhihu', '对比了几个品牌的暖通方案', 'neutral', 'compare', 'P3' FROM rhautt_nexus.tenants WHERE code='DEFAULT';
SELECT sentiment, count(*) FROM rhautt_nexus.growth_opinion_mention GROUP BY sentiment;
