import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseSpreadsheetContent,
  serializeSpreadsheetContent,
  writeSpreadsheetFile,
} from '@/lib/knowledge/spreadsheet-content';

describe('knowledge spreadsheet content', () => {
  const content = `<!-- xlsx · 2表 -->

### Sheet: 资产

名称,价格,购买日期,备注
ThinkPad X1,8999,2026-06-12,"总部仓,待入库"

---

### Sheet: 人员

姓名,部门
张三,研发`;

  it('parses existing searchable Excel text into sheets and cells', () => {
    const workbook = parseSpreadsheetContent(content);
    expect(workbook?.preamble).toBe('<!-- xlsx · 2表 -->');
    expect(workbook?.sheets.map((sheet) => sheet.name)).toEqual(['资产', '人员']);
    expect(workbook?.sheets[0].rows[1]).toEqual([
      'ThinkPad X1', '8999', '2026-06-12', '总部仓,待入库',
    ]);
  });

  it('round-trips edited cells without losing workbook sections', () => {
    const workbook = parseSpreadsheetContent(content)!;
    workbook.sheets[0].rows[1][1] = '9000';
    const reparsed = parseSpreadsheetContent(serializeSpreadsheetContent(workbook));
    expect(reparsed?.sheets).toHaveLength(2);
    expect(reparsed?.sheets[0].rows[1][1]).toBe('9000');
    expect(reparsed?.sheets[0].rows[1][2]).toBe('2026-06-12');
    expect(reparsed?.sheets[0].rows[1][3]).toBe('总部仓,待入库');
  });

  it('writes a valid xlsx file for download', () => {
    const workbook = parseSpreadsheetContent(content)!;
    const bytes = writeSpreadsheetFile(workbook);
    const output = XLSX.read(bytes, { type: 'array' });
    expect(output.SheetNames).toEqual(['资产', '人员']);
    expect(XLSX.utils.sheet_to_json(output.Sheets['资产'], { header: 1 })).toEqual([
      ['名称', '价格', '购买日期', '备注'],
      ['ThinkPad X1', '8999', '2026-06-12', '总部仓,待入库'],
    ]);
  });
});
