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
  createdAt: string;
  updatedAt: string;
}

/** AI 加工动作 */
export type ShouchaoAiAction = 'summarize' | 'polish' | 'tags';
