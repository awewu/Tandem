/**
 * 权威客户生命周期状态词表（单一事实源）。
 *
 * 与生命周期投影和客户门户状态机保持一致。
 * 键、以及前端 `public/customer-view.html` / `public/business-console.html` 的状态机
 * 保持一致。任何写入 Postgres `lifecycle_links.stage` 的路径都必须使用这里的规范态，
 * 避免 CRM 侧（原先写 'lead'/'signed'）与 14 态权威模型漂移。
 *
 * 事实源：docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md §2。
 */
export const LIFECYCLE_STATES = [
  'lead-created',
  'diagnosis-in-progress',
  'solution-drafted',
  'design-in-progress',
  'quote-drafted',
  'quote-approved',
  'contract-pending',
  'construction-planning',
  'construction-in-progress',
  'acceptance-pending',
  'accepted',
  'lifecycle-handoff-ready',
  'lifecycle-active',
  'service-event-open',
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

const STATE_SET = new Set<string>(LIFECYCLE_STATES);

export function isLifecycleState(value: unknown): value is LifecycleState {
  return typeof value === 'string' && STATE_SET.has(value);
}

/** 规范态排序索引；未知态返回 -1。用于判断闭环推进是否前进。 */
export function lifecycleStateOrder(state: string): number {
  return LIFECYCLE_STATES.indexOf(state as LifecycleState);
}
