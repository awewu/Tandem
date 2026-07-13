/**
 * AgentTemplate · 基础 Agent 模板 (分身编队 B-037 · M1)
 *
 * 公司资产: 员工从模板 fork 出自己的技能分身 (SkillPersona)。
 * 双轨来源 (Owner 决策 ②): 公司策展内部市场 + 引入外部公开市场智能体。
 * 外部来源 (origin='external_market') 必须经 §19 出站合规闸 + skill-gateway 审查才可 published。
 *
 * 详见 docs/PERSONA-SQUAD-ARCHITECTURE.md §3.1。
 * 存储: KvStore collection 'agent_templates' (DrizzleKvRepository, 无需物理 DDL)。
 */

/** 模板来源: 公司内部策展 / 外部公开市场引入 */
export type AgentTemplateOrigin = 'internal' | 'external_market';

/** 模板生命周期: 草稿 / 已发布(可 fork) / 归档 */
export type AgentTemplateStatus = 'draft' | 'published' | 'archived';

export interface AgentTemplate {
  id: string;
  tenantId: string;
  /** 展示名, 例: "资深财务分析师" */
  name: string;
  /** 专业域: design|pm|tech|marketing|strategy|finance|sales|hr|legal|... */
  specialty: string;
  /** 来源双轨 */
  origin: AgentTemplateOrigin;
  /** 外部市场来源标识 (origin='external_market' 时) */
  externalRef?: string;
  /** 人格与专业基线 (fork 后成为技能分身 system 基底) */
  basePrompt: string;
  /** 初始 enabledSkills (仍受 stage 门槛约束) */
  defaultSkills: string[];
  /** 关联知识/记忆检索标签 */
  defaultKnowledgeTags: string[];
  /** 生命周期 */
  status: AgentTemplateStatus;
  /** 创建人 userId */
  createdBy: string;
  /** 审查人 (外部 import 必填, 经 §19 出站 + skill-gateway 审查) */
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}
