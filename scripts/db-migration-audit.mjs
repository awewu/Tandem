/**
 * Read-only audit: compare what drizzle migrations 0002-0005 EXPECT to create
 * against what actually exists in the live PostgreSQL DB.
 *
 * Reports per migration: missing tables, missing columns, missing indexes,
 * and stale indexes (ones 0004 was supposed to DROP but still linger).
 *
 * Pure SELECTs against information_schema / pg_indexes — never mutates.
 * Usage:  node scripts/db-migration-audit.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}
let url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
try { const u = new URL(url); if (u.searchParams.has('schema')) u.searchParams.delete('schema'); url = u.toString(); } catch {}

// ── Expected inventory (extracted from drizzle/migrations/0002-0005) ──
const EXPECTED = {
  '0002_real_kat_farrell': {
    tables: {
      AuditLog: ['id','action','actorId','targetId','targetType','metadata','timestamp','hash','prevHash','tenantId','seq'],
      LaunchpadApp: ['id','category','name','description','iconUrl','url','ssoMode','ssoConfig','visibleTo','visibleToRoles','order','recommendKeywords','unreadAdapter','status','tenantId','createdAt','updatedAt'],
      LaunchpadClick: ['id','appId','userId','clickedAt','source','tenantId'],
    },
    indexes: ['AuditLog_action_idx','AuditLog_actorId_idx','AuditLog_targetId_idx','AuditLog_timestamp_idx','AuditLog_tenant_seq_idx','LaunchpadApp_category_idx','LaunchpadApp_tenantId_idx','LaunchpadApp_status_idx','LaunchpadClick_appId_idx','LaunchpadClick_userId_idx','LaunchpadClick_clickedAt_idx'],
    droppedIndexes: [],
  },
  '0003_spooky_nuke': {
    tables: {
      LlmUsageLog: ['id','userId','tenantId','scenario','provider','model','tokensIn','tokensOut','latencyMs','costMicroUsd','requestId','success','errorMessage','createdAt'],
      UsageEvent: ['id','userId','tenantId','eventName','props','sessionId','userAgent','createdAt'],
    },
    indexes: ['LlmUsageLog_scenario_idx','LlmUsageLog_provider_idx','LlmUsageLog_userId_idx','LlmUsageLog_createdAt_idx','UsageEvent_eventName_idx','UsageEvent_userId_idx','UsageEvent_createdAt_idx'],
    droppedIndexes: [],
  },
  '0004_normal_champions': {
    tables: {
      Certification: ['id','userId','courseId','enrollmentId','earnedAt','expiresAt','status','certNo','contentHashAtEarning','signedBy','unlockedDelegationLevel','unlockedProficiencyBoost','tenantId','createdAt'],
      Course: ['id','title','slug','category','modeAffinity','level','estMinutes','description','coverUrl','ownerUserId','createdByUserId','reviewedByUserIds','status','publishedAt','requirement','proficiencyReward','bossCaptureBonus','unlocksDelegationLevel','lockOnExpiry','version','contentHash','tenantId','createdAt','updatedAt','deletedAt'],
      CourseAssignment: ['id','courseId','targetType','targetUserId','targetDepartmentId','targetRole','assignedByUserId','reason','dueInDays','reminderPolicy','blocksUntilCompletion','status','tenantId','createdAt','updatedAt'],
      Enrollment: ['id','userId','courseId','source','assignmentId','status','enrolledAt','startedAt','completedAt','dueAt','lessonsCompleted','totalScore','tenantId'],
      LearningMcpToken: ['id','userId','name','tokenHash','scopes','rateLimitPerHour','expiresAt','lastUsedAt','totalCalls','revokedAt','tenantId','createdAt'],
      Lesson: ['id','courseId','orderIdx','title','type','estMinutes','contentMarkdown','contentVideoUrl','contentInteractiveSchema','aiGeneratedAt','aiSourceId','aiReviewedBy','passCondition','linkedKrId','rewardMode','rewardScore','tenantId','createdAt','updatedAt'],
      LessonAttempt: ['id','enrollmentId','userId','lessonId','attemptNo','startedAt','submittedAt','timeSpentSec','answers','score','passed','closureExecuted','closureEffects','tenantId','createdAt'],
      Question: ['id','lessonId','orderIdx','type','prompt','options','rubric','correctAnswerExplanation','decisionContext','rightAnswerType','weight','tenantId','createdAt','updatedAt'],
    },
    indexes: ['Certification_userId_status_idx','Certification_courseId_earnedAt_idx','Certification_certNo_idx','Course_slug_tenant_uniq','Course_status_category_idx','Course_requirement_idx','Course_tenant_idx','CourseAssignment_targetUserId_idx','CourseAssignment_targetDepartmentId_idx','CourseAssignment_courseId_idx','Enrollment_userId_status_idx','Enrollment_courseId_status_idx','Enrollment_user_course_tenant_uniq','LearningMcpToken_userId_revokedAt_idx','LearningMcpToken_tokenHash_idx','Lesson_courseId_orderIdx','Lesson_tenant_idx','LessonAttempt_userId_lessonId_idx','LessonAttempt_enrollmentId_idx','Question_lessonId_orderIdx','LlmUsageLog_tenant_created_idx','UsageEvent_tenant_user_idx'],
    droppedIndexes: ['LlmUsageLog_tenantId_idx','LlmUsageLog_requestId_idx','UsageEvent_tenantId_idx'],
  },
  '0005_kpi_typed_tables': {
    tables: {
      KpiCycle: ['id','fiscalYear','name','startDate','endDate','status','tenantId','targetsLockedAt','closedAt','createdBy','createdAt','updatedAt'],
      KpiSubject: ['id','parentId','code','name','description','bscPerspective','level','defaultScope','defaultUnit','defaultMeasureType','active','tenantId','createdBy','createdAt','updatedAt'],
      Kpi: ['id','cycleId','subjectId','bscPerspective','level','parentKpiId','assigneeId','departmentId','title','description','measureType','startValue','targetValue','currentValue','unit','weight','dataSource','scope','tenantId','createdBy','createdAt','updatedAt'],
      KpiCheckIn: ['id','kpiId','asOf','cumulativeValue','delta','source','note','createdBy','tenantId','createdAt'],
      KpiSnapshot: ['id','kpiId','date','cumulativeValue','source','breakdown','tenantId','createdAt'],
      KpiManualEntry: ['id','kpiId','operatorId','operatorRole','fromValue','toValue','reason','evidenceUrl','tenantId','createdAt'],
      KpiBonusPayout: ['id','cycleId','assigneeId','baseBonus','weightedCompletion','finalBonus','contributions','calculatedAt','calculatedBy','committed','committedAt','note','tenantId'],
      KpiCausalLink: ['id','cycleId','fromKpiId','toKpiId','strength','hypothesis','validated','validatedAt','validatedBy','validationNote','tenantId','createdBy','createdAt','updatedAt'],
    },
    indexes: ['KpiCycle_tenantId_status_idx','KpiCycle_fiscalYear_idx','KpiSubject_code_tenant_uniq','KpiSubject_parentId_idx','KpiSubject_bscPerspective_idx','KpiSubject_active_tenant_idx','Kpi_cycleId_level_scope_idx','Kpi_assigneeId_cycleId_idx','Kpi_parentKpiId_idx','Kpi_departmentId_cycleId_idx','Kpi_bscPerspective_cycleId_idx','Kpi_tenantId_idx','KpiCheckIn_kpiId_asOf_idx','KpiCheckIn_tenantId_idx','KpiSnapshot_kpiId_date_idx','KpiSnapshot_kpiId_date_uniq','KpiSnapshot_tenantId_date_idx','KpiManualEntry_kpiId_operatorId_idx','KpiManualEntry_kpiId_createdAt_idx','KpiManualEntry_tenantId_idx','KpiBonusPayout_cycleId_assigneeId_idx','KpiBonusPayout_committed_cycleId_idx','KpiBonusPayout_tenantId_idx','KpiCausalLink_fromKpiId_cycleId_idx','KpiCausalLink_toKpiId_cycleId_idx','KpiCausalLink_from_to_cycle_uniq','KpiCausalLink_tenantId_idx'],
    droppedIndexes: [],
  },
};

const client = new pg.Client({ connectionString: url });
await client.connect();

const liveTables = new Set((await client.query(
  `SELECT tablename FROM pg_tables WHERE schemaname='public'`,
)).rows.map((r) => r.tablename));
const liveIndexes = new Set((await client.query(
  `SELECT indexname FROM pg_indexes WHERE schemaname='public'`,
)).rows.map((r) => r.indexname));

async function colsOf(table) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return new Set(r.rows.map((x) => x.column_name));
}

let totalProblems = 0;
for (const [mig, spec] of Object.entries(EXPECTED)) {
  const lines = [];
  for (const [t, cols] of Object.entries(spec.tables)) {
    if (!liveTables.has(t)) {
      lines.push(`  ✗ TABLE MISSING: ${t} (+ all ${cols.length} cols, indexes)`);
      continue;
    }
    const live = await colsOf(t);
    const missingCols = cols.filter((c) => !live.has(c));
    if (missingCols.length) lines.push(`  ⚠ ${t}: missing columns [${missingCols.join(', ')}]`);
  }
  for (const idx of spec.indexes) {
    if (!liveIndexes.has(idx)) lines.push(`  ⚠ INDEX MISSING: ${idx}`);
  }
  for (const idx of spec.droppedIndexes) {
    if (liveIndexes.has(idx)) lines.push(`  ⚠ STALE INDEX (should have been dropped): ${idx}`);
  }
  totalProblems += lines.length;
  console.log(`\n[${mig}]`);
  console.log(lines.length ? lines.join('\n') : '  ✓ fully present (tables, columns, indexes match)');
}

await client.end();
console.log(`\n${'='.repeat(48)}`);
console.log(totalProblems === 0 ? '✓ NO DRIFT — DB matches migrations 0002-0005.' : `✗ ${totalProblems} drift item(s) found above.`);
