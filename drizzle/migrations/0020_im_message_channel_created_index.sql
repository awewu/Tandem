-- IM channel history hot path:
--   WHERE collection = 'im_messages'
--     AND data->>'channelId' = ?
--     AND data->>'createdAt' < ?
--   ORDER BY data->>'createdAt' DESC
--
-- ISO-8601 timestamps preserve chronological order as text. PostgreSQL can
-- scan this btree backwards for DESC, so one index serves initial and cursor
-- pagination without loading a channel's full history.

CREATE INDEX IF NOT EXISTS "KvStore_im_channel_created_idx"
  ON "KvStore" ((data->>'channelId'), (data->>'createdAt'))
  WHERE collection = 'im_messages';
