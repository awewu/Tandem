-- 074 · 漏斗事件记录获客渠道（北极星「GEO→高意向线索数」的诚实归因底座）
-- 旧口径把北极星近似成 lead/reach 聚合比率，触达<线索时不可解释 → null。
-- 根因：线索未按获客渠道归因。此列把每条线索的来源（lead.created/lead.captured 事件
-- payload.source）归一为渠道枚举（geo/ai-diagnosis/referral/paid/organic/manual/other），
-- 使「GEO→高意向线索数」成为真实的按渠道计数子集（GEO 集={geo,ai-diagnosis}）。
-- 见 services/api/src/modules/growth/geo-attribution.ts。
SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.growth_funnel_event
  ADD COLUMN IF NOT EXISTS channel varchar;

-- 按 (租户, 期, 阶段, 渠道) 加速北极星分渠道计数。
CREATE INDEX IF NOT EXISTS growth_funnel_event_channel_idx
  ON rhautt_nexus.growth_funnel_event (tenant_id, period, stage, channel);

-- 已存在的表 rhautt_app 已有列级权限（071 授的是 ALL TABLES），新增列自动继承，无需额外 GRANT。
