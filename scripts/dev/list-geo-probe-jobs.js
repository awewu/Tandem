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
  const { rows } = await client.query(`
    select
      id,
      question,
      engine,
      status,
      error_message,
      started_at,
      finished_at,
      probe_id,
      snapshot_id,
      created_at
    from rhautt_nexus.growth_geo_probe_job
    order by created_at desc
    limit 12
  `);
  await client.end();
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
