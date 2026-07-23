/**
 * V9 API路由 - 统一暴露所有V9新功能端点
 * 包含: LLM对话, 逐时负荷, 水力建模, i18n, 单位转换, 货币, Webhook, 插件SDK
 */

const express = require('express');
const router = express.Router();
const { getRuntimeEngine, getSharedSafeEngines } = require('../runtimeEngineAccess');

let engines;

function getEngines() {
  if (!engines) {
    const factories = getSharedSafeEngines().runtimeServiceFactories;

    engines = {
      llm: getRuntimeEngine('llmServiceV2'),
      hourlyLoad: getRuntimeEngine('hourlyLoad'),
      hydraulic: getRuntimeEngine('hydraulicModeling'),
      i18n: getRuntimeEngine('i18nEngine'),
      units: getRuntimeEngine('unitConverter'),
      currency: getRuntimeEngine('currencyEngine'),
      webhook: getRuntimeEngine('webhookEngine'),
      plugins: getRuntimeEngine('pluginSdk'),
      createHourlyLoadEngine: factories.hourlyLoadEngine,
      createHydraulicModelingEngine: factories.hydraulicModelingEngine
    };
  }
  return engines;
}

// ===== 健康检查 =====
router.get('/health', (req, res) => {
  const { llm, hourlyLoad, hydraulic, i18n, units, currency, webhook, plugins } = getEngines();
  res.json({
    version: '9.0.0',
    status: 'operational',
    engines: {
      llm: llm.health(),
      hourlyLoad: hourlyLoad.health(),
      hydraulic: hydraulic.health(),
      i18n: i18n.health(),
      units: units.health(),
      currency: currency.health(),
      webhook: webhook.health(),
      plugins: plugins.health()
    },
    timestamp: new Date().toISOString()
  });
});

// ===== LLM 对话 API =====
router.post('/llm/chat', async (req, res) => {
  try {
    const { llm } = getEngines();
    const { message, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: 'message 字段必填' });
    const result = await llm.chat(message, { conversationId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/llm/function-call', async (req, res) => {
  try {
    const { llm } = getEngines();
    const { message, functions } = req.body;
    const result = await llm.functionCall(message, functions || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/llm/conversation/:id', (req, res) => {
  const { llm } = getEngines();
  llm.clearConversation(req.params.id);
  res.json({ success: true });
});

// ===== 8760h 逐时负荷 =====
router.post('/load/hourly', (req, res) => {
  try {
    const { createHourlyLoadEngine, units } = getEngines();
    const { city, zones } = req.body;
    const engine = createHourlyLoadEngine();
    if (zones && Array.isArray(zones)) {
      zones.forEach(z => engine.addZone(z));
    } else {
      engine.addZone({ name: '默认区域', area: req.body.area || 120 });
    }
    const result = engine.calculate(city || 'shanghai');
    // 单位转换
    if (req.query.units === 'imperial') {
      result.unitSystem = 'imperial';
      result.summary.totalPeakCoolingBTU = units.convert(result.summary.totalPeakCooling, 'power', 'imperial');
      result.summary.totalPeakHeatingBTU = units.convert(result.summary.totalPeakHeating, 'power', 'imperial');
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/load/cities', (req, res) => {
  const { hourlyLoad } = getEngines();
  res.json({ cities: [...hourlyLoad.weatherDB.keys()], total: hourlyLoad.weatherDB.size });
});

// ===== 水力建模 =====
router.post('/hydraulic/calculate', (req, res) => {
  try {
    const { createHydraulicModelingEngine } = getEngines();
    const { nodes, pipes, pumps, fluid } = req.body;
    const engine = createHydraulicModelingEngine();
    if (nodes) nodes.forEach(n => engine.addNode(n));
    if (pipes) pipes.forEach(p => engine.addPipe(p));
    if (pumps) pumps.forEach(pu => engine.addPump(pu));
    const result = engine.calculate(fluid || 'water');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/hydraulic/pipe-sizing', (req, res) => {
  const { hydraulic } = getEngines();
  const { flow, velocity } = req.body;
  const result = hydraulic.selectPipeSize(flow || 1, velocity || 1.0);
  res.json(result);
});

// ===== 国际化 =====
router.get('/i18n/locales', (req, res) => {
  const { i18n } = getEngines();
  res.json(i18n.getSupportedLocales());
});

router.post('/i18n/translate', (req, res) => {
  const { i18n } = getEngines();
  const { keys, locale } = req.body;
  if (locale) i18n.setLocale(locale);
  const result = i18n.tBatch(keys || [], locale);
  res.json({ locale: i18n.currentLocale, translations: result });
});

// ===== 单位转换 =====
router.post('/units/convert', (req, res) => {
  const { units } = getEngines();
  const { value, type, system } = req.body;
  const result = units.convert(value, type, system);
  res.json(result);
});

router.get('/units/types', (req, res) => {
  const { units } = getEngines();
  res.json({ system: units.system, types: Object.keys(units.conversions) });
});

// ===== 多货币 =====
router.post('/currency/convert', (req, res) => {
  const { currency } = getEngines();
  const { amount, from, to } = req.body;
  res.json(currency.convert(amount || 0, from || 'CNY', to || 'USD'));
});

router.post('/currency/quote', (req, res) => {
  const { currency } = getEngines();
  const { amount, currencies, region } = req.body;
  res.json(currency.generateMultiCurrencyQuote(amount || 10000, currencies, region));
});

router.post('/currency/tax', (req, res) => {
  const { currency } = getEngines();
  const { amount, region, cur } = req.body;
  res.json(currency.applyTax(amount || 0, region || 'CN', cur));
});

// ===== Webhook =====
router.post('/webhooks/subscribe', (req, res) => {
  const { webhook } = getEngines();
  const { eventType, url, secret } = req.body;
  const result = webhook.subscribe(eventType, url, { secret });
  res.status(result.success ? 201 : 400).json(result);
});

router.delete('/webhooks/:id', (req, res) => {
  const { webhook } = getEngines();
  res.json(webhook.unsubscribe(req.params.id));
});

router.get('/webhooks', (req, res) => {
  const { webhook } = getEngines();
  res.json({ subscriptions: webhook.getSubscriptions(), eventTypes: webhook.eventTypes });
});

router.get('/webhooks/log', (req, res) => {
  const { webhook } = getEngines();
  res.json(webhook.getDeliveryLog(parseInt(req.query.limit) || 50));
});

// ===== 插件SDK =====
router.get('/plugins', (req, res) => {
  const { plugins } = getEngines();
  res.json({ installed: [...plugins.plugins.values()].map(p => ({ id: p.id, name: p.name, version: p.version, enabled: p.enabled })), marketplace: plugins.getMarketplace() });
});

router.post('/plugins/install', (req, res) => {
  const { plugins } = getEngines();
  const result = plugins.register(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

router.delete('/plugins/:id', (req, res) => {
  const { plugins } = getEngines();
  res.json(plugins.unregister(req.params.id));
});

router.get('/plugins/sdk-docs', (req, res) => {
  const { plugins } = getEngines();
  res.json(plugins.getSDKDocs());
});

// ===== OpenAPI Spec =====
router.get('/openapi', (req, res) => {
  res.json({
    openapi: '3.0.3',
    info: { title: 'Rheem HVAC AI Design Platform API', version: '9.0.0', description: 'V9 Evolution API' },
    servers: [{ url: '/api/v9', description: 'V9 API Server' }],
    paths: {
      '/health': { get: { summary: 'V9引擎健康状态', tags: ['System'] } },
      '/llm/chat': { post: { summary: 'AI多轮对话', tags: ['LLM'], requestBody: { content: { 'application/json': { schema: { properties: { message: { type: 'string' }, conversationId: { type: 'string' } } } } } } } },
      '/load/hourly': { post: { summary: '8760h逐时负荷计算', tags: ['Calculation'] } },
      '/hydraulic/calculate': { post: { summary: '水力管网建模计算', tags: ['Calculation'] } },
      '/i18n/locales': { get: { summary: '获取支持语言列表', tags: ['i18n'] } },
      '/units/convert': { post: { summary: '单位转换', tags: ['i18n'] } },
      '/currency/quote': { post: { summary: '多币种报价', tags: ['Commerce'] } },
      '/webhooks/subscribe': { post: { summary: '订阅Webhook事件', tags: ['Webhook'] } },
      '/plugins': { get: { summary: '插件列表', tags: ['Plugin'] } },
      '/plugins/sdk-docs': { get: { summary: '获取SDK文档', tags: ['Plugin'] } }
    },
    tags: [
      { name: 'System', description: '系统管理' },
      { name: 'LLM', description: 'AI大模型服务' },
      { name: 'Calculation', description: '专业计算引擎' },
      { name: 'i18n', description: '国际化与单位' },
      { name: 'Commerce', description: '商务与货币' },
      { name: 'Webhook', description: '事件推送' },
      { name: 'Plugin', description: '插件生态' }
    ]
  });
});

module.exports = router;
