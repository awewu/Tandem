/**
 * IM · Tandem 内置消息层
 *
 * 设计目标 (优于 WeCom):
 *   - 每条消息可一键转议事室 / 转 Memory 升级 / 转决议
 *   - @Persona: 调用员工 AI 分身回复 (Persona-aware)
 *   - 消息语义化: mention 分 "指派/咨询/通知" 三类
 *   - 全文搜索 + RAG embedding (复用 Memory 体系)
 *
 * 数据模型借鉴 Rocket.Chat / Mattermost:
 *   - Channel + Message + Membership 三张表
 *   - Channel.type 区分 group / dm / announcement
 *   - Message 支持 thread (parentId), reply, mentions, attachments
 */

/**
 * Q2 (2026-05-10): 7 种群型, 体系 + 部门工作群是 V1 GA 必需.
 *   dm           1:1 私聊
 *   group        通用多人群 (任意拉)
 *   announcement 全员/部门公告 (只读)
 *   department   部门工作群 (按 Department 自动建)            ★
 *   team         团队工作群 (Department parentId != null)     ★
 *   project      项目临时群 (可设结束日期, 到期归档)            ★
 *   cross_dept   跨部门协同群 (双方 leader 都签才能建)         ★
 */
export type ImChannelType =
  | 'dm'
  | 'group'
  | 'announcement'
  | 'department'
  | 'team'
  | 'project'
  | 'cross_dept';

export type ImChannelVisibility = 'public' | 'private';

export interface ImChannel {
  id: string;
  /** 多租户隔离 (默认 'default') */
  tenantId?: string;
  type: ImChannelType;
  /** 频道名 (group/announcement); dm 留空, 客户端按对方姓名渲染 */
  name: string;
  /** 简介 (可选, 仅 group/announcement) */
  topic?: string;
  visibility: ImChannelVisibility;
  /** 成员 userId 列表 */
  memberIds: string[];
  /** 创建者 (= 第一个 owner) */
  createdBy: string;

  /** Q2: 部门/团队/跨部门协同群必填的部门 ID (Department.id) */
  departmentId?: string;
  /** Q2: 系统按组织架构自动建群 (HR seed). 人工建群 = false */
  autoCreated?: boolean;
  /** Q2: 项目群结束日期, 到期 cron 自动 archive */
  projectEndsAt?: string;

  createdAt: string;
  updatedAt: string;
  /** 最后一条消息时间 (用于排序) */
  lastMessageAt?: string;
  /** 最后一条消息预览 (优化客户端列表渲染) */
  lastMessagePreview?: string;
  /** 关联的议事室 cardId (如果该频道是议事室派生出的群聊) */
  linkedDecisionCardId?: string;
  archivedAt?: string;
  /** Day 7 (2026-05-10): 群公告 (markdown, owner/admin 可编辑) */
  announcement?: string;
  /** Day 7: 公告最后编辑时间 */
  announcementUpdatedAt?: string;
  /** Day 7: 公告最后编辑人 */
  announcementUpdatedBy?: string;
  /** Day 7: 已 pinned 的消息 ID 列表 (最多 5 条) */
  pinnedMessageIds?: string[];
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export type ImMentionKind =
  | 'notify'    // 单纯通知 (默认)
  | 'assign'    // 指派任务 (进对方 todo 队列)
  | 'consult'   // 咨询 (期望对方回复)
  | 'persona';  // @对方的 AI 分身 (Persona)

export interface ImMention {
  userId: string;
  /** 起止字符 offset (用于客户端渲染高亮) */
  start: number;
  end: number;
  kind: ImMentionKind;
}

export interface ImAttachment {
  /** 类型: file / image / link / decisionCard / memory */
  kind: 'file' | 'image' | 'link' | 'decision_card' | 'memory';
  url?: string;
  name?: string;
  size?: number;
  /** 引用 Tandem 内部对象 (decision_card / memory) */
  refId?: string;
  /** 摘要预览 */
  preview?: string;
}

export interface ImMessage {
  id: string;
  channelId: string;
  senderId: string;
  /** 'system' = 系统消息 (议事室结果 push 回群等); 'persona' = AI 分身回复 */
  senderKind: 'user' | 'system' | 'persona';
  /** 文本内容 (markdown) */
  body: string;
  /** parsed mentions */
  mentions: ImMention[];
  /** 线程: 回复某条消息时填 */
  parentMessageId?: string;
  attachments?: ImAttachment[];
  /** 表情回应: emoji → userId[] (谁加的) */
  reactions?: Record<string, string[]>;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  /** 议事室触发记录: 如果这条消息被转成了议事室, 记录目标 cardId */
  spawnedDecisionCardId?: string;
  /** 升级到 Memory 的 promotionId */
  spawnedPromotionId?: string;
}

// ---------------------------------------------------------------------------
// Membership (per-user state in a channel)
// ---------------------------------------------------------------------------

export type ImMemberRole = 'owner' | 'admin' | 'member';

export interface ImMembership {
  /** 复合主键: `${channelId}:${userId}`, 由 storage 层维护 */
  id: string;
  channelId: string;
  userId: string;
  role: ImMemberRole;
  joinedAt: string;
  /** 上次已读消息时间 (用于计算未读数) */
  lastReadAt?: string;
  /** 缓存的未读数 (denormalized, 发消息时增量) */
  unreadCount: number;
  /** 是否静音 (不接收推送, 但仍计未读) */
  muted: boolean;
  /**
   * §T15 Agent 模式 (本频道内由分身代答):
   *   - 'manual'        默认, 真人回复, @persona 才触发分身
   *   - 'agent-confirm' 分身先生成草稿, 真人确认才发出
   *   - 'agent-auto'    分身全自动回复 (受 baseline-guard 仍可阻断)
   */
  agentMode?: 'manual' | 'agent-confirm' | 'agent-auto';
  /** 进入 agent 模式的时间, 用于审计 + 自动到期 */
  agentModeSince?: string;
  /** 自动模式的到期时间 (e.g. 会议中临时开 2h) */
  agentModeExpiresAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 解析消息文本中的 @mentions (V1 简化: @[name](userId) 语法) */
export function parseMentions(body: string): ImMention[] {
  const mentions: ImMention[] = [];
  // 匹配 @[显示名](userId) 或 @[显示名](userId:kind)
  const re = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const ref = m[2];
    const [userId, kind] = ref.split(':');
    mentions.push({
      userId,
      start: m.index,
      end: m.index + m[0].length,
      kind: (kind as ImMentionKind) ?? 'notify',
    });
  }
  return mentions;
}

/** 提取消息预览 (列表渲染用, 去除 markdown 和 mention 语法) */
export function extractPreview(body: string, max = 60): string {
  const stripped = body
    .replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > max ? stripped.slice(0, max) + '…' : stripped;
}

/** 频道 + 用户 → membership 复合 key */
export function membershipKey(channelId: string, userId: string): string {
  return `${channelId}:${userId}`;
}
