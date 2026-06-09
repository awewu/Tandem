-- Migration 0007: KvStore 热集合 JSONB partial 索引 (DB-AUDIT P1 · 2026-06-09)
--
-- 配套 lib/storage/drizzle-store.ts 的 string-filter SQL 下推:
-- DrizzleKvRepository.list({ key: 'val' }) 现在会生成 `data->>'key' = 'val'`
-- 表达式; 没有相应表达式索引时仍是顺序扫描. 本迁移给最热的 KV 集合 + 最常用
-- filter 字段加 partial 索引, 把 list() 从 O(N) 降到 O(log N).
--
-- 全部 IF NOT EXISTS / 幂等, 安全重跑.

--> statement-breakpoint
-- IM 消息按频道顺序拉取 (chat 历史 / 时间线主路径)
CREATE INDEX IF NOT EXISTS "KvStore_imMessage_channelId_idx"
  ON "KvStore" (("data"->>'channelId'))
  WHERE collection = 'im_messages';

--> statement-breakpoint
-- IM 消息按发送者倒查 (mention/audit/反查)
CREATE INDEX IF NOT EXISTS "KvStore_imMessage_senderId_idx"
  ON "KvStore" (("data"->>'senderId'))
  WHERE collection = 'im_messages';

--> statement-breakpoint
-- IM 频道按类型 (dm/department/team) — 路由+seed 都按 type 过滤
CREATE INDEX IF NOT EXISTS "KvStore_imChannel_type_idx"
  ON "KvStore" (("data"->>'type'))
  WHERE collection = 'im_channels';

--> statement-breakpoint
-- IM 频道按部门 (部门频道自动联动)
CREATE INDEX IF NOT EXISTS "KvStore_imChannel_departmentId_idx"
  ON "KvStore" (("data"->>'departmentId'))
  WHERE collection = 'im_channels';

--> statement-breakpoint
-- 记忆按所有权级 (company/team/personal — baseline-guard / output-guard 全在用)
CREATE INDEX IF NOT EXISTS "KvStore_memory_ownershipLevel_idx"
  ON "KvStore" (("data"->>'ownershipLevel'))
  WHERE collection = 'memories';

--> statement-breakpoint
-- 记忆按状态 (active/archived/superseded — retriever 几乎都过滤)
CREATE INDEX IF NOT EXISTS "KvStore_memory_status_idx"
  ON "KvStore" (("data"->>'status'))
  WHERE collection = 'memories';

--> statement-breakpoint
-- 记忆按归属用户 (个人记忆召回 / reflexion 自省)
CREATE INDEX IF NOT EXISTS "KvStore_memory_userId_idx"
  ON "KvStore" (("data"->>'userId'))
  WHERE collection = 'memories';

--> statement-breakpoint
-- 记忆按类型 (sop/case/rule — retriever findRelatedSOP / findHistoricalCases)
CREATE INDEX IF NOT EXISTS "KvStore_memory_type_idx"
  ON "KvStore" (("data"->>'type'))
  WHERE collection = 'memories';

--> statement-breakpoint
-- 决策卡按所有者 (governance 看板)
CREATE INDEX IF NOT EXISTS "KvStore_decisionCard_ownerId_idx"
  ON "KvStore" (("data"->>'ownerId'))
  WHERE collection = 'decision_cards';

--> statement-breakpoint
-- 决策卡按状态 (active/closed — 列表过滤主路径)
CREATE INDEX IF NOT EXISTS "KvStore_decisionCard_status_idx"
  ON "KvStore" (("data"->>'status'))
  WHERE collection = 'decision_cards';

--> statement-breakpoint
-- IM 成员表按用户 (rendering 列表 / 通知扇出)
CREATE INDEX IF NOT EXISTS "KvStore_imMembership_userId_idx"
  ON "KvStore" (("data"->>'userId'))
  WHERE collection = 'im_memberships';

--> statement-breakpoint
-- IM 成员表按频道 (频道成员名单)
CREATE INDEX IF NOT EXISTS "KvStore_imMembership_channelId_idx"
  ON "KvStore" (("data"->>'channelId'))
  WHERE collection = 'im_memberships';
