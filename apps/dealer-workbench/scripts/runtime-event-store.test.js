const assert = require('node:assert/strict');
const test = require('node:test');

const { RuntimeEventStore, buildDatabaseConfig } = require('./runtime-event-store');

test('buildDatabaseConfig prefers a connection string and can be disabled', () => {
  assert.deepEqual(buildDatabaseConfig({ DATABASE_URL: 'postgres://runtime' }), {
    connectionString: 'postgres://runtime',
  });
  assert.equal(
    buildDatabaseConfig({
      DATABASE_URL: 'postgres://runtime',
      RUNTIME_LOG_DATABASE_ENABLED: 'false',
    }),
    null
  );
});

test('RuntimeEventStore writes a structured process event and closes the pool', async () => {
  const calls = [];
  let closed = false;
  const pool = {
    query(sql, params) {
      calls.push({ sql, params });
      return Promise.resolve();
    },
    end() {
      closed = true;
      return Promise.resolve();
    },
  };
  const store = new RuntimeEventStore({ pool });

  await store.record({
    instanceId: 'instance-1',
    serviceName: 'dealer-workbench',
    environment: 'development',
    eventType: 'child_started',
    severity: 'info',
    parentPid: 10,
    childPid: 11,
    message: 'Next child started',
    metadata: { port: 4000 },
  });
  await store.close();

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO rhautt_nexus\.runtime_process_events/);
  assert.deepEqual(calls[0].params.slice(0, 5), [
    'instance-1',
    'dealer-workbench',
    'development',
    'child_started',
    'info',
  ]);
  assert.equal(closed, true);
});

test('RuntimeEventStore falls back without rejecting when PostgreSQL is unavailable', async () => {
  const failures = [];
  const store = new RuntimeEventStore({
    pool: {
      query() {
        return Promise.reject(new Error('database unavailable'));
      },
      end() {
        return Promise.resolve();
      },
    },
    onFailure(error) {
      failures.push(error.message);
    },
  });

  await store.record({ eventType: 'heartbeat' });
  await store.close();

  assert.deepEqual(failures, ['database unavailable']);
});

test('RuntimeEventStore detects an unclean previous instance during startup', async () => {
  const calls = [];
  const pool = {
    query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT instance_id/.test(sql)) {
        return Promise.resolve({
          rows: [
            {
              instance_id: 'previous-instance',
              event_type: 'heartbeat',
              occurred_at: new Date('2026-07-15T08:00:00.000Z'),
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    },
    end() {
      return Promise.resolve();
    },
  };
  const store = new RuntimeEventStore({ pool });

  await store.record({
    instanceId: 'new-instance',
    serviceName: 'dealer-workbench',
    environment: 'development',
    eventType: 'process_started',
  });
  await store.close();

  const inserts = calls.filter(({ sql }) => /INSERT INTO/.test(sql));
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].params[3], 'unclean_restart_detected');
  assert.match(inserts[0].params[10], /previous-instance/);
  assert.equal(inserts[1].params[3], 'process_started');
});
