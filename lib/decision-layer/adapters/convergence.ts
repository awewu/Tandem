/**
 * Convergence Adapter · 议事室 3+1 适配器
 *
 * 议事室是首个接入 3+1 的场景 (V0 已上线), 此 adapter 为 thin wrapper:
 *   - 自动注入 scenario='convergence'
 *   - 委托给 ThreePlusOneEngine.generateOptions
 *
 * 历史调用路径 (orchestrator.ts) 直接 new DecisionEngine(...) 仍可工作,
 * 此 adapter 是新代码的推荐入口.
 */

import { ThreePlusOneEngine, type DecisionContext, type MemoryRetriever, type OptionGenerationResult } from '../three-plus-one-engine';
import type { TandemRouter } from '../../taf/router';

export async function generateConvergenceOptions(
  router: TandemRouter,
  retriever: MemoryRetriever,
  ctx: Omit<DecisionContext, 'scenario'>
): Promise<OptionGenerationResult> {
  const engine = new ThreePlusOneEngine(router, retriever);
  return engine.generateOptions({ ...ctx, scenario: 'convergence' });
}
