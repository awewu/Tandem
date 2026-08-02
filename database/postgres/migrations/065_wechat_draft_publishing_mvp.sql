SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.wechat_official_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_id varchar NOT NULL,
  display_name varchar NOT NULL,
  app_id varchar NOT NULL,
  app_secret_ciphertext text NOT NULL,
  status varchar NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled')),
  connection_status varchar NOT NULL DEFAULT 'untested'
    CHECK (connection_status IN ('untested', 'normal', 'credential_error', 'permission_error', 'ip_whitelist_error', 'temporary_error')),
  last_tested_at timestamptz,
  last_successful_sync_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, app_id)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.wechat_content_review_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  source_content_id varchar NOT NULL,
  version_no int NOT NULL,
  review_status varchar NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('editing', 'pending_review', 'changes_requested', 'approved', 'voided')),
  wechat_payload jsonb NOT NULL,
  review_content_hash varchar NOT NULL,
  wechat_payload_hash varchar NOT NULL,
  asset_snapshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_snapshot jsonb NOT NULL,
  submitter_id uuid NOT NULL,
  reviewer_id uuid,
  review_comment text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_content_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS wechat_review_one_pending_idx
  ON rhautt_nexus.wechat_content_review_versions (tenant_id, source_content_id)
  WHERE review_status = 'pending_review';

CREATE TABLE IF NOT EXISTS rhautt_nexus.wechat_draft_sync_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  review_version_id uuid NOT NULL REFERENCES rhautt_nexus.wechat_content_review_versions(id),
  account_id uuid NOT NULL REFERENCES rhautt_nexus.wechat_official_accounts(id),
  idempotency_key varchar NOT NULL UNIQUE,
  sync_status varchar NOT NULL DEFAULT 'queued'
    CHECK (sync_status IN ('not_started', 'queued', 'syncing', 'succeeded', 'failed', 'unconfirmed', 'superseded')),
  attempts int NOT NULL DEFAULT 0,
  wechat_draft_id varchar,
  material_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_type varchar,
  error_summary text,
  trace_id varchar,
  manual_handler_id uuid,
  manual_handled_at timestamptz,
  manual_note text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, review_version_id)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.wechat_publish_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  actor_id uuid,
  event_type varchar NOT NULL,
  object_type varchar NOT NULL,
  object_id uuid NOT NULL,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wechat_accounts_tenant_brand_idx
  ON rhautt_nexus.wechat_official_accounts (tenant_id, brand_id);
CREATE INDEX IF NOT EXISTS wechat_reviews_tenant_status_idx
  ON rhautt_nexus.wechat_content_review_versions (tenant_id, review_status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS wechat_tasks_tenant_status_idx
  ON rhautt_nexus.wechat_draft_sync_tasks (tenant_id, sync_status, created_at);
CREATE INDEX IF NOT EXISTS wechat_audit_object_idx
  ON rhautt_nexus.wechat_publish_audit_events (tenant_id, object_type, object_id, created_at DESC);

ALTER TABLE rhautt_nexus.wechat_official_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.wechat_content_review_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.wechat_draft_sync_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.wechat_publish_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wechat_accounts_tenant_isolation ON rhautt_nexus.wechat_official_accounts;
CREATE POLICY wechat_accounts_tenant_isolation ON rhautt_nexus.wechat_official_accounts
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS wechat_reviews_tenant_isolation ON rhautt_nexus.wechat_content_review_versions;
CREATE POLICY wechat_reviews_tenant_isolation ON rhautt_nexus.wechat_content_review_versions
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS wechat_tasks_tenant_isolation ON rhautt_nexus.wechat_draft_sync_tasks;
CREATE POLICY wechat_tasks_tenant_isolation ON rhautt_nexus.wechat_draft_sync_tasks
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS wechat_audit_tenant_isolation ON rhautt_nexus.wechat_publish_audit_events;
CREATE POLICY wechat_audit_tenant_isolation ON rhautt_nexus.wechat_publish_audit_events
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

-- MVP service methods also apply explicit tenant_id predicates. FORCE RLS can be
-- enabled after the module is moved fully onto withRlsTransaction-managed access.

INSERT INTO rhautt_nexus.rbac_permissions (code, name, domain, action, description, sort_order) VALUES
  ('marketing.wechat_accounts.view', '查看公众号配置', 'marketing.wechat_accounts', 'view', '允许查看微信公众号发布账号配置。', 90),
  ('marketing.wechat_accounts.manage', '管理公众号配置', 'marketing.wechat_accounts', 'manage', '允许新增、启停、测试和更新微信公众号配置。', 91),
  ('marketing.content.submit_review', '提交内容审核', 'marketing.content', 'submit_review', '允许提交微信公众号渠道稿审核。', 92),
  ('marketing.content.review', '审核内容', 'marketing.content', 'review', '允许审核微信公众号渠道稿。', 93),
  ('marketing.content.void', '作废内容审核', 'marketing.content', 'void', '允许作废微信公众号渠道稿审核版本。', 94),
  ('marketing.wechat_drafts.view', '查看草稿同步', 'marketing.wechat_drafts', 'view', '允许查看微信公众号草稿同步记录。', 95),
  ('marketing.wechat_drafts.note', '记录草稿处理备注', 'marketing.wechat_drafts', 'note', '允许为失败或结果不确定的草稿同步任务记录人工处理备注。', 96)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO rhautt_nexus.rbac_role_permissions (tenant_id, role_id, permission_code)
SELECT r.tenant_id, r.id, p.code
FROM rhautt_nexus.rbac_roles r
JOIN rhautt_nexus.rbac_permissions p ON p.code IN (
  'marketing.wechat_accounts.view',
  'marketing.wechat_accounts.manage',
  'marketing.content.submit_review',
  'marketing.content.review',
  'marketing.content.void',
  'marketing.wechat_drafts.view',
  'marketing.wechat_drafts.note'
)
WHERE r.code IN ('platform_admin', 'hq_admin', 'brand_ops', 'hq_marketing')
ON CONFLICT DO NOTHING;
