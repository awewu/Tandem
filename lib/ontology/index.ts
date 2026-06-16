/**
 * lib/ontology · 本体层公开 API (ON-0 · 2026-06-09)
 *
 * 用法:
 *   import { ontology, ensureCoreObjectTypes } from '@/lib/ontology';
 *   ensureCoreObjectTypes();                       // boot 时调一次 (幂等)
 *   const kr = await ontology.resolve('KeyResult', krId);   // → { data, derived:{progress}, links }
 *   const obj = await ontology.traverse('KeyResult', krId, 'objective');
 *   const hits = await ontology.search('Objective', '新签');
 *
 * 设计与边界见 docs/ONTOLOGY-CENTRAL-BRAIN.md (ON-0 拱心石 / §8 技术规格)。
 */

export type { ObjectType, ObjectTypeId, OntologyLink, ResolvedObject } from './types';
export { ontology } from './registry';
export type { OntologyRegistry } from './registry';
export {
  ensureCoreObjectTypes,
  CORE_OBJECT_TYPES,
  ObjectiveType,
  KeyResultType,
  InitiativeType,
  DecisionCardType,
  PersonaType,
  KpiType,
  MemoryEntryType,
} from './object-types';

// ── ON-1 · Action Type 引擎 ──────────────────────────────────────────
export type {
  ActionType,
  ActionContext,
  ActionZone,
  SideEffect,
  SideEffectOutcome,
  ValidationResult,
} from './action-types';
export { actionRegistry } from './action-types';
export { executeAction, type ExecuteActionResult } from './execute-action';
export { KrCheckinAction, type KrCheckinInput, type KrCheckinResult } from './actions/kr-checkin';
export {
  ObjectiveCheckinAction,
  type ObjectiveCheckinInput,
  type ObjectiveCheckinResult,
} from './actions/objective-checkin';

// ── ON-2 · 中央 AI 决策调配 (提议 → 否决窗 → 兑现) ────────────────────
export {
  proposeAction,
  materializeOntologyProxyAction,
  confirmAndMaterialize,
  reconcileOntologyActionVetoWindows,
  type ProposeActionInput,
  type ProposeActionResult,
  type ProposeResultStatus,
  type ConfirmAndMaterializeResult,
} from './propose-action';

import { ensureCoreObjectTypes } from './object-types';
import { actionRegistry } from './action-types';
import { KrCheckinAction } from './actions/kr-checkin';
import { ObjectiveCheckinAction } from './actions/objective-checkin';

/** 幂等注册核心 Action Type (用 has() 判定, 使 test clear 后能重注册)。 */
export function ensureCoreActions(): void {
  if (!actionRegistry.has(KrCheckinAction.id)) actionRegistry.register(KrCheckinAction);
  if (!actionRegistry.has(ObjectiveCheckinAction.id)) actionRegistry.register(ObjectiveCheckinAction);
}

// import 即注册核心对象类型 + Action Type (幂等; 镜像 skillRegistry 的 boot 注册范式)。
// 只读对象层零副作用; Action Type 仅注册定义, 无消费方调 executeAction 前不改变任何行为。
ensureCoreObjectTypes();
ensureCoreActions();
