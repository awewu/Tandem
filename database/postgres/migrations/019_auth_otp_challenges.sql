-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 019
-- 短信 OTP 挑战持久化 —— 替换 legacy 内存 Map + 移除 000000 后门后的真实 OTP 存储。
--
-- 预认证基础设施：按 phone_hash（PIPL 检索哈希，非明文）索引，无 tenant 绑定、无 RLS
--   （与 auth 预认证按 phone_hash 跨租户查找同规范）。code 仅存 bcrypt 哈希，永不存明文。
--   短生命周期（默认 5 分钟）+ 尝试次数限制 + 一次性消费。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.auth_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'login',
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_otp_challenges_phone_idx
  ON rhautt_nexus.auth_otp_challenges (phone_hash, created_at DESC);
