-- Migration 0019: IM 消息正文 trigram 索引
--
-- 目的:
--   加速 `data->>'body' ILIKE '%关键词%'` 这类正文子串搜索。
--   这是 IM 聊天记录搜索的主瓶颈之一，尤其数据量上来后。
--
-- 说明:
--   1) pg_trgm 支持 ILIKE / LIKE 子串匹配。
--   2) partial index 只覆盖 im_messages，避免无关集合膨胀。

CREATE EXTENSION IF NOT EXISTS pg_trgm;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KvStore_imMessage_body_trgm_idx"
  ON "KvStore"
  USING gin ((data->>'body') gin_trgm_ops)
  WHERE collection = 'im_messages';
