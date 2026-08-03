/**
 * PMS · 商机批量导入
 * 支持粘贴 (Excel 复制) 或上传 CSV → 解析预览 → 逐行查重导入 → 结果回执。
 */

'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// 列定义: 中文表头 → 字段。前两列必填。
const COLUMNS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'customerName', label: '客户名称', required: true },
  { key: 'projectName', label: '项目名称', required: true },
  { key: 'customerIndustry', label: '客户行业' },
  { key: 'contactName', label: '联系人' },
  { key: 'contactTitle', label: '职务' },
  { key: 'customerPhone', label: '联系电话' },
  { key: 'customerAddress', label: '项目地址' },
  { key: 'leadSource', label: '线索来源' },
  { key: 'competitors', label: '竞争对手' },
  { key: 'estimatedAmount', label: '预估金额' },
  { key: 'estimatedClosingDate', label: '预计成交日期' },
  { key: 'region', label: '区域' },
  { key: 'channel', label: '渠道' },
  { key: 'dealerOrgId', label: '归属经销商编码' },
];

// 表头别名容错: 常见列名变体 → 标准字段 key
const HEADER_ALIASES: Record<string, string[]> = {
  customerName: ['客户', '客户名', '公司名', '公司名称', '单位名称', '客户单位', 'customer', 'company'],
  projectName: ['项目', '项目名', '工程名称', '项目名字', 'project'],
  customerIndustry: ['行业', 'industry'],
  contactName: ['联系人姓名', '对接人', '联系人名称', 'contact'],
  contactTitle: ['职位', '岗位', 'title'],
  customerPhone: ['电话', '手机', '手机号', '手机号码', '联系方式', 'phone', 'tel', 'mobile'],
  customerAddress: ['地址', '工程地址', '项目位置', 'address'],
  leadSource: ['来源', '商机来源', 'source'],
  competitors: ['竞品', '对手', 'competitor'],
  estimatedAmount: ['金额', '预算', '预计金额', '合同额', '预估金额元', 'amount'],
  estimatedClosingDate: ['成交日期', '预计成交', '预计成交时间', '预计签约', '预计签约日期', 'closingdate', 'date'],
  region: ['大区', '地区', 'region'],
  channel: ['渠道类型', 'channel'],
  dealerOrgId: ['经销商编码', '经销商编号', '经销商', '归属经销商', 'dealer', 'dealerorgid'],
};

/** 归一化表头: 去空白/标点/括号并转小写, 用于容错匹配 */
function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s（）()：:*、,，。·\-_/\\]/g, '');
}

/** 归一化表头 → 标准字段 key (含标准 label 与全部别名) */
const NORM_HEADER_TO_KEY: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const c of COLUMNS) m.set(normalizeHeader(c.label), c.key);
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const a of aliases) m.set(normalizeHeader(a), key);
  }
  return m;
})();

type ParsedRow = Record<string, string>;

interface RowResult {
  index: number;
  customerName: string;
  projectName: string;
  status: 'created' | 'duplicate' | 'error';
  id?: string;
  message?: string;
}

/** 简单 CSV/TSV 行解析 (支持双引号包裹与转义) */
function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        cells.push(cur); cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  });
}

function rowsFromMatrix(matrix: string[][]): ParsedRow[] {
  if (matrix.length === 0) return [];
  const header = matrix[0];
  // 表头映射: 归一化 (标准 label + 别名) → key, 容错列名变体
  const colKeys = header.map((h) => NORM_HEADER_TO_KEY.get(normalizeHeader(h)) ?? '');
  const hasHeader = colKeys.some((k) => k !== '');
  const dataRows = hasHeader ? matrix.slice(1) : matrix;
  const keys = hasHeader ? colKeys : COLUMNS.map((c) => c.key); // 无表头时按固定列序
  return dataRows.map((cells) => {
    const row: ParsedRow = {};
    keys.forEach((k, i) => { if (k) row[k] = cells[i] ?? ''; });
    return row;
  });
}

export default function ImportOpportunitiesPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState('');
  const [defaultDealerOrgId, setDefaultDealerOrgId] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ summary: { total: number; created: number; duplicate: number; error: number }; results: RowResult[] } | null>(null);

  const rows = useMemo(() => rowsFromMatrix(parseDelimited(raw)), [raw]);
  const validCount = rows.filter((r) => (r.customerName || '').trim() && (r.projectName || '').trim()).length;

  function downloadTemplate() {
    const header = COLUMNS.map((c) => c.label).join(',');
    const sample = ['北京协和医院', '门诊楼中央空调采购', '医院', '张工', '设备科长', '13800138000', '北京市东城区', '设计院', '开利、麦克维尔', '5000000', '2026-09-30', '华北', '经销', 'dealer_default'].join(',');
    const blob = new Blob(['\uFEFF' + header + '\n' + sample + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PMS商机导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        // 真正的 Excel 二进制 (ZIP) 不能按文本读, 用 SheetJS 解析首个工作表 → TSV
        const buf = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '', raw: false }) as unknown[][];
        setRaw(matrix.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')).join('\t') : '')).join('\n'));
      } else {
        setRaw(await file.text());
      }
    } catch {
      setError('文件解析失败，请确认是 .xlsx / .xls / .csv，或直接从 Excel 复制粘贴到下方文本框');
    } finally {
      e.target.value = '';
    }
  }

  async function handleImport() {
    if (rows.length === 0) { setError('没有可导入的数据'); return; }
    setImporting(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch('/api/pms/opportunities/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows, defaultDealerOrgId: defaultDealerOrgId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '导入失败');
      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/pms')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回商机列表
        </Button>
        <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-brand-500" />
          批量导入商机
        </h1>
        <p className="text-body text-ink-secondary mt-1">
          从 Excel 复制粘贴，或上传 Excel(.xlsx/.xls)/CSV 文件，系统逐行自动查重后导入。前两列（客户名称、项目名称）必填。
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-headline">1 · 准备数据</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-1" /> 下载模板
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> 上传 Excel/CSV
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={onFile} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-caption text-ink-tertiary">
            列顺序：{COLUMNS.map((c) => c.label + (c.required ? '*' : '')).join(' / ')}
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder="将 Excel 表格连表头一起复制到此处（Tab 分隔），或粘贴 CSV 文本…"
            className="w-full px-3 py-2 border border-border rounded-2xl bg-surface-1 text-ink-primary font-mono text-caption focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-ink-tertiary">默认归属经销商编码</Label>
              <Input
                className="mt-1"
                value={defaultDealerOrgId}
                onChange={(e) => setDefaultDealerOrgId(e.target.value)}
                placeholder="dealer_default（行内未填时使用）"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && !results && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-headline">
              2 · 预览（共 {rows.length} 行，有效 {validCount} 行）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-caption">
                <thead>
                  <tr className="text-ink-tertiary border-b border-border">
                    {COLUMNS.slice(0, 6).map((c) => (
                      <th key={c.key} className="text-left py-2 pr-3 font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => {
                    const valid = (r.customerName || '').trim() && (r.projectName || '').trim();
                    return (
                      <tr key={i} className={`border-b border-border/50 ${valid ? '' : 'bg-danger/5'}`}>
                        {COLUMNS.slice(0, 6).map((c) => (
                          <td key={c.key} className="py-2 pr-3 text-ink-secondary truncate max-w-[160px]">
                            {r[c.key] || (c.required && !r[c.key] ? <span className="text-danger">缺失</span> : '—')}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 20 && <p className="text-caption text-ink-tertiary mt-2">仅预览前 20 行…</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-4 border-danger/30">
          <CardContent className="p-4 text-danger text-caption">{error}</CardContent>
        </Card>
      )}

      {results && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-headline">导入结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="w-4 h-4" /> 成功 {results.summary.created}</span>
              <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="w-4 h-4" /> 撞单跳过 {results.summary.duplicate}</span>
              <span className="inline-flex items-center gap-1 text-danger"><XCircle className="w-4 h-4" /> 失败 {results.summary.error}</span>
              <span className="text-ink-tertiary">共 {results.summary.total} 行</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-caption">
                <thead>
                  <tr className="text-ink-tertiary border-b border-border sticky top-0 bg-surface-1">
                    <th className="text-left py-2 pr-3 font-medium">#</th>
                    <th className="text-left py-2 pr-3 font-medium">客户 / 项目</th>
                    <th className="text-left py-2 pr-3 font-medium">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r) => (
                    <tr key={r.index} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-ink-tertiary">{r.index + 1}</td>
                      <td className="py-2 pr-3 text-ink-secondary">
                        {r.customerName || '—'} · {r.projectName || '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {r.status === 'created' && r.id ? (
                          <a href={`/pms/opportunities/${r.id}`} className="text-success hover:underline">已创建 →</a>
                        ) : r.status === 'duplicate' ? (
                          <span className="text-warning">{r.message || '撞单跳过'}</span>
                        ) : (
                          <span className="text-danger">{r.message || '失败'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setResults(null); setRaw(''); }}>再导入一批</Button>
              <Button size="sm" className="bg-brand-500 hover:bg-brand-600" onClick={() => router.push('/pms')}>返回商机列表</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!results && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.push('/pms')}>取消</Button>
          <Button
            disabled={importing || validCount === 0}
            onClick={handleImport}
            className="bg-brand-500 hover:bg-brand-600"
          >
            {importing ? '导入中...' : `导入 ${validCount} 条商机`}
          </Button>
        </div>
      )}
    </div>
  );
}
