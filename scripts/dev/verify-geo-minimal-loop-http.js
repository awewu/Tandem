const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const { configureRuntimeEnvironment } = require('../start-api');

configureRuntimeEnvironment();

const API = process.env.GEO_VERIFY_API || 'http://localhost:5500';

async function authHeaders() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  const { rows } = await client.query(
    'select id, tenant_id, dealer_id, store_id, role, permissions from rhautt_nexus.users where status = $1 order by created_at asc limit 1',
    ['active'],
  );
  await client.end();
  if (!rows.length) throw new Error('no active user');
  const user = rows[0];
  const token = jwt.sign(
    {
      userId: user.id,
      id: user.id,
      tenantId: user.tenant_id,
      dealerId: user.dealer_id,
      storeId: user.store_id,
      role: user.role,
      permissions: user.permissions || [],
    },
    process.env.JWT_SECRET || 'rhautt-comfort-dev-secret-NEVER-USE-IN-PRODUCTION',
    { expiresIn: '1h' },
  );
  return { 'content-type': 'application/json', authorization: `Bearer ${token}` };
}

async function json(path, headers, body, method = 'POST') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(async () => ({ message: await res.text() }));
  if (!res.ok) throw new Error(`${method} ${path} failed ${res.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload.data || payload;
}

async function waitForBatch(headers, id) {
  let detail = null;
  for (let i = 0; i < 50; i += 1) {
    detail = await json(`/api/v2/growth/geo/probe-batches/${id}`, headers, undefined, 'GET');
    if (!['pending', 'running'].includes(detail.batch.status)) return detail;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return detail;
}

async function main() {
  const headers = await authHeaders();
  const brandSlug = 'rheem';
  const category = `GEO最小闭环验证-${Date.now()}`;
  await json('/api/v2/growth/geo/question-set/save-generated', headers, { brandSlug, category });
  const questions = await json('/api/v2/growth/geo/question-set', headers, { brandSlug, category });
  if (!questions.questions.length) throw new Error('question set was not saved');

  const batchRun = await json('/api/v2/growth/geo/probe-batches/run', headers, {
    brandSlug,
    category,
    questionIds: questions.questions.slice(0, 2).map((item) => item.id),
    competitors: ['海尔', '美的', 'A.O.史密斯'],
  });
  const detail = await waitForBatch(headers, batchRun.batch.id);
  const succeeded = detail.jobs.filter((job) => job.status === 'succeeded');
  if (!succeeded.length) throw new Error(`batch did not produce succeeded jobs: ${detail.batch.status}`);

  const target = succeeded[0];
  const asset = await json('/api/v2/growth/geo/optimization-content', headers, {
    kind: 'faq',
    probeJobId: target.id,
    question: target.question,
    answerPreview: target.answerPreview,
    brandSlug,
    category,
    competitors: ['海尔', '美的', 'A.O.史密斯'],
    contentGaps: [{ title: 'GEO低分问题', desc: '需要补齐 FAQ 与结构化数据' }],
    sources: [{ title: '官网资料', url: 'https://www.rhautt.com', owned: true }],
  });

  console.log(JSON.stringify({
    ok: true,
    questions: questions.questions.length,
    batch: {
      id: detail.batch.id,
      status: detail.batch.status,
      totalProbes: detail.batch.totalProbes,
      completedProbes: detail.batch.completedProbes,
      citedRate: detail.batch.citedRate,
      avgAivs: detail.batch.avgAivs,
      highRiskCount: detail.batch.highRiskCount,
    },
    jobs: detail.jobs.map((job) => ({
      id: job.id,
      status: job.status,
      aivs: job.aivs,
      riskLevel: job.riskLevel,
      snapshotId: job.snapshotId,
      probeId: job.probeId,
    })),
    asset: {
      id: asset.asset.id,
      source: asset.asset.source,
      probeJobId: asset.asset.probeJobId,
      status: asset.asset.status,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
