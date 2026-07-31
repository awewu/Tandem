const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const { configureRuntimeEnvironment } = require('../start-api');

configureRuntimeEnvironment();

async function main() {
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
  const secret = process.env.JWT_SECRET || 'rhautt-comfort-dev-secret-NEVER-USE-IN-PRODUCTION';
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
    secret,
    { expiresIn: '1h' },
  );

  const kind = process.env.GEO_OPTIMIZATION_KIND || 'comparison';
  const res = await fetch('http://localhost:5500/api/v2/growth/geo/optimization-content/stream', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      kind,
      question: '热水系统有哪些品牌值得推荐？',
      answerPreview: '海尔、美的、A.O.史密斯被提及，我方未出现。',
      brandSlug: 'rheem',
      competitors: ['海尔', '美的', 'A.O.史密斯'],
      contentGaps: [{ title: '我方未被提及', desc: '需要补充权威内容' }],
      sources: [{ title: '官网产品资料', summary: '瑞合舒适系统方案', owned: true }],
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    console.log(JSON.stringify({ ok: false, status: res.status, body: text.slice(0, 2000) }, null, 2));
    process.exit(1);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let draft = '';
  let doneEvent = null;
  let deltaCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const event = JSON.parse(trimmed.slice(5).trim());
        if (event.type === 'delta') {
          deltaCount += 1;
          draft += event.content || '';
        }
        if (event.type === 'done') doneEvent = event;
        if (event.type === 'failed') throw new Error(event.error || 'stream failed');
      }
    }
  }
  console.log(JSON.stringify({
    ok: Boolean(doneEvent),
    status: res.status,
    deltaCount,
    draftPreview: String(doneEvent?.draft || draft).slice(0, 240),
    assetId: doneEvent?.asset?.id,
  }, null, 2));
  if (!doneEvent) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
