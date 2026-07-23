-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 022
-- D2 L7 营销供给层 · 发布工作流（P1）：状态机 draft→review→scheduled→published + 审计流转。
--
-- 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §10.5（P1 发布工作流）。
-- 背景：021 建 product_content 时 status 仅 draft/published。P1 引入治理工作流：
--   draft →(submit)→ review →(approve)→ published | →(schedule)→ scheduled →(due)→ published
--   review →(reject)→ draft；published →(unpublish)→ draft。
--   只有 published 且 published_at<=now 进公开只读供给（L5）；scheduled 不对外。
--   每次流转写 product_content_events（谁/从何态/到何态/时刻/备注），跟随租户 FORCE RLS。
--
-- 幂等：放宽 CHECK 约束（DROP+ADD）+ ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

DO $$
BEGIN
  IF to_regclass('rhautt_nexus.product_content') IS NULL THEN
    RAISE NOTICE 'rhautt_nexus.product_content absent — skip 021';
    RETURN;
  END IF;

  -- 放宽 status 受控集：draft / review / scheduled / published。
  ALTER TABLE rhautt_nexus.product_content
    DROP CONSTRAINT IF EXISTS product_content_status_check;
  ALTER TABLE rhautt_nexus.product_content
    ADD CONSTRAINT product_content_status_check
    CHECK (status IN ('draft', 'review', 'scheduled', 'published'));

  -- 工作流列：定时发布时刻 + 审核痕迹。
  ALTER TABLE rhautt_nexus.product_content
    ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
  ALTER TABLE rhautt_nexus.product_content
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
  ALTER TABLE rhautt_nexus.product_content
    ADD COLUMN IF NOT EXISTS reviewed_by text;
  ALTER TABLE rhautt_nexus.product_content
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

  -- 流转审计表（跟随租户，FORCE RLS）。
  CREATE TABLE IF NOT EXISTS rhautt_nexus.product_content_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
    content_id uuid NOT NULL REFERENCES rhautt_nexus.product_content(id) ON DELETE CASCADE,
    from_status text,
    to_status text NOT NULL,
    action text NOT NULL,
    actor text,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS product_content_events_content_idx
    ON rhautt_nexus.product_content_events (content_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS product_content_scheduled_idx
    ON rhautt_nexus.product_content (status, scheduled_at);

  ALTER TABLE rhautt_nexus.product_content_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE rhautt_nexus.product_content_events FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS product_content_events_tenant_isolation ON rhautt_nexus.product_content_events;
  CREATE POLICY product_content_events_tenant_isolation ON rhautt_nexus.product_content_events
    USING (tenant_id = rhautt_nexus.current_tenant_id())
    WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

  RAISE NOTICE 'Migration 022: product_content workflow (state machine + events) ensured';
END $$;
