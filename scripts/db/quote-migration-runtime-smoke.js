#!/usr/bin/env node
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: '.env.nestjs', quiet: true });

const DIRECT = process.env.NESTJS_URL || 'http://127.0.0.1:5500';
const PROXY = process.env.EXPRESS_URL || 'http://127.0.0.1:3000';
const LOGIN_PHONE = process.env.QUOTE_SMOKE_LOGIN_PHONE || '13900000001';
const LOGIN_PASSWORD = process.env.QUOTE_SMOKE_LOGIN_PASSWORD || 'Dealer@2026';

async function request(base, path, init = {}, token) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${base}${path} -> HTTP ${response.status} ${JSON.stringify(payload)}`);
  return payload.data ?? payload;
}

function databaseConfig() {
  if (process.env.POSTGRES_URI) return { connectionString: process.env.POSTGRES_URI };
  return {
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'rhautt',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  };
}

async function run() {
  const login = await request(DIRECT, '/api/v2/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: LOGIN_PHONE, password: LOGIN_PASSWORD }),
  });
  if (!login.token) throw new Error('Quote smoke login returned no token');
  const jwtPayload = JSON.parse(Buffer.from(login.token.split('.')[1], 'base64url').toString('utf8'));
  const tenantId = jwtPayload.tenantId;
  if (!tenantId) throw new Error('Quote smoke token returned no tenantId');

  const phone = `136${String(Date.now()).slice(-8)}`;
  let customerId;
  let opportunityId;
  let quotationId;
  const db = new Client(databaseConfig());
  await db.connect();

  try {
    const lead = await request(DIRECT, '/api/v2/crm/leads', {
      method: 'POST',
      body: JSON.stringify({
        phone,
        name: 'Quote migration smoke',
        source: 'migration-smoke',
        city: 'Shanghai',
        address: `quote-smoke-${Date.now()}`,
      }),
    }, login.token);
    customerId = lead.customer?.id;
    if (!customerId || lead.duplicate) throw new Error('Quote smoke could not create its customer graph');

    const pipeline = await request(DIRECT, '/api/v2/crm/pipeline', {}, login.token);
    opportunityId = pipeline.items?.find(item => item.customerId === customerId)?.id;
    if (!opportunityId) throw new Error('Quote smoke could not resolve its opportunity');

    const quote = await request(DIRECT, '/api/v2/quotation', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        opportunityId,
        status: 'draft',
        project: { name: 'Quote migration smoke' },
        items: [{ sku: 'SMOKE-1', name: 'Smoke item', unitPrice: 10000, unitCost: 7000, quantity: 1 }],
        systemFamilies: ['hot_water'],
        costBreakdown: { customerTotal: 10000 },
      }),
    }, login.token);
    quotationId = quote.id;
    if (!quotationId || !quote.projectId) throw new Error('Quote persist returned no quotation/project id');

    const listed = await request(PROXY, `/api/v2/quotation?opportunityId=${opportunityId}`, {}, login.token);
    if (!listed.some(item => item.id === quotationId)) throw new Error('Proxy quote list did not return the persisted quote');

    const locked = await request(PROXY, `/api/v2/quotation/${quotationId}/lock`, {
      method: 'POST', body: JSON.stringify({}),
    }, login.token);
    if (locked.status !== 'locked' || !locked.quotationLock?.locked) throw new Error('Proxy quote lock did not freeze the quote');

    await db.query('BEGIN');
    await db.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const proof = await db.query(
      `SELECT
         (SELECT count(*)::int FROM rhautt_nexus.audit_logs WHERE resource_id = $1 AND action IN ('quotation.create', 'quotation.lock')) AS audit_count,
         (SELECT count(*)::int FROM rhautt_nexus.mdm_outbox_events WHERE aggregate_id = $1 AND event_type IN ('quotation.created', 'quotation.locked')) AS outbox_count`,
      [quotationId],
    );
    await db.query('COMMIT');
    const row = proof.rows[0];
    if (row.audit_count !== 2 || row.outbox_count !== 2) throw new Error(`quote database proof failed: ${JSON.stringify(row)}`);

    console.log(JSON.stringify({
      ok: true,
      direct: DIRECT,
      proxy: PROXY,
      projectLinked: true,
      auditCount: row.audit_count,
      outboxCount: row.outbox_count,
    }));
  } finally {
    if (customerId) {
      await db.query('BEGIN');
      await db.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      if (quotationId) await db.query('DELETE FROM rhautt_nexus.quotations WHERE id = $1', [quotationId]);
      await db.query('DELETE FROM rhautt_nexus.interactions WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM rhautt_nexus.lifecycle_links WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM rhautt_nexus.opportunities WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM rhautt_nexus.audit_logs WHERE resource_id = ANY($1::text[])', [[customerId, opportunityId, quotationId].filter(Boolean)]);
      await db.query('DELETE FROM rhautt_nexus.mdm_outbox_events WHERE aggregate_id = ANY($1::text[])', [[customerId, opportunityId, quotationId].filter(Boolean)]);
      await db.query('DELETE FROM rhautt_nexus.customers WHERE id = $1', [customerId]);
      await db.query('COMMIT');
    }
    await db.end().catch(() => undefined);
  }
}

run().catch(error => {
  console.error(error.message);
  process.exit(1);
});
