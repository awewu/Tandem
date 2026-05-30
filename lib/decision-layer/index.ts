/**
 * Decision Layer · 通用 3+1 决策层
 *
 * 对应 MANIFESTO §2: "任何 AI 决策辅助场景, 必须呈现 3+1 选项"
 *
 * 使用方式:
 *   import { ThreePlusOneEngine } from '@/lib/decision-layer';
 *   const engine = new ThreePlusOneEngine(router, retriever);
 *   const { options, warnings } = await engine.generateOptions(ctx);
 *
 * Adapter 模式 (lib/decision-layer/adapters/*) 用于特定场景的轻量包装:
 *   - convergence:    议事室 (已接入)
 *   - report:         5min 日报 KR 推流前 (P1)
 *   - tti:            TTI 拆解 (P1)
 *   - weekly-retro:   周回顾 (P1)
 *   - persona-brief:  主分身 brief 推荐 (P1)
 *   - learning:       学习答题反馈 (P2)
 */

export {
  ThreePlusOneEngine,
  StubMemoryRetriever,
  type MemoryRetriever,
  type MemorySearchResult,
  type DecisionContext,
  type DecisionScenario,
  type OptionGenerationResult,
} from './three-plus-one-engine';

// 向后兼容别名 (P0.5 抽层期间, 调用方可继续用 DecisionEngine 名)
export { ThreePlusOneEngine as DecisionEngine } from './three-plus-one-engine';
