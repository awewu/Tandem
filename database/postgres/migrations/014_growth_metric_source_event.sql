-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 014
-- E4 营销自动化 · lead.captured 归因幂等（消费侧 inbox 键）
--
-- 事实源：docs/BOARD-3-NEXUS-GROWTH-BLUEPRINT.md §2（真实归因，非虚荣指标）。
-- 背景：事件总线为「至少一次」投递（EventBus.dispatchPending 重试 / Temporal 按租户
--   重驱）。GrowthCampaignService.attributeCapturedLead 此前对每次投递都插入一行
--   {leads:1, period:'realtime'} → 同一 lead.captured 事件被重投时【重复计数 leads】。
--
-- 修复：为 realtime 归因行补 source_event_id（= outbox 事件 id）作幂等键，并建
--   【部分唯一索引】(tenant_id, source_event_id) WHERE source_event_id IS NOT NULL，
--   使同一事件的二次归因在 DB 层被去重（唯一冲突 → 消费侧当已处理跳过）。
--   人工 recordMetric 行 source_event_id = NULL，不受约束（部分索引排除）。
--
-- 范围：additive、nullable、幂等（ADD COLUMN / CREATE UNIQUE INDEX IF NOT EXISTS）。
--   不改 RLS、不回填既有行。
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('rhautt_nexus.growth_campaign_metric') IS NOT NULL THEN
    ALTER TABLE rhautt_nexus.growth_campaign_metric
      ADD COLUMN IF NOT EXISTS source_event_id uuid;

    -- realtime 归因幂等：同租户同源事件只计一次；人工行（NULL）不约束。
    CREATE UNIQUE INDEX IF NOT EXISTS growth_metric_source_event_uq
      ON rhautt_nexus.growth_campaign_metric (tenant_id, source_event_id)
      WHERE source_event_id IS NOT NULL;

    RAISE NOTICE 'Migration 014: growth_campaign_metric.source_event_id + partial unique index ensured';
  ELSE
    RAISE NOTICE 'rhautt_nexus.growth_campaign_metric absent — skip 014';
  END IF;
END $$;
