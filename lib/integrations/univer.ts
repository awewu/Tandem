/**
 * Univer · 表格 (Excel 替代)
 *
 * Univer (https://univer.ai) 是国产开源 SheetJS 替代, MIT.
 *
 * 启用步骤:
 *   1. npm i @univerjs/preset-sheets-core @univerjs/core
 *   2. 在 components/sheet/UniverSheet.tsx 引入
 *
 * 用途:
 *   - OKR / TTI 批量编辑 (类 Excel 体验)
 *   - 9 宫格底层数据导出
 *   - 自定义报表
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SheetData {
  workbookId: string;
  sheets: { id: string; name: string; cellData: Record<string, unknown> }[];
}

/**
 * Excel/CSV 导出 (服务端调用)
 */
export async function exportToExcel(data: SheetData): Promise<Buffer> {
  // 占位: 真实使用 @univerjs/server-toolkit
  return Buffer.from('stub');
}

/**
 * Excel 导入解析
 */
export async function importFromExcel(buf: Buffer): Promise<SheetData> {
  return { workbookId: `stub_${Date.now()}`, sheets: [] };
}
