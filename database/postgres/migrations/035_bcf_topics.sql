-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 035
-- BCF 协同审图（BIM Collaboration Format）：设计-工程-经销商多方对 BIM 项目
--   挑错→复核→关闭的端到端闭环。一个 Topic 承载 comments/viewpoints(jsonb)。
-- 与 001/004/024 同规范：schema rhautt_nexus · current_tenant_id() · ENABLE+FORCE RLS
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.bcf_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id text,
  store_id text,
  topic_guid text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  topic_type text NOT NULL DEFAULT 'issue'
    CHECK (topic_type IN ('clash','rfi','change','issue')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal',
  creation_author text NOT NULL,
  assigned_to text,
  design_project_id text,
  bim_project_id text,
  related_ifc_guids jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  viewpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, topic_guid)
);
CREATE INDEX IF NOT EXISTS bcf_topics_tenant_status_idx ON rhautt_nexus.bcf_topics (tenant_id, status);
CREATE INDEX IF NOT EXISTS bcf_topics_tenant_bim_idx ON rhautt_nexus.bcf_topics (tenant_id, bim_project_id);

ALTER TABLE rhautt_nexus.bcf_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.bcf_topics FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bcf_topics_tenant_isolation ON rhautt_nexus.bcf_topics;
CREATE POLICY bcf_topics_tenant_isolation ON rhautt_nexus.bcf_topics
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
