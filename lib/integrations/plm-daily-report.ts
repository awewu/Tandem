import { createHash } from 'crypto';
import { executeAction, type KrCheckinResult } from '@/lib/ontology';
import { getStore, type TandemStore } from '@/lib/storage/repository';
import type { AuthContext } from '@/lib/auth/require-auth';
import type { CheckIn, Confidence, KeyResult } from '@/lib/types/okr-tti';
import type { DailyReport, DailyReportEntry, DailyReportSourceSystem } from '@/lib/types/daily-report';
import {
  notifyDailyReportCheckInToDepartment,
  type DailyReportDepartmentNotificationResult,
} from '@/lib/daily-report/department-im-notify';

const SCHEMA_VERSION = 'plm.daily-report.v1';
const SOURCE_SYSTEM: DailyReportSourceSystem = 'innovation-studio';

export class DailyReportSyncError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = 'daily_report_sync_error',
  ) {
    super(message);
  }
}

export interface PlmDailyReportEntryInput {
  externalEntryId: string;
  krId: string | null;
  projectCode: string;
  hours: number;
  workType: string;
  content: string;
}

export interface PlmDailyReportInput {
  schemaVersion: typeof SCHEMA_VERSION;
  sourceSystem: DailyReportSourceSystem;
  externalReportId: string;
  reportDate: string;
  replaceExisting: boolean;
  entries: PlmDailyReportEntryInput[];
}

export interface PlmDailyReportSyncResult {
  ok: true;
  reportId: string;
  authorId: string;
  reportDate: string;
  entryCount: number;
  updated: boolean;
  imNotifications: DailyReportDepartmentNotificationResult[];
}

interface PreparedEntry {
  input: PlmDailyReportEntryInput;
  kr: KeyResult | null;
  previous: DailyReportEntry | null;
  reusableCheckInId: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DailyReportSyncError('request body must be a JSON object', 400, 'invalid_body');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DailyReportSyncError(`${field} required`, 400, 'invalid_body');
  }
  return value.trim();
}

function optionalKrId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new DailyReportSyncError('entries[].krId must be string or null', 400, 'invalid_body');
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseDate(value: unknown): string {
  const reportDate = requiredString(value, 'reportDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new DailyReportSyncError('reportDate must be YYYY-MM-DD', 400, 'invalid_body');
  }
  const parsed = new Date(`${reportDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== reportDate) {
    throw new DailyReportSyncError('reportDate is invalid', 400, 'invalid_body');
  }
  return reportDate;
}

function normalizePayload(raw: unknown): PlmDailyReportInput {
  const body = asRecord(raw);
  if (body.schemaVersion !== SCHEMA_VERSION) {
    throw new DailyReportSyncError(`schemaVersion must be ${SCHEMA_VERSION}`, 400, 'invalid_body');
  }
  if (body.sourceSystem !== SOURCE_SYSTEM) {
    throw new DailyReportSyncError(`sourceSystem must be ${SOURCE_SYSTEM}`, 400, 'invalid_body');
  }
  if (typeof body.replaceExisting !== 'boolean') {
    throw new DailyReportSyncError('replaceExisting must be boolean', 400, 'invalid_body');
  }
  if (!Array.isArray(body.entries)) {
    throw new DailyReportSyncError('entries must be an array', 400, 'invalid_body');
  }

  const seenEntryIds = new Set<string>();
  const entries = body.entries.map((entryRaw, index): PlmDailyReportEntryInput => {
    const entry = asRecord(entryRaw);
    const externalEntryId = requiredString(entry.externalEntryId, `entries[${index}].externalEntryId`);
    if (seenEntryIds.has(externalEntryId)) {
      throw new DailyReportSyncError(`duplicate externalEntryId: ${externalEntryId}`, 400, 'invalid_body');
    }
    seenEntryIds.add(externalEntryId);

    const hours = entry.hours;
    if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0) {
      throw new DailyReportSyncError(`entries[${index}].hours must be a non-negative number`, 400, 'invalid_body');
    }

    return {
      externalEntryId,
      krId: optionalKrId(entry.krId),
      projectCode: requiredString(entry.projectCode, `entries[${index}].projectCode`),
      hours,
      workType: requiredString(entry.workType, `entries[${index}].workType`),
      content: requiredString(entry.content, `entries[${index}].content`),
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    sourceSystem: SOURCE_SYSTEM,
    externalReportId: requiredString(body.externalReportId, 'externalReportId'),
    reportDate: parseDate(body.reportDate),
    replaceExisting: body.replaceExisting,
    entries,
  };
}

function dailyReportId(tenantId: string, authorId: string, sourceSystem: string, externalReportId: string): string {
  const hash = createHash('sha256')
    .update([tenantId, authorId, sourceSystem, externalReportId].join('\0'))
    .digest('base64url')
    .slice(0, 24);
  return `daily_${hash}`;
}

function progressPercent(kr: KeyResult): number {
  const range = kr.targetValue - kr.startValue;
  if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  return Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100));
}

function confidenceOf(kr: KeyResult): Confidence {
  return kr.confidence ?? 'on-track';
}

function ensureOwnGeneratedCheckIn(
  checkIn: CheckIn | null,
  expected: { id: string; tenantId: string; authorId: string; krId: string },
): CheckIn | null {
  if (!checkIn) return null;
  const metadata = checkIn as CheckIn & {
    sourceSystem?: string;
    externalReportId?: string;
    externalEntryId?: string;
  };
  const sourceMatches = metadata.sourceSystem === SOURCE_SYSTEM;
  const baseMatches =
    checkIn.id === expected.id &&
    checkIn.scope === 'kr' &&
    checkIn.scopeId === expected.krId &&
    checkIn.authorId === expected.authorId &&
    (checkIn.tenantId ?? 'default') === expected.tenantId;
  return baseMatches && sourceMatches ? checkIn : null;
}

async function prepareEntries(
  store: TandemStore,
  auth: AuthContext,
  payload: PlmDailyReportInput,
  existing: DailyReport | null,
): Promise<PreparedEntry[]> {
  const previousByEntryId = new Map((existing?.entries ?? []).map((entry) => [entry.externalEntryId, entry]));
  const prepared: PreparedEntry[] = [];

  for (const input of payload.entries) {
    const previous = previousByEntryId.get(input.externalEntryId) ?? null;
    if (!input.krId) {
      prepared.push({ input, kr: null, previous, reusableCheckInId: null });
      continue;
    }

    const kr = await store.keyResults.get(input.krId);
    if (!kr || (kr.tenantId ?? 'default') !== auth.tenantId) {
      throw new DailyReportSyncError(`KR not found: ${input.krId}`, 400, 'kr_not_found');
    }
    if (kr.status === 'abandoned') {
      throw new DailyReportSyncError(`KR is abandoned: ${input.krId}`, 400, 'kr_invalid');
    }
    const authorized = kr.ownerId === auth.userId || (kr.coOwnerIds ?? []).includes(auth.userId);
    if (!authorized) {
      throw new DailyReportSyncError(`forbidden for KR: ${input.krId}`, 403, 'kr_forbidden');
    }

    let reusableCheckInId: string | null = null;
    if (previous?.checkInId && previous.krId === input.krId) {
      const existingCheckIn = await store.checkIns.get(previous.checkInId);
      const ownGenerated = ensureOwnGeneratedCheckIn(existingCheckIn, {
        id: previous.checkInId,
        tenantId: auth.tenantId,
        authorId: auth.userId,
        krId: input.krId,
      });
      if (existingCheckIn && !ownGenerated) {
        throw new DailyReportSyncError('existing check-in is not owned by this integration entry', 409, 'checkin_conflict');
      }
      reusableCheckInId = ownGenerated?.id ?? null;
    }

    prepared.push({ input, kr, previous, reusableCheckInId });
  }

  return prepared;
}

async function upsertKrCheckIn(
  auth: AuthContext,
  payload: PlmDailyReportInput,
  entry: PreparedEntry,
): Promise<string> {
  if (!entry.kr) throw new Error('KR entry expected');
  const progress = progressPercent(entry.kr);
  const confidence = confidenceOf(entry.kr);
  const result = await executeAction<KrCheckinResult>(
    'kr.checkin',
    {
      krId: entry.kr.id,
      checkInId: entry.reusableCheckInId ?? undefined,
      progressBefore: progress,
      progressAfter: progress,
      confidenceBefore: confidence,
      confidenceAfter: confidence,
      achievements: entry.input.content,
      blockers: null,
      nextSteps: null,
      visibility: 'private',
      viewerIds: [],
    },
    { actorUserId: auth.userId, isProxy: false, demo: false, tenantId: auth.tenantId },
  );

  if (!result.ok || !result.result?.checkIn) {
    const code = result.blocked?.code;
    const status = code === 'forbidden' ? 403 : code === 'not_found' ? 400 : 400;
    throw new DailyReportSyncError(result.blocked?.reasons.join('; ') ?? 'check-in blocked', status, 'checkin_blocked');
  }

  await getStore().checkIns.update(result.result.checkIn.id, {
    sourceSystem: payload.sourceSystem,
    externalReportId: payload.externalReportId,
    externalEntryId: entry.input.externalEntryId,
  } as Partial<CheckIn>);
  return result.result.checkIn.id;
}

async function deleteRemovedGeneratedCheckIns(
  store: TandemStore,
  auth: AuthContext,
  existing: DailyReport | null,
  nextEntries: DailyReportEntry[],
): Promise<void> {
  if (!existing) return;
  const keepIds = new Set(nextEntries.map((entry) => entry.checkInId).filter(Boolean));
  for (const oldEntry of existing.entries) {
    if (!oldEntry.krId || !oldEntry.checkInId || keepIds.has(oldEntry.checkInId)) continue;
    const checkIn = await store.checkIns.get(oldEntry.checkInId);
    const ownGenerated = ensureOwnGeneratedCheckIn(checkIn, {
      id: oldEntry.checkInId,
      tenantId: auth.tenantId,
      authorId: auth.userId,
      krId: oldEntry.krId,
    });
    if (ownGenerated) await store.checkIns.delete(oldEntry.checkInId);
  }
}

export async function syncPlmDailyReport(
  auth: AuthContext,
  rawBody: unknown,
): Promise<PlmDailyReportSyncResult> {
  const store = getStore();
  const payload = normalizePayload(rawBody);
  const reportId = dailyReportId(auth.tenantId, auth.userId, payload.sourceSystem, payload.externalReportId);
  const existing = await store.dailyReports.get(reportId);
  const prepared = await prepareEntries(store, auth, payload, existing);
  const previousByEntryId = new Map((existing?.entries ?? []).map((entry) => [entry.externalEntryId, entry]));

  const mutate = async () => {
    const now = new Date().toISOString();
    const nextEntriesById = new Map<string, DailyReportEntry>();

    if (!payload.replaceExisting) {
      for (const entry of existing?.entries ?? []) nextEntriesById.set(entry.externalEntryId, entry);
    }

    for (const entry of prepared) {
      const checkInId = entry.kr ? await upsertKrCheckIn(auth, payload, entry) : null;
      nextEntriesById.set(entry.input.externalEntryId, {
        ...entry.input,
        checkInId,
      });
    }

    const nextEntries = Array.from(nextEntriesById.values());
    if (payload.replaceExisting) {
      await deleteRemovedGeneratedCheckIns(store, auth, existing, nextEntries);
    } else {
      for (const entry of prepared) {
        const previous = previousByEntryId.get(entry.input.externalEntryId);
        if (previous?.checkInId && previous.krId && previous.krId !== entry.input.krId) {
          await deleteRemovedGeneratedCheckIns(store, auth, { ...existing!, entries: [previous] }, nextEntries);
        }
      }
    }

    const report: DailyReport = {
      id: reportId,
      tenantId: auth.tenantId,
      authorId: auth.userId,
      sourceSystem: payload.sourceSystem,
      externalReportId: payload.externalReportId,
      reportDate: payload.reportDate,
      entries: nextEntries,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) await store.dailyReports.update(reportId, report);
    else await store.dailyReports.create(report);

    return report;
  };

  const report = store.withMutationTransaction
    ? await store.withMutationTransaction(mutate)
    : await mutate();
  const imNotifications: DailyReportDepartmentNotificationResult[] = [];
  for (const entry of report.entries) {
    if (!entry.krId || !entry.checkInId) continue;
    const checkIn = await store.checkIns.get(entry.checkInId);
    if (!checkIn) continue;
    imNotifications.push(await notifyDailyReportCheckInToDepartment({
      tenantId: auth.tenantId,
      authorId: auth.userId,
      checkIn,
      source: 'plm',
      reportDate: report.reportDate,
    }));
  }

  return {
    ok: true,
    reportId: report.id,
    authorId: report.authorId,
    reportDate: report.reportDate,
    entryCount: report.entries.length,
    updated: Boolean(existing),
    imNotifications,
  };
}

export async function listOwnDailyReports(auth: AuthContext): Promise<DailyReport[]> {
  const reports = await getStore().dailyReports.list({
    tenantId: auth.tenantId,
    authorId: auth.userId,
  });
  return reports.sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1));
}
