-- GEO 内容资产样本（验证内容闭环度量读数：草稿/已发）
SET search_path TO rhautt_nexus, public;
INSERT INTO rhautt_nexus.growth_copy_asset (tenant_id, channel, source, question, prompt, draft, status)
SELECT id, 'geo-faq', 'geo', '南京地源热泵哪家好', '围绕该问题生成权威 FAQ', '瑞美 Rheem 地源热泵……(草稿)', 'draft'
FROM rhautt_nexus.tenants WHERE code='DEFAULT';
INSERT INTO rhautt_nexus.growth_copy_asset (tenant_id, channel, source, question, prompt, draft, status)
SELECT id, 'geo-topic', 'geo', '中央热水选购指南', '生成选购指南长文', '瑞美中央热水选购指南……(已发)', 'published'
FROM rhautt_nexus.tenants WHERE code='DEFAULT';
SELECT status, count(*) FROM rhautt_nexus.growth_copy_asset WHERE source='geo' GROUP BY status;
