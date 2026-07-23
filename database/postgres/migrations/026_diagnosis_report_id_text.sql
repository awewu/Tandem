-- 026_diagnosis_report_id_text.sql
-- 修正 004 的类型漂移：diagnosis_sessions.report_id 建为 uuid，但问诊域报告号是
-- 人可读的短码（diagnosis-engine.newReportId → 'RND-…'，实体 diagnosis.entity.ts 声明 varchar，
-- 且 025 deposit_orders.report_id 亦为 text）。uuid 列导致公开问诊完成写库 22P02（string_to_uuid）。
-- 以实体/代码为准，将列对齐为 text。表当前为空，转换无损。幂等：仅当仍为 uuid 时转换。

SET search_path TO rhautt_nexus, public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'rhautt_nexus'
       AND table_name = 'diagnosis_sessions'
       AND column_name = 'report_id'
       AND data_type = 'uuid'
  ) THEN
    ALTER TABLE rhautt_nexus.diagnosis_sessions
      ALTER COLUMN report_id TYPE text USING report_id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS diagnosis_sessions_report_id_idx
  ON rhautt_nexus.diagnosis_sessions (tenant_id, report_id);
