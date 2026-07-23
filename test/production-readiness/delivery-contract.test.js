const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

const MODULE_DIR = 'services/api/src/modules/delivery';

describe('套间二 · delivery 交付/施工模块 · 契约与接线', () => {
  test('OpenAPI 暴露 delivery + construction 全部端点（受保护，operationId 正确）', () => {
    const paths = {
      '/api/v2/delivery/generate': ['post', 'generateDelivery'],
      '/api/v2/delivery/{orderNo}/docs': ['get', 'getDeliveryDocs'],
      '/api/v2/delivery/construction/projects/from-contract': ['post', 'createConstructionProject'],
      '/api/v2/delivery/construction/projects': ['get', 'listConstructionProjects'],
      '/api/v2/delivery/construction/projects/{id}': ['get', 'getConstructionProject'],
      '/api/v2/delivery/construction/projects/{id}/milestones/{key}/start': ['post', 'startConstructionMilestone'],
      '/api/v2/delivery/construction/projects/{id}/milestones/{key}/complete': ['post', 'completeConstructionMilestone'],
      '/api/v2/delivery/construction/projects/{id}/evidence': ['post', 'addConstructionEvidence'],
      '/api/v2/delivery/construction/projects/{id}/payments/{kind}/pay': ['post', 'payConstructionPayment'],
    };
    for (const [route, [method, opId]] of Object.entries(paths)) {
      const op = spec.paths[route]?.[method];
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(opId);
      expect(op.tags).toContain('Delivery');
      expect(op.security).toEqual([{ bearerAuth: [] }]); // 全局 deny-by-default，均受保护
    }
  });

  test('evidence / from-contract 请求体必填契约与留证类型枚举', () => {
    const evi = spec.paths['/api/v2/delivery/construction/projects/{id}/evidence'].post
      .requestBody.content['application/json'].schema;
    expect(evi.required).toEqual(expect.arrayContaining(['milestoneKey', 'type']));
    expect(evi.properties.type.enum).toEqual(['photo', 'esign', 'doc']);
    const fromContract = spec.paths['/api/v2/delivery/construction/projects/from-contract'].post
      .requestBody.content['application/json'].schema;
    expect(fromContract.required).toContain('contractId');
  });

  test('生成客户端暴露 9 个 delivery 方法', () => {
    for (const m of [
      'generateDelivery', 'getDeliveryDocs', 'createConstructionProject', 'listConstructionProjects',
      'getConstructionProject', 'startConstructionMilestone', 'completeConstructionMilestone',
      'addConstructionEvidence', 'payConstructionPayment',
    ]) {
      expect(client).toContain(`async ${m}`);
    }
  });

  test('B1 类型边界：delivery.generate 与 construction.from-contract 拒绝非对象/错误类型', () => {
    const delivery = read(`${MODULE_DIR}/delivery.service.ts`);
    expect(delivery).toContain('交付单体必须是对象');
    const construction = read(`${MODULE_DIR}/construction.service.ts`);
    expect(construction).toContain('contractId 必填且必须是字符串');
    expect(construction).toContain('paymentPlan 必须是数组');
    // addEvidence 留证类型白名单仍在
    expect(construction).toContain("['photo', 'esign', 'doc']");
  });

  test('施工里程碑留证闸不可绕过（隐蔽需影像、验收需电子签）', () => {
    const construction = read(`${MODULE_DIR}/construction.service.ts`);
    expect(construction).toContain('需影像留证方可完成');
    expect(construction).toContain('需验收电子签方可完成');
    // 进度款防误触发：仅 payable 可收
    expect(construction).toContain('款项未解锁');
  });
});
