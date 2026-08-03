export type ImportRow = Partial<{
  customerName: string;
  projectName: string;
  customerPhone: string;
  customerAddress: string;
  contactName: string;
  contactTitle: string;
  leadSource: string;
  customerIndustry: string;
  region: string;
  channel: string;
  productLine: string;
  estimatedAmount: number;
  stage: string;
  dealerOrgName: string;
}>;

export interface ImportIssue {
  row: number;
  reason: string;
}

export interface ImportResult {
  total: number;
  success: number;
  duplicate: number;
  failed: ImportIssue[];
  notices: ImportIssue[];
}

export interface ImportProgress {
  total: number;
  processed: number;
  batchIndex: number;
  batchCount: number;
}

export interface ImportDuplicateGroup {
  type: 'exact' | 'same_customer_phone' | 'database_exact';
  reason: string;
  rows: number[];
  customerName?: string;
  projectName?: string;
  customerPhone?: string;
  customerAddress?: string;
}

export interface ImportPreflight {
  total: number;
  importable: number;
  duplicate: number;
  failed: number;
  duplicateGroups: ImportDuplicateGroup[];
  duplicateIssues: ImportIssue[];
  validationIssues: ImportIssue[];
}

const DEFAULT_BATCH_SIZE = 500;

interface ImportApiResult {
  summary?: {
    total?: number;
    created?: number;
    duplicate?: number;
    error?: number;
  };
  results?: Array<{
    index: number;
    status: 'created' | 'duplicate' | 'error';
    message?: string;
  }>;
  error?: string;
}

interface ImportServerPreflightResult {
  summary?: {
    total?: number;
    duplicate?: number;
  };
  results?: Array<{
    index: number;
    status: 'pass' | 'duplicate';
    message?: string;
  }>;
  error?: string;
}

interface ImportEntry {
  rowNumber: number;
  row: ImportRow;
}

function normalizeKeyPart(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
}

function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function nonemptyRows(rows: ImportRow[]): ImportEntry[] {
  return rows
    .map((row, index) => ({ rowNumber: index + 2, row }))
    .filter(({ row }) => row.customerName || row.projectName);
}

function exactDuplicateKey(row: ImportRow): string {
  return [
    normalizeKeyPart(row.customerName),
    normalizeKeyPart(row.customerAddress),
    normalizeKeyPart(row.projectName),
  ].join('|');
}

function customerPhoneKey(row: ImportRow): string {
  return [
    normalizeKeyPart(row.customerName),
    normalizePhone(row.customerPhone),
  ].join('|');
}

function groupByKey(entries: ImportEntry[], keyOf: (row: ImportRow) => string): ImportEntry[][] {
  const groups = new Map<string, ImportEntry[]>();
  for (const entry of entries) {
    const key = keyOf(entry.row);
    if (!key || key === '|') continue;
    const group = groups.get(key) || [];
    group.push(entry);
    groups.set(key, group);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

function analyzeOpportunityImportEntries(rows: ImportRow[]): {
  preflight: ImportPreflight;
  importableEntries: ImportEntry[];
} {
  const entries = nonemptyRows(rows);
  const validationIssues = entries
    .filter(({ row }) => !row.customerName || !row.projectName)
    .map(({ rowNumber }) => ({
      row: rowNumber,
      reason: '客户名称和项目名称必填',
    }));
  const invalidRows = new Set(validationIssues.map((issue) => issue.row));
  const validEntries = entries.filter((entry) => !invalidRows.has(entry.rowNumber));
  const duplicateRows = new Map<number, ImportIssue>();

  const exactGroups = groupByKey(validEntries, exactDuplicateKey).map((group) => {
    const first = group[0];
    for (const duplicate of group.slice(1)) {
      duplicateRows.set(duplicate.rowNumber, {
        row: duplicate.rowNumber,
        reason: `文件内重复: 与第 ${first.rowNumber} 行客户/地址/项目相同，已跳过`,
      });
    }
    return {
      type: 'exact' as const,
      reason: '客户名称、客户地址、项目名称完全相同',
      rows: group.map((entry) => entry.rowNumber),
      customerName: first.row.customerName,
      projectName: first.row.projectName,
      customerAddress: first.row.customerAddress,
      customerPhone: first.row.customerPhone,
    };
  });

  const phoneGroups = groupByKey(
    validEntries.filter(({ row }) => normalizePhone(row.customerPhone)),
    customerPhoneKey,
  ).map((group) => {
    const first = group[0];
    for (const duplicate of group.slice(1)) {
      if (!duplicateRows.has(duplicate.rowNumber)) {
        duplicateRows.set(duplicate.rowNumber, {
          row: duplicate.rowNumber,
          reason: `撞单风险: 与第 ${first.rowNumber} 行客户名称和电话相同，系统会判为重复，已跳过`,
        });
      }
    }
    return {
      type: 'same_customer_phone' as const,
      reason: '客户名称和客户电话相同，按系统查重规则会被判为撞单',
      rows: group.map((entry) => entry.rowNumber),
      customerName: first.row.customerName,
      customerPhone: first.row.customerPhone,
    };
  });

  const duplicateIssues = Array.from(duplicateRows.values()).sort((a, b) => a.row - b.row);
  const duplicateRowNumbers = new Set(duplicateIssues.map((issue) => issue.row));
  const importableEntries = validEntries.filter((entry) => !duplicateRowNumbers.has(entry.rowNumber));

  return {
    preflight: {
      total: entries.length,
      importable: importableEntries.length,
      duplicate: duplicateIssues.length,
      failed: validationIssues.length,
      duplicateGroups: [...exactGroups, ...phoneGroups].sort((a, b) => b.rows.length - a.rows.length),
      duplicateIssues,
      validationIssues,
    },
    importableEntries,
  };
}

export function analyzeOpportunityImportRows(rows: ImportRow[]): ImportPreflight {
  return analyzeOpportunityImportEntries(rows).preflight;
}

function mergePreflightWithServerDuplicates(
  local: ReturnType<typeof analyzeOpportunityImportEntries>,
  serverResults: Array<{ index: number; status: 'pass' | 'duplicate'; message?: string }>,
): ReturnType<typeof analyzeOpportunityImportEntries> {
  const serverDuplicateIssues = serverResults
    .filter((result) => result.status === 'duplicate')
    .map((result) => {
      const entry = local.importableEntries[result.index];
      return entry
        ? {
          row: entry.rowNumber,
          reason: result.message || '数据库已存在相同客户/地址/项目，已跳过',
        }
        : null;
    })
    .filter((issue): issue is ImportIssue => !!issue);
  if (serverDuplicateIssues.length === 0) return local;

  const serverDuplicateRows = new Set(serverDuplicateIssues.map((issue) => issue.row));
  return {
    preflight: {
      ...local.preflight,
      importable: local.importableEntries.length - serverDuplicateIssues.length,
      duplicate: local.preflight.duplicate + serverDuplicateIssues.length,
      duplicateIssues: [...local.preflight.duplicateIssues, ...serverDuplicateIssues]
        .sort((a, b) => a.row - b.row),
      duplicateGroups: [
        ...local.preflight.duplicateGroups,
        {
          type: 'database_exact' as const,
          reason: '数据库已存在相同客户/地址/项目',
          rows: serverDuplicateIssues.map((issue) => issue.row),
        },
      ].sort((a, b) => b.rows.length - a.rows.length),
    },
    importableEntries: local.importableEntries.filter((entry) => !serverDuplicateRows.has(entry.rowNumber)),
  };
}

async function preflightServerDuplicates(
  entries: ImportEntry[],
  fetcher: typeof fetch,
  batchSize: number,
): Promise<Array<{ index: number; status: 'pass' | 'duplicate'; message?: string }>> {
  const results: Array<{ index: number; status: 'pass' | 'duplicate'; message?: string }> = [];
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batchEntries = entries.slice(offset, offset + batchSize);
    const res = await fetcher('/api/pms/opportunities/import/preflight', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: batchEntries.map((entry) => entry.row) }),
    });
    const data = await res.json().catch(() => null) as ImportServerPreflightResult | null;
    if (!res.ok) throw new Error(data?.error || '数据库撞单预检失败');
    for (const row of data?.results || []) {
      results.push({
        ...row,
        index: offset + row.index,
      });
    }
  }
  return results;
}

export async function preflightOpportunityImportRows(
  rows: ImportRow[],
  fetcher: typeof fetch = fetch,
  options: { batchSize?: number } = {},
): Promise<ImportPreflight> {
  const local = analyzeOpportunityImportEntries(rows);
  const batchSize = Math.max(1, Math.min(options.batchSize || DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE));
  if (local.importableEntries.length === 0) return local.preflight;
  const serverResults = await preflightServerDuplicates(local.importableEntries, fetcher, batchSize);
  return mergePreflightWithServerDuplicates(local, serverResults).preflight;
}

export async function importOpportunityRows(
  rows: ImportRow[],
  fetcher: typeof fetch = fetch,
  options: {
    batchSize?: number;
    onProgress?: (progress: ImportProgress) => void;
  } = {},
): Promise<ImportResult> {
  const local = analyzeOpportunityImportEntries(rows);
  const batchSize = Math.max(1, Math.min(options.batchSize || DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE));
  const serverResults = local.importableEntries.length > 0
    ? await preflightServerDuplicates(local.importableEntries, fetcher, batchSize)
    : [];
  const { preflight, importableEntries } = mergePreflightWithServerDuplicates(local, serverResults);
  if (preflight.total === 0) {
    return { total: 0, success: 0, duplicate: 0, failed: [], notices: [] };
  }

  const batchCount = Math.ceil(importableEntries.length / batchSize);
  const aggregate: ImportResult = {
    total: preflight.total,
    success: 0,
    duplicate: preflight.duplicate,
    failed: [...preflight.validationIssues],
    notices: [...preflight.duplicateIssues],
  };

  for (let offset = 0; offset < importableEntries.length; offset += batchSize) {
    const batchEntries = importableEntries.slice(offset, offset + batchSize);
    const res = await fetcher('/api/pms/opportunities/import', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: batchEntries.map((entry) => entry.row) }),
    });
    const data = await res.json().catch(() => null) as ImportApiResult | null;

    if (!res.ok) {
      throw new Error(data?.error || `第 ${Math.floor(offset / batchSize) + 1} 批导入失败`);
    }

    const results = data?.results || [];
    aggregate.success += data?.summary?.created ?? results.filter((row) => row.status === 'created').length;
    aggregate.duplicate += data?.summary?.duplicate ?? results.filter((row) => row.status === 'duplicate').length;
    aggregate.failed.push(...results
      .filter((row) => row.status === 'error')
      .map((row) => ({
        row: batchEntries[row.index]?.rowNumber || 0,
        reason: row.message || '导入失败',
      })));
    aggregate.notices.push(...results
      .filter((row) => row.status === 'duplicate')
      .map((row) => ({
        row: batchEntries[row.index]?.rowNumber || 0,
        reason: row.message || '疑似撞单，已跳过',
      })));

    options.onProgress?.({
      total: importableEntries.length,
      processed: Math.min(offset + batchEntries.length, importableEntries.length),
      batchIndex: Math.floor(offset / batchSize) + 1,
      batchCount,
    });
  }

  return aggregate;
}
