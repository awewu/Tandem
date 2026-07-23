-- Platform-level process lifecycle events. These are operational records, not
-- tenant business audit entries, so they intentionally do not use tenant RLS.

CREATE TABLE IF NOT EXISTS rhautt_nexus.runtime_process_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  service_name varchar(100) NOT NULL,
  environment varchar(32) NOT NULL,
  event_type varchar(64) NOT NULL,
  severity varchar(16) NOT NULL
    CHECK (severity IN ('debug', 'info', 'warn', 'error', 'fatal')),
  parent_pid integer,
  child_pid integer,
  exit_code integer,
  signal varchar(32),
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runtime_process_events_service_time_idx
  ON rhautt_nexus.runtime_process_events (service_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS runtime_process_events_instance_time_idx
  ON rhautt_nexus.runtime_process_events (instance_id, occurred_at);
