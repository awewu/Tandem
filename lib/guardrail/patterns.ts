/**
 * Guardrail 模式库 (Phase 3 · 可信护栏)
 *
 * 三类通用内容风险检测规则 (与业务无关, 补 baseline-guard/宪法A 之外的通用防护空白):
 *   1. PII       — 个人敏感信息 (手机/身份证/银行卡/邮箱), 用于输出脱敏
 *   2. jailbreak — 用户输入里试图突破系统约束的越狱话术
 *   3. injection — 工具/检索内容 (手抄/邮件/网页/MCP) 里夹带的间接提示注入
 *
 * 设计原则:
 *   - 纯正则 + 零依赖, 确定性可测; 不调 LLM (LLM 判定留给可选二级)。
 *   - 每条规则带 severity (low/medium/high) 与 category, 供 verdict 聚合。
 *   - 中英双语覆盖 (企业内网多为中文, 外部输入可能英文)。
 */

export type GuardrailCategory = 'pii' | 'jailbreak' | 'injection';
export type GuardrailSeverity = 'low' | 'medium' | 'high';

export interface GuardrailRule {
  id: string;
  category: GuardrailCategory;
  severity: GuardrailSeverity;
  pattern: RegExp;
  /** PII 类专用: 命中片段的脱敏替换标签 */
  redactLabel?: string;
}

// ─────────────────────────────────────────────────────────────
// PII — 用于输出脱敏 (redactLabel 存在即参与 redact)
// ─────────────────────────────────────────────────────────────
export const PII_RULES: GuardrailRule[] = [
  {
    id: 'pii.cn_id_card',
    category: 'pii',
    severity: 'high',
    // 18 位身份证 (17 位数字 + 校验位 0-9/X)
    pattern: /\b\d{17}[\dXx]\b/g,
    redactLabel: '[已脱敏:身份证]',
  },
  {
    id: 'pii.bank_card',
    category: 'pii',
    severity: 'high',
    // 银行卡 16-19 位连续数字 (排除已被身份证规则覆盖的 18 位由顺序保证)
    pattern: /\b\d{16,19}\b/g,
    redactLabel: '[已脱敏:银行卡]',
  },
  {
    id: 'pii.cn_mobile',
    category: 'pii',
    severity: 'medium',
    // 中国大陆手机号 1[3-9] + 9 位
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    redactLabel: '[已脱敏:手机号]',
  },
  {
    id: 'pii.email',
    category: 'pii',
    severity: 'low',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    redactLabel: '[已脱敏:邮箱]',
  },
];

// ─────────────────────────────────────────────────────────────
// jailbreak — 扫用户输入
// ─────────────────────────────────────────────────────────────
export const JAILBREAK_RULES: GuardrailRule[] = [
  {
    id: 'jb.ignore_instructions_cn',
    category: 'jailbreak',
    severity: 'high',
    pattern: /(忽略|无视|忘记|放弃)(掉)?(之前|上述|前面|所有|以上|先前)?.{0,6}(指令|规则|设定|提示|约束|限制)/g,
  },
  {
    id: 'jb.ignore_instructions_en',
    category: 'jailbreak',
    severity: 'high',
    pattern: /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)/gi,
  },
  {
    id: 'jb.role_override',
    category: 'jailbreak',
    severity: 'high',
    pattern: /(you\s+are\s+now|from\s+now\s+on\s+you|现在你(是|将))\b/gi,
  },
  {
    id: 'jb.dev_mode',
    category: 'jailbreak',
    severity: 'medium',
    pattern: /(开发者模式|developer\s+mode|\bDAN\b|越狱模式|jailbreak|不受限制模式|no\s+restrictions?)/gi,
  },
  {
    id: 'jb.reveal_system_prompt',
    category: 'jailbreak',
    severity: 'medium',
    pattern: /(把|输出|显示|打印|repeat|reveal|print|show)\s*(你的)?(system\s*prompt|系统提示词?|系统指令|原始指令)/gi,
  },
];

// ─────────────────────────────────────────────────────────────
// injection — 扫工具/检索返回内容 (不可信数据源)
// ─────────────────────────────────────────────────────────────
export const INJECTION_RULES: GuardrailRule[] = [
  {
    id: 'inj.ignore_instructions',
    category: 'injection',
    severity: 'high',
    pattern: /(忽略|无视|忘记)(之前|上述|前面|所有|以上)?.{0,6}(指令|规则|提示|约束)|ignore\s+(previous|above|all)\s+(instructions?|rules?)/gi,
  },
  {
    id: 'inj.role_marker',
    category: 'injection',
    severity: 'high',
    // 数据里夹带对话角色标记, 试图伪造 system/assistant 轮
    pattern: /(^|\n)\s*(system|assistant|用户|系统|助手)\s*[:：]/gi,
  },
  {
    id: 'inj.tag_injection',
    category: 'injection',
    severity: 'high',
    pattern: /<\/?\s*(system|instructions?|prompt)\s*>/gi,
  },
  {
    id: 'inj.exfiltration',
    category: 'injection',
    severity: 'high',
    // 诱导外泄/转发数据
    pattern: /(把|将)?.{0,16}(发送|发给|转发|上传|导出|泄露|外发)(给|到|至)?.{0,16}(邮箱|http|外部|url|地址)|send\s+.{0,20}\s+to\s+(http|https|the\s+following)/gi,
  },
  {
    id: 'inj.override_note',
    category: 'injection',
    severity: 'medium',
    pattern: /(以上内容作废|之前的都不算|new\s+instructions?\s*[:：]|重要指令[:：]|真正的任务是)/gi,
  },
];

export const ALL_RULES: GuardrailRule[] = [
  ...PII_RULES,
  ...JAILBREAK_RULES,
  ...INJECTION_RULES,
];
