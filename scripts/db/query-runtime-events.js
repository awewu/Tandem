#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env.nestjs'), quiet: true });

const serviceName = process.argv[2] || 'dealer-workbench';
const limit = Math.min(Math.max(Number(process.argv[3] || 20), 1), 200);
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;
const client = new Client(
  connectionString
    ? { connectionString }
    : {
        host: process.env.POSTGRES_HOST || '127.0.0.1',
        port: Number(process.env.POSTGRES_PORT || 5432),
        user: process.env.POSTGRES_USER || 'rhautt',
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB || 'rhautt_nexus',
      }
);

async function main() {
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT instance_id, service_name, event_type, severity,
              parent_pid, child_pid, exit_code, signal, occurred_at
         FROM rhautt_nexus.runtime_process_events
        WHERE service_name = $1
        ORDER BY occurred_at DESC
        LIMIT $2`,
      [serviceName, limit]
    );
    console.table(rows);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
