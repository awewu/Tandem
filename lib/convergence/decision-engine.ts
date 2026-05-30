/**
 * 3+1 Decision Engine · 议事室专用 thin wrapper
 *
 * P0.5 抽层 (2026-05-28): 真正实现已迁到 `lib/decision-layer/`,
 * 此文件仅做 re-export 保持现有调用方 (orchestrator.ts / memory/retriever.ts)
 * 的 import 路径不变, 0 行为改动.
 *
 * 新代码请直接 import from '@/lib/decision-layer':
 *
 *   import { ThreePlusOneEngine, type DecisionContext } from '@/lib/decision-layer';
 *
 * @deprecated 推荐 `@/lib/decision-layer`. 本路径保留至少 1 个 release 周期.
 */

export {
  ThreePlusOneEngine as DecisionEngine,
  StubMemoryRetriever,
  type MemoryRetriever,
  type MemorySearchResult,
  type DecisionContext,
  type DecisionScenario,
  type OptionGenerationResult,
} from '../decision-layer/three-plus-one-engine';
