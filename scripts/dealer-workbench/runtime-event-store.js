const { Pool } = require('pg');

const INSERT_EVENT_SQL = `
  INSERT INTO rhautt_nexus.runtime_process_events (
    instance_id,
    service_name,
    environment,
    event_type,
    severity,
    parent_pid,
    child_pid,
    exit_code,
    signal,
    message,
    metadata,
    occurred_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
`;

const SELECT_LAST_EVENT_SQL = `
  SELECT instance_id, event_type, occurred_at
    FROM rhautt_nexus.runtime_process_events
   WHERE service_name = $1
   ORDER BY occurred_at DESC
   LIMIT 1
`;

function eventParams(event) {
  return [
    event.instanceId ?? null,
    event.serviceName ?? null,
    event.environment ?? 'development',
    event.eventType,
    event.severity ?? 'info',
    event.parentPid ?? null,
    event.childPid ?? null,
    event.exitCode ?? null,
    event.signal ?? null,
    event.message ?? null,
    JSON.stringify(event.metadata ?? {}),
    event.occurredAt ?? new Date(),
  ];
}

function buildDatabaseConfig(env = process.env) {
  if (env.RUNTIME_LOG_DATABASE_ENABLED === 'false') return null;

  const connectionString = env.DATABASE_URL || env.POSTGRES_URI;
  if (connectionString) return { connectionString };
  if (!env.POSTGRES_PASSWORD) return null;

  return {
    host: env.POSTGRES_HOST || '127.0.0.1',
    port: Number(env.POSTGRES_PORT || 5432),
    user: env.POSTGRES_USER || 'rhautt',
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB || 'rhautt_nexus',
  };
}

class RuntimeEventStore {
  constructor({ pool, onFailure = () => {} }) {
    this.pool = pool;
    this.onFailure = onFailure;
    this.queue = Promise.resolve();
    this.closed = false;
  }

  record(event) {
    if (this.closed) return Promise.resolve(false);

    const pending = this.queue.then(async () => {
      try {
        if (event.eventType === 'process_started') {
          const { rows } = await this.pool.query(SELECT_LAST_EVENT_SQL, [event.serviceName]);
          const previous = rows[0];
          if (
            previous &&
            previous.instance_id !== event.instanceId &&
            previous.event_type !== 'process_stopped'
          ) {
            await this.pool.query(
              INSERT_EVENT_SQL,
              eventParams({
                ...event,
                eventType: 'unclean_restart_detected',
                severity: 'warn',
                message: 'Previous process instance stopped without a shutdown event',
                metadata: {
                  previousInstanceId: previous.instance_id,
                  previousEventType: previous.event_type,
                  previousEventAt: previous.occurred_at,
                },
              })
            );
          }
        }
        await this.pool.query(INSERT_EVENT_SQL, eventParams(event));
        return true;
      } catch (error) {
        this.onFailure(error);
        return false;
      }
    });
    this.queue = pending.then(() => undefined);
    return pending;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.queue;
    try {
      await this.pool.end();
    } catch (error) {
      this.onFailure(error);
    }
  }
}

function createRuntimeEventStore({ env = process.env, onFailure } = {}) {
  const config = buildDatabaseConfig(env);
  if (!config) return null;

  return new RuntimeEventStore({
    pool: new Pool({
      ...config,
      max: 2,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    }),
    onFailure,
  });
}

module.exports = {
  RuntimeEventStore,
  buildDatabaseConfig,
  createRuntimeEventStore,
};
