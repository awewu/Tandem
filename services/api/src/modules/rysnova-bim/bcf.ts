/**
 * W-BIM-2 · 2.2：BIM Collaboration Format (BCF) 子集类型。
 *
 * 参考：buildingSMART BCF-XML 3.0 / BCF-API 3.0。
 * 本模块只实现 changeProposal 所需的最小子集：Topic + Comment + Viewpoint，
 * 用于 Rysnova 工程修正向 design 真相源回流。
 */

export interface BcfTopic {
  /** BCF 主题全局唯一标识（UUID v4） */
  guid: string;
  /** 主题标题，如 "热水管路路由冲突" */
  title: string;
  /** 主题状态：open / resolved / closed */
  status: 'open' | 'resolved' | 'closed';
  /** 优先级：low / normal / high */
  priority?: 'low' | 'normal' | 'high';
  /** 类型标签：issue / clash / request / info */
  topicType?: 'issue' | 'clash' | 'request' | 'info';
  /** 描述 */
  description?: string;
  /** 创建者 */
  creationAuthor: string;
  /** 创建时间 ISO8601 */
  creationDate?: string;
  /** 修改时间 ISO8601 */
  modifiedDate?: string;
  /** 关联的 IFC 构件 GUID 列表 */
  relatedIfcGuids?: string[];
  /** 关联的图纸/文件引用 */
  documentReferences?: { documentGuid?: string; url?: string; description?: string }[];
}

export interface BcfComment {
  guid: string;
  date: string;
  author: string;
  comment: string;
  viewpointGuid?: string;
  status?: 'open' | 'resolved' | 'closed';
}

export interface BcfViewpoint {
  guid: string;
  /** 视点名称 */
  viewpoint?: string;
  /** 截图 URL（对象存储） */
  snapshotUrl?: string;
  /** 相机/视角 JSON（保留扩展） */
  camera?: Record<string, unknown>;
}

/** BCF 变更建议载荷：一个 Topic + 若干 Comment + 可选 Viewpoint */
export interface BcfChangeProposal {
  schema: 'bcf-3.0-lite';
  topic: BcfTopic;
  comments: BcfComment[];
  viewpoints?: BcfViewpoint[];
}

/** BCF-XML 3.0 最小校验 */
export function validateBcfChangeProposal(p: unknown): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!p || typeof p !== 'object') {
    errors.push('payload must be an object');
    return { ok: false, errors };
  }
  const payload = p as Partial<BcfChangeProposal>;
  if (payload.schema !== 'bcf-3.0-lite') {
    errors.push('schema must be "bcf-3.0-lite"');
  }
  if (!payload.topic) {
    errors.push('topic is required');
  } else {
    const t = payload.topic;
    if (!t.guid || typeof t.guid !== 'string') errors.push('topic.guid is required string');
    if (!t.title || typeof t.title !== 'string') errors.push('topic.title is required string');
    if (!t.creationAuthor || typeof t.creationAuthor !== 'string') errors.push('topic.creationAuthor is required string');
    if (!['open', 'resolved', 'closed'].includes(t.status)) errors.push('topic.status must be open/resolved/closed');
  }
  if (!Array.isArray(payload.comments)) {
    errors.push('comments must be an array');
  } else {
    payload.comments.forEach((c, i) => {
      if (!c.guid || typeof c.guid !== 'string') errors.push(`comments[${i}].guid is required string`);
      if (!c.author || typeof c.author !== 'string') errors.push(`comments[${i}].author is required string`);
      if (!c.comment || typeof c.comment !== 'string') errors.push(`comments[${i}].comment is required string`);
      if (!c.date || typeof c.date !== 'string') errors.push(`comments[${i}].date is required string`);
    });
  }
  if (payload.viewpoints) {
    if (!Array.isArray(payload.viewpoints)) {
      errors.push('viewpoints must be an array');
    } else {
      payload.viewpoints.forEach((v, i) => {
        if (!v.guid || typeof v.guid !== 'string') errors.push(`viewpoints[${i}].guid is required string`);
      });
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
