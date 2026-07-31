/**
 * lib/memory/output-capture.ts · 产出捕获层 (#17)
 *
 * 对话/交付产出结束后, 后台提炼可复用组织知识 → 落成 MemoryCaptureCandidate 候选。
 * 候选进"待沉淀队列", 由本人/Steward 一键采纳才走 promoteTextToMemory → 三级签批。
 *
 * 设计要点:
 *   - 严格 gate: 只有"足够长 + 含知识信号"的产出才烧一次 LLM 提炼 (省成本/防噪声)。
 *   - 去重: 提炼结果与既有组织记忆做词面相似比对, 高度重复直接丢弃, 中度重复入队但标注。
 *   - 有界: 单次 LLM 调用, maxTokens 700, 最多保留 3 条候选。
 *   - fail-soft: 任何异常都返回"未捕获", 绝不抛、绝不阻塞主回复 (调用方 fire-and-forget)。
 *   - 诚实边界: 只"发现 + 建议", 绝不自动 proposePromotion / 写组织记忆。
 */

import { getStore, generateId } from '../storage/repository';
import { CompositeRetriever } from './retriever';
import type {
  CaptureLevel,
  CaptureProposedType,
  CaptureSource,
  MemoryCaptureCandidate,
} from './capture-types';

const MIN_TEXT_LENGTH = 160;
const LONG_TEXT_LENGTH = 500;
const MIN_CONFIDENCE = 0.6;
const MAX_CANDIDATES = 3;
/** 去重阈值: 高于 SKIP 视为已存在直接丢弃; 高于 FLAG 入队但标注疑似重复 */
const DEDUP_SKIP_SIM = 0.82;
const DEDUP_FLAG_SIM = 0.55;

/** 知识信号词 (产出含这些才值得提炼; 与长度门槛二选一) */
const CAPTURE_SIGNAL_RE =
  /方案|结论|复盘|总结|经验|教训|流程|步骤|规范|标准|SOP|最佳实践|决定|原则|清单|框架|方法论|checklist|playbook/i;

const VALID_TYPES: CaptureProposedType[] = ['sop', 'case', 'redline', 'value', 'lesson'];
const VALID_LEVELS: CaptureLevel[] = ['team', 'dept', 'company'];
/** 宪法级类型强制走公司级签批 (与 promotion-flow CONSTITUTIONAL_TYPES 一致) */
const CONSTITUTIONAL_TYPES: CaptureProposedType[] = ['redline', 'value'];

export interface CaptureInput {
  /** 待捕获的工作产出 (通常是 AI 答复正文 / 交付内容) */
  text: string;
  /** 产出者 userId (候选归属其待沉淀队列) */
  authorUserId: string;
  source: CaptureSource;
  tenantId?: string;
  sessionId?: string;
  /** 原始用户提问 (给提炼模型上下文, 不入库) */
  userQuery?: string;
  /** 覆盖门槛 (测试用) */
  minConfidence?: number;
}

export interface CaptureResult {
  captured: boolean;
  candidates: MemoryCaptureCandidate[];
  log: {
    triggerReason: string;
    extracted: number;
    kept: number;
    latencyMs: number;
    checkId: string;
  };
}

export function shouldCapture(text: string): { trigger: boolean; reason: string } {
  const t = (text ?? '').trim();
  if (t.length < MIN_TEXT_LENGTH) return { trigger: false, reason: 'output too short' };
  // 拦截治理阻断/错误块, 不提炼
  if (/^🚫|^⚠️|\[ERROR\]|分身调用失败/.test(t)) {
    return { trigger: false, reason: 'blocked/error output' };
  }
  if (t.length >= LONG_TEXT_LENGTH) return { trigger: true, reason: 'long substantive output' };
  if (CAPTURE_SIGNAL_RE.test(t)) return { trigger: true, reason: 'knowledge-signal keywords' };
  return { trigger: false, reason: 'no knowledge signal' };
}

const EXTRACT_SYSTEM = [
  '你是组织知识「产出捕获」提炼器。输入是一段员工与 AI 协作的产出 (答复/方案/复盘)。',
  '任务: 从中提炼**可复用、可沉淀为组织记忆**的知识点 (0 到 3 条)。只提炼真正有复用价值的,',
  '一次性事务性内容、闲聊、纯个人事项、缺乏普适性的内容一律不提炼。',
  '每条知识点必须自包含 (脱离原对话也能读懂), 用陈述句改写, 不要照抄对话口吻, 不含个人隐私。',
  '严格只输出 JSON, 形如:',
  '{"candidates":[{"title":"简短标题","body":"自包含知识正文","type":"sop|case|redline|value|lesson","level":"team|dept|company","confidence":0.0到1.0,"rationale":"为何可复用"}]}',
  'type 含义: sop=标准流程, case=案例, redline=红线, value=价值观, lesson=经验教训。',
  'level 含义: 适用范围 team=团队 / dept=部门 / company=全公司。拿不准就填 team。',
  '若没有值得沉淀的知识, 返回 {"candidates":[]}。不要编造, 不要输出 JSON 以外任何文字。',
].join('\n');

interface RawCandidate {
  title?: unknown;
  body?: unknown;
  type?: unknown;
  level?: unknown;
  confidence?: unknown;
  rationale?: unknown;
}

function parseCandidates(raw: string): RawCandidate[] {
  if (!raw) return [];
  // 去 code fence
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  // 抓第一个 { ... } JSON 块
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as { candidates?: unknown };
    return Array.isArray(obj.candidates) ? (obj.candidates as RawCandidate[]) : [];
  } catch {
    return [];
  }
}

function normType(v: unknown): CaptureProposedType {
  return VALID_TYPES.includes(v as CaptureProposedType) ? (v as CaptureProposedType) : 'lesson';
}
function normLevel(v: unknown, type: CaptureProposedType): CaptureLevel {
  if (CONSTITUTIONAL_TYPES.includes(type)) return 'company';
  return VALID_LEVELS.includes(v as CaptureLevel) ? (v as CaptureLevel) : 'team';
}
function normConfidence(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * 产出捕获 pass。fail-soft, 永不抛。调用方应 fire-and-forget (不 await 阻塞主回复)。
 */
export async function captureOutputPass(input: CaptureInput): Promise<CaptureResult> {
  const t0 = Date.now();
  const checkId = `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const tenantId = input.tenantId ?? 'default';
  const empty = (reason: string, extracted = 0): CaptureResult => ({
    captured: false,
    candidates: [],
    log: { triggerReason: reason, extracted, kept: 0, latencyMs: Date.now() - t0, checkId },
  });

  const gate = shouldCapture(input.text);
  if (!gate.trigger) return empty(gate.reason);

  try {
    const { getRouter } = await import('../boot');
    const router = getRouter();
    const reply = await router.chat({
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM },
        {
          role: 'user',
          content: `【原始问题】${input.userQuery ?? '(无)'}\n\n【待提炼产出】\n${input.text.slice(0, 4000)}`,
        },
      ],
      scenario: 'high_frequency',
      temperature: 0.2,
      maxTokens: 700,
      metadata: { userId: input.authorUserId, requestId: checkId },
    });

    const content = typeof reply.message.content === 'string' ? reply.message.content : '';
    const raw = parseCandidates(content);
    if (raw.length === 0) return empty(`${gate.reason} → 0 candidates`, 0);

    const minConf = input.minConfidence ?? MIN_CONFIDENCE;
    const retriever = new CompositeRetriever();
    const store = getStore();
    const kept: MemoryCaptureCandidate[] = [];
    const now = new Date().toISOString();

    for (const rc of raw.slice(0, MAX_CANDIDATES)) {
      const title = typeof rc.title === 'string' ? rc.title.trim() : '';
      const body = typeof rc.body === 'string' ? rc.body.trim() : '';
      if (!title || !body) continue;
      const confidence = normConfidence(rc.confidence);
      if (confidence < minConf) continue;
      const proposedType = normType(rc.type);
      const suggestedLevel = normLevel(rc.level, proposedType);

      // 去重: 与既有组织记忆词面比对
      let dedupOfMemoryId: string | undefined;
      try {
        const hits = await retriever.search(`${title} ${body}`, 3);
        const top = hits[0];
        if (top && top.source === 'memory') {
          if (top.similarity >= DEDUP_SKIP_SIM) continue; // 已存在, 丢弃
          if (top.similarity >= DEDUP_FLAG_SIM) dedupOfMemoryId = top.id;
        }
      } catch {
        /* 去重失败不阻断入队 */
      }

      const candidate = await store.memoryCaptureCandidates.create({
        id: generateId('capture'),
        tenantId,
        authorUserId: input.authorUserId,
        source: input.source,
        sessionId: input.sessionId,
        originRef: input.sessionId ? `${input.source}:${input.sessionId}` : undefined,
        title: title.slice(0, 120),
        body,
        proposedType,
        suggestedLevel,
        confidence,
        rationale: typeof rc.rationale === 'string' ? rc.rationale.slice(0, 300) : undefined,
        status: 'pending',
        dedupOfMemoryId,
        createdAt: now,
        updatedAt: now,
      } as MemoryCaptureCandidate);
      kept.push(candidate);
    }

    return {
      captured: kept.length > 0,
      candidates: kept,
      log: {
        triggerReason: gate.reason,
        extracted: raw.length,
        kept: kept.length,
        latencyMs: Date.now() - t0,
        checkId,
      },
    };
  } catch (err) {
    return empty(`${gate.reason} → exception: ${(err as Error).message}`);
  }
}
