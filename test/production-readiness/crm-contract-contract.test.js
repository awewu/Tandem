const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

describe('套间二 · CRM 全端点契约收口', () => {
  test('OpenAPI 覆盖 CRM 全部 8 个控制器端点', () => {
    const map = {
      '/api/v2/crm/leads': ['post', 'createCrmLead'],
      '/api/v2/crm/customers': ['get', 'listCustomers'],
      '/api/v2/crm/customers/{customerId}': ['get', 'getCustomer360'],
      '/api/v2/crm/pipeline': ['get', 'listCrmPipeline'],
      '/api/v2/crm/opportunities/{id}/stage': ['put', 'updateCrmOpportunityStage'],
      '/api/v2/crm/opportunities/{id}': ['put', 'updateCrmOpportunity'],
      '/api/v2/crm/interactions': ['post', 'addCrmInteraction'],
      '/api/v2/crm/opportunities/{id}/sign': ['post', 'signCrmOpportunity'],
    };
    for (const [route, [method, opId]] of Object.entries(map)) {
      const op = spec.paths[route]?.[method];
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(opId);
      expect(op.tags).toContain('CRM');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
    }
  });

  test('interactions / sign / stage 必填契约', () => {
    const inter = spec.paths['/api/v2/crm/interactions'].post.requestBody.content['application/json'].schema;
    expect(inter.required).toContain('customerId');
    const sign = spec.paths['/api/v2/crm/opportunities/{id}/sign'].post.requestBody.content['application/json'].schema;
    expect(sign.required).toContain('quotationId');
    const stage = spec.paths['/api/v2/crm/opportunities/{id}/stage'].put.requestBody.content['application/json'].schema;
    expect(stage.required).toContain('stage');
  });

  test('CRM mutation schemas reject undeclared fields and document ownership not-found responses', () => {
    const operations = [
      spec.paths['/api/v2/crm/leads'].post,
      spec.paths['/api/v2/crm/opportunities/{id}/stage'].put,
      spec.paths['/api/v2/crm/opportunities/{id}'].put,
      spec.paths['/api/v2/crm/interactions'].post,
      spec.paths['/api/v2/crm/opportunities/{id}/sign'].post,
    ];
    for (const operation of operations) {
      const schema = operation.requestBody.content['application/json'].schema;
      expect(schema.additionalProperties).toBe(false);
    }
    for (const operation of operations.slice(1)) {
      expect(operation.responses['404']).toBeTruthy();
    }
    expect(spec.paths['/api/v2/crm/interactions'].post.responses['201']).toBeTruthy();
    expect(spec.paths['/api/v2/crm/opportunities/{id}/sign'].post.responses['201']).toBeTruthy();
  });

  test('生成客户端暴露 5 个新增 CRM 方法', () => {
    for (const m of ['listCrmPipeline', 'updateCrmOpportunityStage', 'updateCrmOpportunity', 'addCrmInteraction', 'signCrmOpportunity']) {
      expect(client).toContain(`async ${m}`);
    }
  });
});

describe('套间二 · NestJS 电子签合同面契约收口（additive，与 legacy /contracts 并存）', () => {
  test('OpenAPI 覆盖 NestJS /contract 全部 11 个端点', () => {
    const map = {
      '/api/v2/contract/from-quotation': ['post', 'draftContractFromQuotation'],
      '/api/v2/contract': ['post', 'createContractDraft'],
      '/api/v2/contract/{id}': ['get', 'getContractDraft'],
      '/api/v2/contract/{id}/send': ['post', 'sendContractForSignature'],
      '/api/v2/contract/{id}/sign-url': ['get', 'getContractSignUrl'],
      '/api/v2/contract/{id}/sign': ['post', 'signContractOffline'],
      '/api/v2/contract/{id}/activate': ['post', 'activateContract'],
      '/api/v2/contract/{id}/fulfill': ['post', 'fulfillContract'],
      '/api/v2/contract/{id}/cancel': ['post', 'cancelContract'],
    };
    for (const [route, [method, opId]] of Object.entries(map)) {
      const op = spec.paths[route]?.[method];
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(opId);
      expect(op.tags).toContain('Contracts');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
    }
    expect(spec.paths['/api/v2/contract'].get.operationId).toBe('listContractDrafts');
  });

  test('契约锁 webhook 为公开端点（签名鉴权，无 bearerAuth）', () => {
    const wh = spec.paths['/api/v2/contract/webhook/qiyuesuo'].post;
    expect(wh.operationId).toBe('contractSignatureWebhook');
    expect(wh.security).toBeUndefined();
    expect(wh.parameters.some((p) => p.name === 'x-qys-signature' && p.in === 'header')).toBe(true);
  });

  test('legacy /contracts（Express 面）保持存在，未被误删（两后端并存 B3）', () => {
    // 收口是 additive：go-forward NestJS /contract 与 legacy Express /contracts 并存
    expect(spec.paths['/api/v2/contracts']).toBeTruthy();
    expect(spec.paths['/api/v2/contracts/from-quotation']).toBeTruthy();
    expect(spec.paths['/api/v2/contracts'].get.operationId).toBe('listContracts');
  });

  test('contract webhook remains a public future interface without a delivery runtime', () => {
    const webhook = spec.paths['/api/v2/contract/webhook/qiyuesuo'].post;
    expect(webhook.security).toBeUndefined();
    expect(read('services/api/src/modules/module-boundary.ts')).toMatch(/plannedApiInterfaces[\s\S]*'delivery'/);
    expect(fs.existsSync(path.join(ROOT, 'services/api/src/modules/delivery'))).toBe(false);
  });

  test('生成客户端暴露电子签合同关键方法', () => {
    for (const m of ['sendContractForSignature', 'getContractSignUrl', 'signContractOffline', 'contractSignatureWebhook']) {
      expect(client).toContain(`async ${m}`);
    }
  });
});
