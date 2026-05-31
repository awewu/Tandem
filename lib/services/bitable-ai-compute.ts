/**
 * D-02: 多维表格 AI 计算列 · 行级执行器
 *
 * 战略锚点 (跟飞书的真差异):
 *   - 飞书 bitable 公式 = 写死的 if/sum, 死的
 *   - Tandem AI 列 = LLM 真跑, 能"评估这一行的 OKR 进展"、"打分"、"贴标签"、"提炼亮点"
 *
 * 工作流:
 *   1. 调用方传 tableId + rowId (+ 可选 colIds 子集)
 *   2. 对每个 ai_compute 列, 替换 aiPrompt 里的 {{字段名}} 占位符 → 真实值
 *   3. 调 router.chat (scenario 默认 'high_frequency', model='fast') 或 'reasoning_complex'(standard)
 *   4. 写回 row.data[colId] = BitableAiCellValue
 *
 * 防失控:
 *   - 单次计算超时 30s (provider 自己 abort)
 *   - 输出截断到 800 字 (避免把单元格塞爆)
 *   - 计算失败标 status='error', 不阻断其它列
 */

import { getStore } from '@/lib/storage/repository';
import type { TandemRouter } from '@/lib/taf/router';
import type {
  BitableTable,
  BitableColumn,
  BitableAiCellValue,
} from '@/lib/types/bitable';
import { isAiCellValue } from '@/lib/types/bitable';

const MAX_AI_OUTPUT_CHARS = 800;

export interface ComputeAiCellsResult {
  /** 命中并计算的 AI 单元格数 (含失败) */
  computed: number;
  /** 成功 */
  ok: number;
  /** 失败 */
  failed: number;
  /** 详情 (每个 colId 的最终状态) */
  cells: Array<{ colId: string; status: BitableAiCellValue['status']; value?: string; error?: string }>;
}

/**
 * 把一行的某个/所有 AI 列计算掉, 并写回存储.
 *
 * @param tableId  目标表
 * @param rowId    目标行
 * @param onlyColIds  仅计算这些列 (不传 = 该行所有 ai_compute 列)
 * @param actorUserId  调用者 (用于审计)
 */
export async function computeAiCellsForRow(
  tableId: string,
  rowId: string,
  onlyColIds: string[] | undefined,
  actorUserId: string,
  injectedRouter?: Pick<TandemRouter, 'chat'>,
): Promise<ComputeAiCellsResult> {
  // 懒加载 getRouter, 避免单测时强加载 boot.ts → drizzle 初始化
  const router =
    injectedRouter ?? ((await import('@/lib/boot')).getRouter() as Pick<TandemRouter, 'chat'>);
  const store = getStore();
  const table = await store.bitableTables.get(tableId);
  if (!table) throw new Error('table not found');

  const row = table.rows.find((r) => r.id === rowId);
  if (!row) throw new Error('row not found');

  // 选目标列: ai_compute 类型, 有 aiPrompt
  const aiCols = table.columns.filter(
    (c) =>
      c.type === 'ai_compute' &&
      (c.aiPrompt?.trim()?.length ?? 0) > 0 &&
      (onlyColIds === undefined || onlyColIds.includes(c.id)),
  );

  if (aiCols.length === 0) {
    return { computed: 0, ok: 0, failed: 0, cells: [] };
  }

  const cells: ComputeAiCellsResult['cells'] = [];
  // 先把所有目标 cell 标 running (避免前端轮询时还是上次的值)
  const pendingPatch: Record<string, BitableAiCellValue> = {};
  for (const c of aiCols) {
    pendingPatch[c.id] = { __ai: true, status: 'running' };
  }
  await patchRowData(table, rowId, pendingPatch);

  // 逐列计算. 单行通常 < 5 个 AI 列, 串行延迟可接受, 也保证写回顺序确定 + 容易测试.
  const finalPatch: Record<string, BitableAiCellValue> = {};
  let ok = 0;
  let failed = 0;
  for (const col of aiCols) {
    const result = await computeOneCell(router, table, row.data, col, actorUserId);
    finalPatch[result.colId] = result.cell;
    if (result.cell.status === 'ok') ok++;
    else failed++;
    cells.push({
      colId: result.colId,
      status: result.cell.status,
      value: result.cell.value,
      error: result.cell.error,
    });
  }
  // 写最终结果 (合并: 不动其它字段)
  const fresh = await store.bitableTables.get(tableId);
  if (fresh) {
    await patchRowData(fresh, rowId, finalPatch);
  }

  return { computed: aiCols.length, ok, failed, cells };
}

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

async function computeOneCell(
  router: Pick<TandemRouter, 'chat'>,
  table: BitableTable,
  rowData: Record<string, unknown>,
  col: BitableColumn,
  actorUserId: string,
): Promise<{ colId: string; cell: BitableAiCellValue }> {
  const prompt = renderPrompt(col.aiPrompt ?? '', table.columns, rowData);
  const scenario = col.aiModel === 'standard' ? 'reasoning_complex' : 'high_frequency';
  try {
    const res = await router.chat({
      messages: [
        {
          role: 'system',
          content:
            '你是数据助手, 根据用户提供的"列名: 值"上下文, 严格按提示词指令计算一个简短输出 (1-3 句, 中文). 不要解释推理过程, 直接给结论.',
        },
        { role: 'user', content: prompt },
      ],
      scenario,
      temperature: 0.3,
      maxTokens: 300,
      metadata: { userId: actorUserId, requestId: `bitable:${table.id}:${col.id}` },
    });
    const raw = res.message?.content ?? '';
    const trimmed = (typeof raw === 'string' ? raw : String(raw))
      .trim()
      .slice(0, MAX_AI_OUTPUT_CHARS);
    return {
      colId: col.id,
      cell: {
        __ai: true,
        status: 'ok',
        value: trimmed,
        computedAt: new Date().toISOString(),
        model: res.model,
      },
    };
  } catch (err) {
    return {
      colId: col.id,
      cell: {
        __ai: true,
        status: 'error',
        error: err instanceof Error ? err.message.slice(0, 300) : 'compute failed',
        computedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * 占位符渲染. 支持 `{{字段名}}` 和 `{{字段ID}}` 两种 (字段名优先).
 * AI 单元格值 (object) 自动展开为 .value.
 */
function renderPrompt(
  template: string,
  columns: BitableColumn[],
  rowData: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, raw: string) => {
    const key = raw.trim();
    const col = columns.find((c) => c.name === key || c.id === key);
    if (!col) return `(未知字段:${key})`;
    const v = rowData[col.id];
    if (isAiCellValue(v)) return v.value ?? '';
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  });
}

async function patchRowData(
  table: BitableTable,
  rowId: string,
  patch: Record<string, BitableAiCellValue>,
): Promise<void> {
  const store = getStore();
  const now = new Date().toISOString();
  const rows = table.rows.map((r) =>
    r.id === rowId ? { ...r, data: { ...r.data, ...patch }, updatedAt: now } : r,
  );
  await store.bitableTables.update(table.id, { rows, updatedAt: now });
}

