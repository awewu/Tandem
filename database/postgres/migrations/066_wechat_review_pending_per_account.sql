SET search_path TO rhautt_nexus, public;

DROP INDEX IF EXISTS rhautt_nexus.wechat_review_one_pending_idx;

CREATE UNIQUE INDEX IF NOT EXISTS wechat_review_one_pending_per_account_idx
  ON rhautt_nexus.wechat_content_review_versions (
    tenant_id,
    source_content_id,
    ((target_snapshot ->> 'accountId'))
  )
  WHERE review_status = 'pending_review';
