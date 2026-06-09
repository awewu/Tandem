/**
 * ProxyAction · 拿捏代行行为 (一等公民)
 *
 * 设计目的:
 *   - 把所有"Persona 替员工做的事"统一成一张表
 *   - 给员工一个"否决/确认"的入口 (24h 否决窗口)
 *   - 给老板一个"看分身做了什么"的审计入口
 *   - 给 bossCaptureScore / decisionHistory 提供单一数据源
 *
 * 触发场景 (kind):
 *   - meeting_proxy   : 会议代参 (lib/proxy/meeting-proxy.ts)
 *   - communication   : 风格模仿起草 (lib/persona/communication-mimicry.ts)
 *   - im_reply        : IM 自动回复 (lib/im/service.ts)
 *   - decision_draft  : 议事室代起草决议卡
 *   - email_draft     : 邮件代起草
 *   - ontology_action : 中央 AI 提议的本体写动作 (ON-2, 延迟执行: 否决窗过/确认后才真写)
 *
 * 状态机:
 *   drafted        — 已起草, 未发送 (黄区, 等员工确认或否决)
 *   awaiting_veto  — 已发送/已执行, 还在 24h 否决窗口内
 *   executed       — 否决窗口已过, 不可撤销
 *   vetoed         — 员工/老板否决, 视场景做补偿动作
 *   expired        — 起草后超时未确认 (drafted 24h 自动作废)
 *
 * §13 (员工尊严):
 *   - 红区永远不允许 ProxyAction (必须人本)
 *   - 黄区必须有 24h 否决窗口
 *   - 绿区可不等待, 但仍写 ProxyAction 留痕
 */

import type { Zone } from '../proxy/meeting-proxy';

export type ProxyActionKind =
  | 'meeting_proxy'
  | 'communication'
  | 'im_reply'
  | 'decision_draft'
  | 'email_draft'
  | 'ontology_action';

export type ProxyActionStatus =
  | 'drafted'
  | 'awaiting_veto'
  | 'executed'
  | 'vetoed'
  | 'expired';

/** 24h 默认否决窗口 (毫秒) */
export const DEFAULT_VETO_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ProxyAction {
  id: string;
  /** 被代行的员工 (动作以此人名义发出) */
  userId: string;
  /** 触发代行的 Persona */
  personaId: string;
  /** 多租户 */
  tenantId: string;

  kind: ProxyActionKind;
  zone: Zone;
  status: ProxyActionStatus;

  /** 一句话标题 (列表展示) */
  title: string;
  /** 详细输出 / 草稿正文 */
  body?: string;
  /** 关联的业务实体 (会议 ID / IM 消息 ID / DC ID 等) */
  refType?: string;
  refId?: string;

  /** 否决窗口截止时间 (drafted/awaiting_veto 状态使用) */
  vetoUntil?: string;
  /** 否决人 (员工本人 / 老板) */
  vetoedBy?: string;
  vetoedAt?: string;
  vetoReason?: string;

  /** 确认人 (跳过等待立即执行) */
  confirmedBy?: string;
  confirmedAt?: string;

  /** 执行落定时间 (vetoUntil 过期或显式 confirm 时写) */
  executedAt?: string;

  /** 任意附加元数据 (kind 各自定义) */
  metadata?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

/** 是否仍在 24h 否决窗口内 */
export function isWithinVetoWindow(action: Pick<ProxyAction, 'status' | 'vetoUntil'>): boolean {
  if (action.status !== 'awaiting_veto' && action.status !== 'drafted') return false;
  if (!action.vetoUntil) return false;
  return new Date(action.vetoUntil).getTime() > Date.now();
}

/** 是否已经走完终态 (无论成功失败) */
export function isTerminal(action: Pick<ProxyAction, 'status'>): boolean {
  return action.status === 'executed' || action.status === 'vetoed' || action.status === 'expired';
}
