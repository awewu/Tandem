/**
 * LLM Preference · 模型选择偏好
 *
 * 双层覆盖：
 *   1. 中央AI (tenant-level): 管理员设全公司各场景的默认 provider
 *   2. 个人AI (user-level): 员工覆盖自己 Persona 行为的 provider (IM 回复 / 沟通起草)
 *
 * 解析顺序: user override > tenant default > router 内置规则
 */

import type { ScenarioTag } from '../taf/provider/types';

export interface LlmPreference {
  id: string;
  /** 'tenant' = 中央AI; 'user' = 个人AI */
  scope: 'tenant' | 'user';
  /** scope='user' 时必填; scope='tenant' 时为 null */
  userId: string | null;
  tenantId: string;
  /** 按场景配置 provider 名称 (如 'deepseek-v3', 'kimi-k2'); 缺省走路由器内置规则 */
  byScenario: Partial<Record<ScenarioTag, string>>;
  /** 默认 provider (兜底, 当场景未配置时使用) */
  defaultProvider?: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 解析最终使用的 provider 名:
 *   user.byScenario[scenario] → user.defaultProvider →
 *   tenant.byScenario[scenario] → tenant.defaultProvider → null (走路由器内置)
 */
export function resolveProvider(
  scenario: ScenarioTag | undefined,
  userPref: LlmPreference | null,
  tenantPref: LlmPreference | null,
): string | null {
  if (scenario && userPref?.byScenario[scenario]) return userPref.byScenario[scenario]!;
  if (userPref?.defaultProvider) return userPref.defaultProvider;
  if (scenario && tenantPref?.byScenario[scenario]) return tenantPref.byScenario[scenario]!;
  if (tenantPref?.defaultProvider) return tenantPref.defaultProvider;
  return null;
}
