-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 020
-- 问诊会话 ↔ PIPL 同意留痕关联（W-A · 发布门级 P0）。
--
-- 背景：C 端匿名问诊采集个人信息前必须取得处理授权（PIPL 第13/14条）。
--   Legacy `pain-diagnosis.html`/`server/modules/diagnosis` 已有服务端同意闸，但目标态
--   NestJS 问诊此前无公开入口、未留痕。本迁移为目标态补上 diagnosis_sessions.consent_id，
--   指向已存在的 rhautt_nexus.pipl_consents（migration 007/002 域）记录，形成「采集即留痕」闭环。
--
-- 幂等：ADD COLUMN IF NOT EXISTS；不改既有 RLS 策略（diagnosis_sessions 已受租户 RLS 管辖）。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.diagnosis_sessions
  ADD COLUMN IF NOT EXISTS consent_id varchar;

CREATE INDEX IF NOT EXISTS diagnosis_sessions_consent_idx
  ON rhautt_nexus.diagnosis_sessions (tenant_id, consent_id);
