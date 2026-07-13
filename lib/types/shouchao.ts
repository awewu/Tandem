/**
 * 搭子手抄 (Shouchao) · AI 笔记类型
 *
 * 精简内核 MVP: 文字/Markdown 笔记 + 链接剪藏 + AI 总结/润色/标签 + 列表搜索.
 * 独立模块, 复用 Tandem LLM router 与 Memory 沉淀通道, 可后续抽离为独立 app.
 *
 * 存储: KvStore collection='shouchao_notes' (无迁移, 幂等), 见 lib/storage/*.
 */

export interface ShouchaoNote {
  id: string;
  /** 笔记归属用户 (隔离: 每人只见自己的) */
  ownerId: string;
  tenantId: string;
  title: string;
  /** 正文 (Markdown) */
  content: string;
  /** 标签 (AI 可生成, 用户可改) */
  tags: string[];
  /**
   * 所属知识库/主题 (对标 Get笔记 知识库分组). 空 = 未分组.
   * 按 ownerId 归属; 删除知识库时会清空其下笔记的 notebookId (回到未分组).
   */
  notebookId?: string;
  /** 剪藏来源链接 (网页/文章剪藏时填) */
  sourceUrl?: string;
  /** AI 一键总结结果 */
  summary?: string;
  pinned?: boolean;
  archived?: boolean;
  /**
   * 软删墓碑. 设置后该笔记在 UI/列表不可见, 但保留供多设备增量同步传播删除.
   * (云端同步: 客户端按 updatedAt 拉变更, deletedAt 让"删除"也能同步出去)
   */
  deletedAt?: string;
  /**
   * 员工本人闸门 (默认 false=关). 仅当本人在该笔记显式开启时, 笔记内容才被授权
   * 喂给【本人的】工作分身 (牛马搭子). 可随时关 / 撤回. 公司无入口、绝不进公司 Memory/OKR.
   */
  sharedToPersona?: boolean;
  /**
   * 分身编队 · 方案丙 (B-037 M4): 定向喂养。
   * 空 / 未设 = 喂全队 (主分身 + 所有技能分身); 有值 = 只喂列出的技能分身 id。
   * 仅当 sharedToPersona=true 生效; 关闭授权时清空。
   */
  sharedToPersonaIds?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 知识库/主题 (对标 Get笔记 知识库). 个人资产, 按 ownerId 隔离.
 * 一条笔记至多归属一个知识库 (ShouchaoNote.notebookId); 未分组 = notebookId 空.
 * 存储: KvStore collection='shouchao_notebooks' (无迁移, 幂等).
 */
export interface ShouchaoNotebook {
  id: string;
  ownerId: string;
  tenantId: string;
  name: string;
  /** 可选 emoji 图标, 便于快速辨识 (如 "📚") */
  icon?: string;
  /** 软删墓碑 (与笔记同构, 供多设备同步传播删除) */
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI 加工动作.
 * 基础三件 (改写笔记本身): summarize (摘要) / polish (润色) / tags (标签)
 * 创作三件 (对标 Get笔记「点评/拷问/发芽」, 产出洞察不改原文):
 *   review    点评 — 从记录里挑出亮点, 指出哪里做得好
 *   challenge 拷问 — 像诤友一样指出表达/逻辑的漏洞与反问
 *   sprout    发芽 — 以这条记录为种子, 长出跨领域的新认知与关联
 */
export type ShouchaoAiAction =
  | 'summarize'
  | 'polish'
  | 'tags'
  | 'review'
  | 'challenge'
  | 'sprout';

/** 产出洞察 (不改原文) 的创作类动作 */
export const SHOUCHAO_INSIGHT_ACTIONS = ['review', 'challenge', 'sprout'] as const;
