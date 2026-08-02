SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.wechat_official_accounts
  ADD COLUMN IF NOT EXISTS original_id varchar,
  ADD COLUMN IF NOT EXISTS connection_error_summary text;
