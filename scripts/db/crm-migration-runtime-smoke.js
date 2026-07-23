#!/usr/bin/env node
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: '.env.nestjs', quiet: true });

const DIRECT = process.env.NESTJS_URL || 'http://127.0.0.1:5500';
const PROXY = process.env.EXPRESS_URL || 'http://127.0.0.1:3000';
const LOGIN_PHONE = process.env.CRM_SMOKE_LOGIN_PHONE || '13900000001';
const LOGIN_PASSWORD = process.env.CRM_SMOKE_LOGIN_PASSWORD || 'Dealer@2026';

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
  if (!login.token) throw new Error('CRM smoke login returned no token');

  const jwtPayload = JSON.parse(Buffer.from(login.token.split('.')[1], 'base64url').toString('utf8'));
  const tenantId = jwtPayload.tenantId;
  if (!tenantId) throw new Error('CRM smoke token returned no tenantId');

  const phone = `137${String(Date.now()).slice(-8)}`;
  let customerId;
  let opportunityId;
  let interactionId;
  const db = new Client(databaseConfig());
  await db.connect();

  try {
    const created = await request(DIRECT, '/api/v2/crm/leads', {
      method: 'POST',
      body: JSON.stringify({ phone, name: 'CRM migration smoke', source: 'migration-smoke', city: 'Shanghai' }),
    }, login.token);
    customerId = created.customer?.id;
    if (!customerId || created.duplicate) throw new Error('direct CRM lead creation did not create a customer');
    if (created.customer.phoneEncrypted || created.customer.phoneHash) throw new Error('CRM response leaked internal PII fields');

    const duplicate = await request(PROXY, '/api/v2/crm/leads', {
      method: 'POST',
      body: JSON.stringify({ phone, name: 'CRM migration smoke duplicate' }),
    }, login.token);
    if (!duplicate.duplicate || duplicate.customer?.id !== customerId) throw new Error('proxy CRM duplicate contract failed');

    const pipeline = await request(PROXY, '/api/v2/crm/pipeline', {}, login.token);
    opportunityId = pipeline.items?.find(item => item.customerId === customerId)?.id;
    if (!opportunityId) throw new Error('proxy CRM pipeline did not return the created opportunity');

    const updated = await request(PROXY, `/api/v2/crm/opportunities/${opportunityId}/stage`, {
      method: 'PUT', body: JSON.stringify({ stage: 'qualified' }),
    }, login.token);
    if (updated.stage !== 'qualified') throw new Error('proxy CRM stage update did not return the updated entity');

    const interaction = await request(DIRECT, '/api/v2/crm/interactions', {
      method: 'POST',
      body: JSON.stringify({ customerId, opportunityId, type: 'note', content: 'runtime smoke' }),
    }, login.token);
    interactionId = interaction.id;
    if (!interactionId) throw new Error('direct CRM interaction creation returned no id');

    await db.query('BEGIN');
    await db.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const proof = await db.query(
      `SELECT
         (SELECT phone_encrypted LIKE 'v1:%' FROM rhautt_nexus.customers WHERE id = $1) AS encrypted,
         (SELECT count(*)::int FROM rhautt_nexus.audit_logs WHERE resource_id = ANY($2::text[])) AS audit_count,
         (SELECT count(*)::int FROM rhautt_nexus.mdm_outbox_events WHERE aggregate_id = ANY($2::text[])) AS outbox_count`,
      [customerId, [customerId, opportunityId, interactionId]],
    );
    const row = proof.rows[0];
    if (!row.encrypted || row.audit_count < 3 || row.outbox_count < 3) {
      throw new Error(`database proof failed: ${JSON.stringify(row)}`);
    }
    await db.query('COMMIT');

    console.log(JSON.stringify({
      ok: true,
      direct: DIRECT,
      proxy: PROXY,
      encrypted: row.encrypted,
      auditCount: row.audit_count,
      outboxCount: row.outbox_count,
    }));
  } finally {
    if (customerId) {
      await db.query('BEGIN');
      await db.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      await db.query('DELETE FROM rhautt_nexus.interactions WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM rhautt_nexus.lifecycle_links WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM rhautt_nexus.opportunities WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM rhautt_nexus.audit_logs WHERE resource_id = ANY($1::text[])', [[customerId, opportunityId, interactionId].filter(Boolean)]);
      await db.query('DELETE FROM rhautt_nexus.mdm_outbox_events WHERE aggregate_id = ANY($1::text[])', [[customerId, opportunityId, interactionId].filter(Boolean)]);
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
