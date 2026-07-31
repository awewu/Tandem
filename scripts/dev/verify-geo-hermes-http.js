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

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
  const body = {
    question: '请只用一句话回答：页面 HTTP GEO Hermes 验证是否通过？',
    engine: 'hermes-center-ai',
    brandSlug: 'rhautt-comfort',
    competitors: ['海尔', '美的', 'A.O.史密斯'],
  };

  const run = await fetch('http://localhost:5500/api/v2/growth/geo/probe-jobs/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!run.ok || !run.body) {
    const runText = await run.text();
    throw new Error(`stream failed ${run.status} ${runText.slice(0, 300)}`);
  }

  const reader = run.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let detail = null;
  let deltaCount = 0;
  let streamedText = '';
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
          streamedText += event.content || '';
        }
        if (event.type === 'done') detail = { data: event };
        if (event.type === 'failed' || event.type === 'blocked') {
          detail = { data: event };
        }
      }
    }
  }
  if (!detail) throw new Error('stream ended without final event');

  const visRes = await fetch('http://localhost:5500/api/v2/growth/geo/visibility', { headers });
  const visibility = await visRes.json();
  const job = detail.data.job;
  const snapshot = detail.data.snapshot;

  console.log(JSON.stringify({
    ok: job.status === 'succeeded',
    httpApi: 'http://localhost:5500',
    stream: {
      deltaCount,
      preview: streamedText.slice(0, 160),
    },
    job: {
      id: job.id,
      engine: job.engine,
      status: job.status,
      errorMessage: job.errorMessage,
      probeId: job.probeId,
      snapshotId: job.snapshotId,
    },
    snapshotPreview: snapshot ? snapshot.answerText.slice(0, 160) : null,
    visibility: (visibility.data.visibility || []).filter((row) => row.engine === 'hermes-center-ai'),
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
