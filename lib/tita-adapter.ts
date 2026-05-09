/**
 * Tita 适配器 — 用于和 Tita（tita.com）OKR 平台数据互通。
 *
 * 由于 Tita 没有面向第三方开发者公开的 OKR REST API，
 * 本适配器主要走「文件互通」+「HTTP 骨架（待 Tita BD 提供 token 后填实现）」。
 *
 * 三种互通方式：
 *   1. **JSON 全量** — 完整保真，铁山自有格式（推荐铁山-铁山备份）。
 *   2. **CSV 行级** — 每行一个 KR，含其所属 Objective 的字段，
 *                     列名采用 Tita 后台导入模板的中文列头，
 *                     兼容直接导入 Tita 或从 Tita 导出粘贴回来。
 *   3. **HTTP** — TitaHTTPClient 接口，已写好方法签名；当用户拿到 Tita 企业 API
 *                  baseURL/token 后，把对应方法的实现填进去即可。
 */

import type {
  Cycle,
  Person,
  Objective,
  KeyResult,
  CheckIn,
  Initiative,
  OKRComment,
  OKRActivity,
  Confidence,
  ObjectiveStatus,
  KRType,
} from './store';

// =============================================================
// JSON 全量
// =============================================================

export interface TitaSnapshot {
  /** schema version；将来 Tita 改格式时升号 */
  schemaVersion: 1 | 2;
  exportedAt: string;
  source: 'hermes' | 'nanie' | 'tita';
  cycles: Cycle[];
  people: Person[];
  objectives: Objective[];
  keyResults: KeyResult[];
  checkIns: CheckIn[];
  /** v2 新增 */
  initiatives?: Initiative[];
  comments?: OKRComment[];
  activities?: OKRActivity[];
}

export function buildSnapshot(state: {
  cycles: Cycle[];
  people: Person[];
  objectives: Objective[];
  keyResults: KeyResult[];
  checkIns: CheckIn[];
  initiatives?: Initiative[];
  comments?: OKRComment[];
  activities?: OKRActivity[];
}): TitaSnapshot {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    source: 'nanie',
    cycles: state.cycles,
    people: state.people,
    objectives: state.objectives,
    keyResults: state.keyResults,
    checkIns: state.checkIns,
    initiatives: state.initiatives || [],
    comments: state.comments || [],
    activities: state.activities || [],
  };
}

export function parseSnapshot(json: string): TitaSnapshot {
  const obj = JSON.parse(json);
  if (!obj || typeof obj !== 'object') throw new Error('JSON 顶层不是对象');
  if (!Array.isArray(obj.objectives) || !Array.isArray(obj.keyResults)) {
    throw new Error('缺少必需字段 objectives 或 keyResults');
  }
  return obj as TitaSnapshot;
}

// =============================================================
// CSV — Tita 兼容行级格式
// =============================================================

const CSV_HEADERS = [
  '周期', '周期类型', '目标标题', '目标描述', '目标负责人', '上级目标',
  '目标状态', '目标信心', '目标权重', '目标标签',
  'KR标题', 'KR负责人', 'KR类型', '起始值', '当前值', '目标值', '单位', 'KR权重',
  'KR信心', 'KR状态', 'KR截止', 'KR标签',
  // 拿捏 扩展列：行动项（Tita 导入会忽略未识别列）
  '目标行动项', 'KR行动项',
] as const;

const INIT_STATUS_TO_CN: Record<Initiative['status'], string> = {
  'todo': '待办', 'in-progress': '进行中', 'done': '完成', 'blocked': '阻塞', 'cancelled': '取消',
};
const INIT_STATUS_FROM_CN: Record<string, Initiative['status']> = {
  '待办': 'todo', 'todo': 'todo',
  '进行中': 'in-progress', 'in-progress': 'in-progress', 'doing': 'in-progress',
  '完成': 'done', 'done': 'done', '已完成': 'done',
  '阻塞': 'blocked', 'blocked': 'blocked',
  '取消': 'cancelled', 'cancelled': 'cancelled',
};

type CsvRow = Record<(typeof CSV_HEADERS)[number], string>;

const CONFIDENCE_TO_CN: Record<Confidence, string> = {
  'on-track': '正常',
  'at-risk': '有风险',
  'off-track': '严重偏离',
};
const CONFIDENCE_FROM_CN: Record<string, Confidence> = {
  '正常': 'on-track', '良好': 'on-track', 'on-track': 'on-track', 'green': 'on-track', '🟢': 'on-track',
  '有风险': 'at-risk', '风险': 'at-risk', 'at-risk': 'at-risk', 'yellow': 'at-risk', '🟡': 'at-risk',
  '严重偏离': 'off-track', '偏离': 'off-track', 'off-track': 'off-track', 'red': 'off-track', '🔴': 'off-track',
};

const OBJ_STATUS_TO_CN: Record<ObjectiveStatus, string> = {
  draft: '草稿', active: '进行中', paused: '暂停', completed: '已完成', archived: '已归档',
};
const OBJ_STATUS_FROM_CN: Record<string, ObjectiveStatus> = {
  '草稿': 'draft', 'draft': 'draft',
  '进行中': 'active', 'active': 'active', '激活': 'active',
  '暂停': 'paused', 'paused': 'paused',
  '已完成': 'completed', 'completed': 'completed', '完成': 'completed',
  '已归档': 'archived', 'archived': 'archived', '归档': 'archived', '废弃': 'archived',
};

const KR_TYPE_TO_CN: Record<KRType, string> = {
  numeric: '数值', percentage: '百分比', milestone: '里程碑', binary: '是否完成',
};
const KR_TYPE_FROM_CN: Record<string, KRType> = {
  '数值': 'numeric', 'numeric': 'numeric', '数字': 'numeric',
  '百分比': 'percentage', 'percentage': 'percentage', '%': 'percentage',
  '里程碑': 'milestone', 'milestone': 'milestone',
  '是否完成': 'binary', 'binary': 'binary', 'yes/no': 'binary',
};

function csvEscape(v: string): string {
  if (v == null) return '';
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function csvParse(text: string): string[][] {
  // 简易 CSV 解析（支持引号转义、CRLF/LF）
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuote = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuote = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuote = true; i++; continue; }
    if (c === ',') { cur.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function exportTitaCSV(state: {
  cycles: Cycle[];
  people: Person[];
  objectives: Objective[];
  keyResults: KeyResult[];
  initiatives?: Initiative[];
}): string {
  const initiatives = state.initiatives || [];
  const cycleMap = new Map(state.cycles.map((c) => [c.id, c]));
  const personMap = new Map(state.people.map((p) => [p.id, p]));
  const objMap = new Map(state.objectives.map((o) => [o.id, o]));

  const ownerName = (id: string): string => {
    if (id?.startsWith('team:')) return `[团队] ${id.slice(5)}`;
    return personMap.get(id)?.name || id || '';
  };

  const lines: string[] = [];
  lines.push(CSV_HEADERS.join(','));

  for (const obj of state.objectives) {
    const cycle = cycleMap.get(obj.cycleId);
    const parent = obj.parentId ? objMap.get(obj.parentId) : null;
    const krs = state.keyResults.filter((k) => k.objectiveId === obj.id);

    // 打包行动项为 "[状态] 标题" 用 || 拼接
    const packInitiatives = (scope: 'kr' | 'objective', scopeId: string): string =>
      initiatives
        .filter((i) => i.scope === scope && i.scopeId === scopeId)
        .map((i) => `[${INIT_STATUS_TO_CN[i.status]}] ${i.title}`)
        .join(' || ');

    const objInitsPacked = packInitiatives('objective', obj.id);

    if (krs.length === 0) {
      // 无 KR 也输出一行（KR 字段空）
      const row: CsvRow = {
        '周期': cycle?.name || '', '周期类型': cycle?.type || '',
        '目标标题': obj.title, '目标描述': obj.description || '',
        '目标负责人': ownerName(obj.ownerId),
        '上级目标': parent?.title || '',
        '目标状态': OBJ_STATUS_TO_CN[obj.status],
        '目标信心': CONFIDENCE_TO_CN[obj.confidence],
        '目标权重': String(obj.weight),
        '目标标签': obj.tags.join(';'),
        'KR标题': '', 'KR负责人': '', 'KR类型': '',
        '起始值': '', '当前值': '', '目标值': '', '单位': '',
        'KR权重': '', 'KR信心': '', 'KR状态': '', 'KR截止': '', 'KR标签': '',
        '目标行动项': objInitsPacked, 'KR行动项': '',
      };
      lines.push(CSV_HEADERS.map((h) => csvEscape(row[h])).join(','));
      continue;
    }

    krs.forEach((kr, krIdx) => {
      const row: CsvRow = {
        '周期': cycle?.name || '', '周期类型': cycle?.type || '',
        '目标标题': obj.title, '目标描述': obj.description || '',
        '目标负责人': ownerName(obj.ownerId),
        '上级目标': parent?.title || '',
        '目标状态': OBJ_STATUS_TO_CN[obj.status],
        '目标信心': CONFIDENCE_TO_CN[obj.confidence],
        '目标权重': String(obj.weight),
        '目标标签': obj.tags.join(';'),
        'KR标题': kr.title,
        'KR负责人': ownerName(kr.ownerId),
        'KR类型': KR_TYPE_TO_CN[kr.type],
        '起始值': String(kr.startValue),
        '当前值': String(kr.currentValue),
        '目标值': String(kr.targetValue),
        '单位': kr.unit,
        'KR权重': String(kr.weight),
        'KR信心': CONFIDENCE_TO_CN[kr.confidence],
        'KR状态': kr.status,
        'KR截止': kr.dueDate ? new Date(kr.dueDate).toISOString().slice(0, 10) : '',
        'KR标签': kr.tags.join(';'),
        // Objective 级行动项只在首行写（避免重复）
        '目标行动项': krIdx === 0 ? objInitsPacked : '',
        'KR行动项': packInitiatives('kr', kr.id),
      };
      lines.push(CSV_HEADERS.map((h) => csvEscape(row[h])).join(','));
    });
  }

  // 加 BOM 让 Excel 用 UTF-8 打开
  return '\uFEFF' + lines.join('\n');
}

export interface ImportResult {
  cycles: Cycle[];
  people: Person[];
  objectives: Objective[];
  keyResults: KeyResult[];
  initiatives: Initiative[];
  warnings: string[];
}

export function importTitaCSV(
  csvText: string,
  /** 现有 state 用于 owner 名称 → personId 的反查 */
  existing: { people: Person[]; cycles: Cycle[] }
): ImportResult {
  const rows = csvParse(csvText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('CSV 至少要有表头 + 1 行数据');

  const header = rows[0].map((s) => s.trim());
  const idx: Partial<Record<(typeof CSV_HEADERS)[number], number>> = {};
  for (const h of CSV_HEADERS) {
    const i = header.indexOf(h);
    if (i !== -1) idx[h] = i;
  }
  if (idx['目标标题'] == null) {
    throw new Error('CSV 必须包含「目标标题」列；请使用 Tita 标准导出格式');
  }

  const warnings: string[] = [];
  const cycles: Cycle[] = [...existing.cycles];
  const people: Person[] = [...existing.people];
  const objectives: Objective[] = [];
  const keyResults: KeyResult[] = [];
  const initiatives: Initiative[] = [];

  // 索引：相同周期名 → cycleId；相同人员名 → personId；相同目标标题（同周期）→ objId
  const cycleByName = new Map<string, string>();
  for (const c of cycles) cycleByName.set(c.name, c.id);
  const personByName = new Map<string, string>();
  for (const p of people) personByName.set(p.name, p.id);
  const objByKey = new Map<string, string>(); // `${cycleId}::${title}` → objId
  /** 目标级行动项去重：仅首行写，后续重复出现跳过 */
  const seenObjInitsForObj = new Set<string>();

  const ensureCycle = (name: string, type: string): string => {
    if (!name) {
      // 用第一个周期或新建
      if (cycles[0]) return cycles[0].id;
      const id = crypto.randomUUID();
      const c: Cycle = { id, name: '未命名', type: 'quarter', startDate: Date.now(), endDate: Date.now(), isActive: false };
      cycles.push(c); cycleByName.set(c.name, id);
      return id;
    }
    const exist = cycleByName.get(name);
    if (exist) return exist;
    const id = crypto.randomUUID();
    const c: Cycle = {
      id, name,
      type: (['year', 'half', 'quarter', 'month'].includes(type) ? type : 'quarter') as any,
      startDate: Date.now(), endDate: Date.now(), isActive: false,
    };
    cycles.push(c); cycleByName.set(name, id);
    return id;
  };

  const ensurePerson = (display: string): string => {
    if (!display) return 'me';
    if (display.startsWith('[团队]')) return `team:${display.slice(4).trim()}`;
    const exist = personByName.get(display);
    if (exist) return exist;
    const id = crypto.randomUUID();
    people.push({ id, name: display });
    personByName.set(display, id);
    return id;
  };

  const get = (row: string[], key: keyof CsvRow) => {
    const i = idx[key];
    return i == null ? '' : (row[i] || '').trim();
  };

  // 第二轮：先建 Objective（去重），再建 KR
  // 用一个 pendingParents：parent 文本可能在自己之后才出现，最后再补
  const pendingParents: { childId: string; parentTitle: string }[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const cycleName = get(row, '周期');
    const cycleType = get(row, '周期类型');
    const cycleId = ensureCycle(cycleName, cycleType);

    const objTitle = get(row, '目标标题');
    if (!objTitle) {
      warnings.push(`第 ${r + 1} 行：目标标题为空，已跳过`);
      continue;
    }
    const objKey = `${cycleId}::${objTitle}`;
    let objId = objByKey.get(objKey);
    if (!objId) {
      objId = crypto.randomUUID();
      const now = Date.now();
      const obj: Objective = {
        id: objId,
        title: objTitle,
        description: get(row, '目标描述') || undefined,
        cycleId,
        ownerId: ensurePerson(get(row, '目标负责人')),
        parentId: null,
        weight: Number(get(row, '目标权重')) || 100,
        status: OBJ_STATUS_FROM_CN[get(row, '目标状态')] || 'active',
        confidence: CONFIDENCE_FROM_CN[get(row, '目标信心')] || 'on-track',
        visibility: 'public',
        tags: get(row, '目标标签').split(';').map((s) => s.trim()).filter(Boolean),
        progressOverride: null,
        createdAt: now,
        updatedAt: now,
      };
      objectives.push(obj);
      objByKey.set(objKey, objId);
      const parentTitle = get(row, '上级目标');
      if (parentTitle) pendingParents.push({ childId: objId, parentTitle });
    }

    // 解析行动项包 "[状态] 标题 || [状态] 标题"
    const parsePackedInits = (text: string, scope: 'kr' | 'objective', scopeId: string) => {
      if (!text) return;
      const pieces = text.split('||').map((s) => s.trim()).filter(Boolean);
      for (const piece of pieces) {
        const m = /^\[([^\]]+)\]\s*(.+)$/.exec(piece);
        const status = m ? (INIT_STATUS_FROM_CN[m[1].trim()] || 'todo') : 'todo';
        const title = m ? m[2].trim() : piece;
        if (!title) continue;
        const now = Date.now();
        initiatives.push({
          id: crypto.randomUUID(),
          scope, scopeId, title, ownerId: 'me',
          status, priority: 'medium', tags: [],
          createdAt: now, updatedAt: now,
        });
      }
    };

    // 目标级行动项只在首行出现，但依赖 objId 去重
    const objInitsCol = get(row, '目标行动项');
    if (objInitsCol && !seenObjInitsForObj.has(objId)) {
      seenObjInitsForObj.add(objId);
      parsePackedInits(objInitsCol, 'objective', objId);
    }

    // 老 CSV 兼容：单一 "行动项" 列索引
    const legacyInitsIdx = header.indexOf('行动项');
    const legacyInits = legacyInitsIdx === -1 ? '' : (row[legacyInitsIdx] || '').trim();

    const krTitle = get(row, 'KR标题');
    if (!krTitle) {
      if (legacyInits) parsePackedInits(legacyInits, 'objective', objId);
      continue;
    }
    const now = Date.now();
    const kr: KeyResult = {
      id: crypto.randomUUID(),
      objectiveId: objId,
      title: krTitle,
      ownerId: ensurePerson(get(row, 'KR负责人')) || ensurePerson(get(row, '目标负责人')),
      type: KR_TYPE_FROM_CN[get(row, 'KR类型')] || 'numeric',
      startValue: Number(get(row, '起始值')) || 0,
      currentValue: Number(get(row, '当前值')) || 0,
      targetValue: Number(get(row, '目标值')) || 100,
      unit: get(row, '单位') || '',
      weight: Number(get(row, 'KR权重')) || 1,
      confidence: CONFIDENCE_FROM_CN[get(row, 'KR信心')] || 'on-track',
      status: (get(row, 'KR状态') || 'active') as KeyResult['status'],
      dueDate: get(row, 'KR截止') ? new Date(get(row, 'KR截止')).getTime() : undefined,
      tags: get(row, 'KR标签').split(';').map((s) => s.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    };
    keyResults.push(kr);
    // KR 行动项（优先新列，为空则回退到老 "行动项" 列）
    parsePackedInits(get(row, 'KR行动项') || legacyInits, 'kr', kr.id);
  }

  // 补 parent 引用
  for (const { childId, parentTitle } of pendingParents) {
    const parent = objectives.find((o) => o.title === parentTitle);
    if (parent) {
      const child = objectives.find((o) => o.id === childId);
      if (child) child.parentId = parent.id;
    } else {
      warnings.push(`找不到上级目标「${parentTitle}」`);
    }
  }

  return { cycles, people, objectives, keyResults, initiatives, warnings };
}

// =============================================================
// HTTP 客户端骨架（等 Tita 企业 API 信息）
// =============================================================

export interface TitaHTTPConfig {
  baseURL: string;
  /** OAuth Bearer token 或 企业 API Key */
  token: string;
  /** 可选：Tita 企业租户 id */
  tenantId?: string;
}

/**
 * Tita 远程客户端接口约定。
 *
 * 实现策略（待用户提供 Tita 企业 API 文档后填充）：
 *  - 鉴权：Authorization: Bearer <token>，或自定义 X-Tita-Token
 *  - 错误：4xx/5xx 抛 Error，正常返回反序列化对象
 *  - 增量同步：用 updatedSince 字段拉变更
 */
export interface TitaHTTPClient {
  config: TitaHTTPConfig;
  /** 探活 + 鉴权校验 */
  ping(): Promise<{ ok: boolean; tenant?: string; user?: string }>;

  // 拉
  listCycles(): Promise<Cycle[]>;
  listObjectives(opts?: { cycleId?: string; updatedSince?: number }): Promise<Objective[]>;
  listKeyResults(opts?: { objectiveId?: string }): Promise<KeyResult[]>;
  listCheckIns(opts?: { scopeId?: string }): Promise<CheckIn[]>;

  // 推（Tita 不一定全开放写入；写不通时抛 Not Implemented）
  upsertObjective(o: Objective): Promise<Objective>;
  upsertKeyResult(kr: KeyResult): Promise<KeyResult>;
  upsertCheckIn(c: CheckIn): Promise<CheckIn>;
  deleteObjective(titaId: string): Promise<void>;
}

/**
 * 默认实现：尚未对接真实 Tita API。所有方法都抛错。
 *
 * 当用户拿到 Tita 企业 API 文档后，把本类的方法实现替换成真实 fetch 调用即可。
 */
export class UnconfiguredTitaClient implements TitaHTTPClient {
  config: TitaHTTPConfig;
  constructor(config: TitaHTTPConfig) { this.config = config; }
  private nope(method: string): never {
    throw new Error(
      `Tita HTTP API 未对接：${method}。请联系 Tita 客户经理获取企业版 OKR API 文档，` +
      `然后在 lib/tita-adapter.ts 中实现 UnconfiguredTitaClient。`
    );
  }
  ping() { return Promise.reject(new Error('Tita 远程同步未启用：请先在「设置」中配置 baseURL + token')); }
  listCycles() { return this.nope('listCycles'); }
  listObjectives() { return this.nope('listObjectives'); }
  listKeyResults() { return this.nope('listKeyResults'); }
  listCheckIns() { return this.nope('listCheckIns'); }
  upsertObjective() { return this.nope('upsertObjective'); }
  upsertKeyResult() { return this.nope('upsertKeyResult'); }
  upsertCheckIn() { return this.nope('upsertCheckIn'); }
  deleteObjective() { return this.nope('deleteObjective'); }
}

/** 工厂；将来真实实现到位后改这里返回 RealTitaClient(config) */
export function createTitaClient(config: TitaHTTPConfig): TitaHTTPClient {
  return new UnconfiguredTitaClient(config);
}
