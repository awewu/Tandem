/**
 * 搭子手抄 · A1 从笔记 AI 抽取成数据库草稿行
 *   POST /api/shouchao/databases/:id/extract  body: { noteIds: string[] }
 *   → { draftRows: Array<{ cells }> }  (不落库, 待前端确认后再批量 createRow)
 *
 * 承 megaplan C3: AI 只产草稿, 绝不静默写库。owner 隔离; LLM 未配/失败 → 503。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getDatabase } from '@/lib/shouchao/db-service';
import { getNote } from '@/lib/shouchao/service';
import { buildExtractionJsonSchema, describeProperties, normalizeDraftRows } from '@/lib/shouchao/extract';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

const EXTRACT_SYSTEM = [
  '你是严谨的数据抽取助手。把用户提供的笔记内容抽取成结构化表格行, 严格对齐给定的属性(列)定义。',
  '规则:',
  '1) 每条笔记可产生 0 到多行; 无法结构化的内容不要硬凑。',
  '2) 单选(select)只能用给定候选值之一, 不确定就留空(null)。',
  '3) 多选(multiSelect)只能用候选值, 输出字符串数组。',
  '4) 数字(number)输出纯数字, 日期(date)输出 YYYY-MM-DD。',
  '5) 只输出 JSON, 形如 {"rows":[{"<属性id>": 值, ...}]}, 不要多余解释。',
].join('\n');

async function POSTApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const db = await getDatabase(auth.userId, params.id);
  if (!db) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: { noteIds?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const noteIds = Array.isArray(body.noteIds) ? body.noteIds.filter((x): x is string => typeof x === 'string') : [];
  if (noteIds.length === 0) return NextResponse.json({ error: 'no_notes' }, { status: 400 });

  // owner 隔离: 逐条按 ownerId 取, 越权/不存在的自动剔除
  const notes = (await Promise.all(noteIds.slice(0, 20).map((nid) => getNote(auth.userId, nid)))).filter(
    (n): n is NonNullable<typeof n> => !!n,
  );
  if (notes.length === 0) return NextResponse.json({ error: 'no_notes' }, { status: 400 });

  // 解析 router (与 baseline-guard 同模式, 避免顶层 import boot 链)
  const g = globalThis as {
    __tandem_router__?: { chat?: (r: unknown) => Promise<{ message: { content: unknown } }> };
  };
  let router = g.__tandem_router__;
  if (!router) {
    try {
      const { getRouter } = await import('@/lib/boot');
      router = getRouter() as never;
    } catch {
      router = undefined;
    }
  }
  if (!router?.chat) {
    return NextResponse.json({ error: 'llm_unavailable' }, { status: 503 });
  }

  const notesBlock = notes
    .map((n, i) => `【笔记 ${i + 1}: ${n.title}】\n${(n.content ?? '').slice(0, 4000)}`)
    .join('\n\n');
  const userMsg = [
    '【目标数据库属性(列)】',
    describeProperties(db.properties),
    '\n【待抽取的笔记】',
    notesBlock,
    '\n请把这些笔记抽取成对齐上述属性的行, 按 JSON schema 输出。',
  ].join('\n');

  try {
    const res = await router.chat({
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: userMsg },
      ],
      scenario: 'tool_use',
      maxTokens: 2000,
      temperature: 0.2,
      responseFormat: {
        type: 'json_schema',
        name: 'shouchao_extract_rows',
        strict: true,
        schema: buildExtractionJsonSchema(db.properties),
      },
      metadata: { userId: auth.userId },
    });
    const raw = typeof res.message.content === 'string' ? res.message.content : '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 防御: 抓取首个 {...} 片段再解析
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { rows: [] };
    }
    const rows = (parsed as { rows?: unknown })?.rows;
    const draftRows = normalizeDraftRows(db.properties, rows);
    return NextResponse.json({ draftRows });
  } catch {
    return NextResponse.json({ error: 'extract_failed' }, { status: 502 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/databases/[id]/extract' });
