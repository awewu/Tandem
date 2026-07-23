import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiDesignService } from './ai-design.service';

// ai-design LLM 编排单测（node:test + ts-node/transpile-only）：
// mock ai-gateway，验证「规则事实 → interpretation/flags」契约与编排铁律（模型不自出合规结论、失败降级）。

const user: any = { tenantId: 'demo', userId: 'u1' };

function makeService(gatewayImpl: any) {
  const productCatalog: any = { priceBandsForSystems: async () => ({ data: { bands: [] } }) };
  return new AiDesignService(productCatalog, gatewayImpl);
}

test('reviewCalcGate: 把失败/警告事实喂给网关，返回 interpretation + model + flags', async () => {
  let capturedPrompt = '';
  const svc = makeService({
    async generateDraft(req: any) {
      capturedPrompt = req.prompt;
      return { draft: '建议复核噪声与冷凝风险', model: 'claude-3-5-sonnet-latest', tokensCost: 42, complianceFlags: [] };
    },
  });
  const r: any = await svc.reviewCalcGate({
    projectId: 'p1',
    calcResult: {},
    gateResult: { checks: [
      { key: 'noise', status: 'fail', message: '室内噪声超标' },
      { key: 'condensation', status: 'warning' },
    ] },
  });
  // 事实锚点必须包含校验 key（防幻觉：只喂规则已判定事实）
  assert.match(capturedPrompt, /noise/);
  assert.match(capturedPrompt, /condensation/);
  assert.equal(r.interpretation, '建议复核噪声与冷凝风险');
  assert.equal(r.checkedBy, 'claude-3-5-sonnet-latest');
  assert.ok(Array.isArray(r.notes) && r.notes.length >= 2);
  // 编排铁律：必带免责声明，不自出合规结论
  assert.match(r.disclaimer, /不构成设计合规/);
});

test('reviewCalcGate: 合规违禁词经网关 flags 透传', async () => {
  const svc = makeService({
    async generateDraft() {
      return { draft: '本产品效果最佳', model: 'stub:deterministic', tokensCost: 0, complianceFlags: ['最佳'] };
    },
  });
  const r: any = await svc.reviewCalcGate({ projectId: 'p1', calcResult: {}, gateResult: { checks: [] } });
  assert.deepEqual(r.complianceFlags, ['最佳']);
});

test('reviewCalcGate: 网关抛错 → 降级为 notes-only，不崩溃', async () => {
  const svc = makeService({
    async generateDraft() { throw new Error('provider down'); },
  });
  const r: any = await svc.reviewCalcGate({ projectId: 'p1', calcResult: {}, gateResult: { checks: [{ key: 'x', status: 'fail' }] } });
  assert.equal(r.interpretation, '');
  assert.equal(r.checkedBy, 'stub:deterministic'); // 未被模型覆盖
  assert.ok(r.notes.length >= 1);
});

test('reviewCalcGate: 无失败/警告 → 仍提示需设计师确认', async () => {
  const svc = makeService({
    async generateDraft() { return { draft: '无失败项', model: 'stub:deterministic', tokensCost: 0, complianceFlags: [] }; },
  });
  const r: any = await svc.reviewCalcGate({ projectId: 'p1', calcResult: {}, gateResult: { checks: [{ key: 'ok', status: 'pass' }] } });
  assert.ok(r.notes.some((n: string) => n.includes('确认')));
});
