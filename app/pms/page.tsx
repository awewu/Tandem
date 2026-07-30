/**
 * PMS · 商机管理主页
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Filter, Upload, Download } from 'lucide-react';

interface Opportunity {
  id: string;
  customerName: string;
  projectName: string;
  stage: string;
  status: string;
  estimatedAmount: number;
  dealerOrgId: string;
  createdAt: string;
  contactName?: string;
  contactTitle?: string;
  leadSource?: string;
  region?: string;
  customerIndustry?: string;
  competitors?: string[];
}

type ImportRow = Partial<{
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

interface ImportResult {
  total: number;
  success: number;
  failed: Array<{ row: number; reason: string }>;
}

const STAGE_LABELS: Record<string, string> = {
  initial_contact: '初步接触',
  reported: '已报备',
  following: '跟进中',
  visit: '拜访',
  proposal: '方案',
  bidding: '招标',
  quote: '报价',
  quoted: '已报价',
  quotation: '报价',
  negotiation: '谈判',
  contract: '签约',
  contracted: '已签约',
  delivery: '交付',
  delivered: '已交付',
  won: '赢单',
  closed: '已结案',
  lost: '丢单',
};

const STAGE_VALUE_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_LABELS).map(([value, label]) => [label, value]),
);

const STAGE_BADGE_CLASSES: Record<string, string> = {
  initial_contact: 'border-border bg-surface-2 text-ink-secondary',
  reported: 'border-info/20 bg-info/10 text-info',
  following: 'border-brand-500/20 bg-brand-500/10 text-brand-500',
  visit: 'border-brand-500/20 bg-brand-500/10 text-brand-500',
  proposal: 'border-warning/20 bg-warning/10 text-warning',
  bidding: 'border-warning/20 bg-warning/10 text-warning',
  quote: 'border-warning/20 bg-warning/10 text-warning',
  quoted: 'border-warning/20 bg-warning/10 text-warning',
  quotation: 'border-warning/20 bg-warning/10 text-warning',
  negotiation: 'border-warning/20 bg-warning/10 text-warning',
  contract: 'border-success/20 bg-success/10 text-success',
  contracted: 'border-success/20 bg-success/10 text-success',
  delivery: 'border-success/20 bg-success/10 text-success',
  delivered: 'border-success/20 bg-success/10 text-success',
  won: 'border-success/20 bg-success/10 text-success',
  closed: 'border-surface-3 bg-surface-2 text-ink-tertiary',
  lost: 'border-danger/20 bg-danger/10 text-danger',
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function stageBadgeClass(stage: string): string {
  return STAGE_BADGE_CLASSES[stage] ?? 'border-border bg-surface-2 text-ink-secondary';
}

const IMPORT_HEADERS = [
  '客户名称*',
  '项目名称*',
  '客户电话',
  '客户地址',
  '联系人(选填)',
  '职务(选填)',
  '线索来源',
  '客户行业',
  '区域',
  '渠道',
  '产品线',
  '预估金额',
  '阶段',
  '归属经销商(内部代报)',
];

const HEADER_MAP: Record<string, keyof ImportRow> = {
  客户名称: 'customerName',
  '客户名称*': 'customerName',
  customerName: 'customerName',
  项目名称: 'projectName',
  '项目名称*': 'projectName',
  projectName: 'projectName',
  客户电话: 'customerPhone',
  customerPhone: 'customerPhone',
  客户地址: 'customerAddress',
  customerAddress: 'customerAddress',
  联系人: 'contactName',
  contactName: 'contactName',
  职务: 'contactTitle',
  contactTitle: 'contactTitle',
  线索来源: 'leadSource',
  leadSource: 'leadSource',
  客户行业: 'customerIndustry',
  customerIndustry: 'customerIndustry',
  区域: 'region',
  region: 'region',
  渠道: 'channel',
  channel: 'channel',
  产品线: 'productLine',
  productLine: 'productLine',
  预估金额: 'estimatedAmount',
  estimatedAmount: 'estimatedAmount',
  阶段: 'stage',
  stage: 'stage',
  归属经销商: 'dealerOrgName',
  '归属经销商(内部代报)': 'dealerOrgName',
  dealerOrgName: 'dealerOrgName',
  dealerOrgId: 'dealerOrgName',
};

const IMPORT_SAMPLE = `${IMPORT_HEADERS.join('\t')}
上海瑞和酒店\t热水系统改造\t13800138000\t上海市浦东新区世纪大道\t王经理\t工程经理\t展会\t酒店\t华东\t直销\t商用热水\t1200000\t初步接触\t上海瑞和经销商`;

const IMPORT_PLACEHOLDER = `粘贴 Excel 表格或 CSV 内容，第一行必须是表头。
联系人、职务为选填；归属经销商只在内部代报时填写名称，经销商账号可留空。

示例：
客户名称*,项目名称*,客户电话,客户地址,联系人(选填),职务(选填),线索来源,客户行业,区域,渠道,产品线,预估金额,阶段,归属经销商(内部代报)
上海瑞和酒店,热水系统改造,13800138000,上海市浦东新区世纪大道,王经理,工程经理,展会,酒店,华东,直销,商用热水,1200000,初步接触,上海瑞和经销商`;

function normalizeImportHeader(header: string): string {
  return header.trim().replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')');
}

function importFieldForHeader(header: string): keyof ImportRow | undefined {
  const normalized = normalizeImportHeader(header);
  if (HEADER_MAP[normalized]) return HEADER_MAP[normalized];
  if (normalized.startsWith('客户名称')) return 'customerName';
  if (normalized.startsWith('项目名称')) return 'projectName';
  if (normalized.startsWith('联系人')) return 'contactName';
  if (normalized.startsWith('职务')) return 'contactTitle';
  if (normalized.startsWith('归属经销商')) return 'dealerOrgName';
  return undefined;
}

function parseDelimitedRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  const delimiter = text.includes('\t') ? '\t' : ',';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && ch === delimiter) {
      row.push(value.trim());
      value = '';
      continue;
    }
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
      continue;
    }
    value += ch;
  }

  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function rowsToImportRows(rows: string[][]): ImportRow[] {
  if (rows.length <= 1) return [];
  const headers = rows[0].map(importFieldForHeader);
  return rows.slice(1).map((cells) => {
    const item: ImportRow = {};
    cells.forEach((cell, index) => {
      const field = headers[index];
      const value = cell.trim();
      if (!field || !value) return;
      if (field === 'estimatedAmount') {
        const amount = Number(value.replace(/[¥,\s]/g, ''));
        if (!Number.isNaN(amount)) item.estimatedAmount = amount;
      } else if (field === 'stage') {
        item.stage = STAGE_VALUE_BY_LABEL[value] ?? value;
      } else {
        item[field] = value as never;
      }
    });
    return item;
  });
}

async function downloadImportTemplate() {
  const XLSX = await import('xlsx');
  const rows = [
    IMPORT_HEADERS,
    [
      '上海瑞和酒店',
      '热水系统改造',
      '13800138000',
      '上海市浦东新区世纪大道',
      '王经理',
      '工程经理',
      '展会',
      '酒店',
      '华东',
      '直销',
      '商用热水',
      1200000,
      '初步接触',
      '上海瑞和经销商',
    ],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = IMPORT_HEADERS.map((header) => ({
    wch: Math.max(header.length + 4, 14),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '商机导入模板');
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '商机批量导入模板.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export default function PMSPage() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const stageOptions = Array.from(new Set(opportunities.map((o) => o.stage).filter(Boolean)));
  const q = query.trim().toLowerCase();
  const filteredOpps = opportunities.filter((o) => {
    if (stageFilter !== 'all' && o.stage !== stageFilter) return false;
    if (!q) return true;
    return [o.customerName, o.projectName, o.contactName, o.region, o.leadSource]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  });

  useEffect(() => {
    loadOpportunities();
  }, []);

  async function loadOpportunities() {
    try {
      setLoading(true);
      const res = await fetch('/api/pms/opportunities', {
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (!res.ok) throw new Error('Failed to load opportunities');
      
      const data = await res.json();
      setOpportunities(data.opportunities || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateImportText(text: string) {
    setImportText(text);
    setImportRows(rowsToImportRows(parseDelimitedRows(text)));
    setImportResult(null);
  }

  function openImportDialog() {
    setImportText('');
    setImportRows([]);
    setImportResult(null);
    setImportOpen(true);
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    setImportResult(null);
    if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
      const text = rows.map((r) => r.map((v) => String(v ?? '')).join('\t')).join('\n');
      updateImportText(text);
      return;
    }
    updateImportText(await file.text());
  }

  async function submitImport() {
    const rows = importRows.filter((r) => r.customerName || r.projectName);
    const failed: ImportResult['failed'] = [];
    let success = 0;
    setImporting(true);
    setImportResult(null);
    try {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (!row.customerName || !row.projectName) {
          failed.push({ row: index + 2, reason: '客户名称和项目名称必填' });
          continue;
        }
        const res = await fetch('/api/pms/opportunities', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        });
        if (res.ok) {
          success++;
          continue;
        }
        const data = await res.json().catch(() => null);
        failed.push({ row: index + 2, reason: data?.error || '导入失败' });
      }
      setImportResult({ total: rows.length, success, failed });
      await loadOpportunities();
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
          <p className="text-ink-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-danger">加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-ink-secondary">{error}</p>
            <Button onClick={loadOpportunities} className="mt-4">
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary">商机管理</h1>
          <p className="text-body text-ink-secondary mt-1">
            项目报备全生命周期管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={openImportDialog}
            className="rounded-2xl"
          >
            <Upload className="w-4 h-4 mr-2" />
            批量导入
          </Button>
          <Button
            onClick={() => router.push('/pms/opportunities/new')}
            className="bg-brand-500 hover:bg-brand-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建商机
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-tertiary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索客户 / 项目 / 联系人 / 区域 / 线索来源..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-1 text-ink-primary"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-tertiary pointer-events-none" />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="pl-9 pr-8 py-2 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-1 text-ink-primary"
              >
                <option value="all">全部阶段</option>
                {stageOptions.map((s) => (
                  <option key={s} value={s}>{stageLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {opportunities.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-ink-secondary">暂无商机</p>
              <Button
                onClick={() => router.push('/pms/opportunities/new')}
                className="mt-4 bg-brand-500 hover:bg-brand-600"
              >
                创建第一个商机
              </Button>
            </CardContent>
          </Card>
        ) : filteredOpps.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-ink-secondary">没有符合条件的商机</p>
            </CardContent>
          </Card>
        ) : (
          filteredOpps.map((opp) => (
            <Card
              key={opp.id}
              className="cursor-pointer hover:shadow-soft-sm transition-shadow"
              onClick={() => router.push(`/pms/opportunities/${opp.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-headline font-semibold text-ink-primary">
                      {opp.customerName}
                    </h3>
                    <p className="text-body text-ink-secondary mt-1">
                      {opp.projectName}
                    </p>
                    {(opp.contactName || opp.region || opp.leadSource) && (
                      <p className="text-caption text-ink-tertiary mt-1">
                        {[
                          opp.contactName && `联系人 ${opp.contactName}${opp.contactTitle ? `(${opp.contactTitle})` : ''}`,
                          opp.region,
                          opp.leadSource && `来源: ${opp.leadSource}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-2 mt-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-caption font-medium ${stageBadgeClass(opp.stage)}`}>
                        {stageLabel(opp.stage)}
                      </span>
                      {opp.customerIndustry && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-caption bg-surface-2 text-ink-secondary">
                          {opp.customerIndustry}
                        </span>
                      )}
                      {opp.competitors && opp.competitors.length > 0 && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-caption bg-warning/10 text-warning">
                          竞品 {opp.competitors.length}
                        </span>
                      )}
                      <span className="text-caption text-ink-tertiary">
                        {new Date(opp.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-headline font-bold text-brand-500">
                      ¥{opp.estimatedAmount?.toLocaleString()}
                    </p>
                    <p className="text-caption text-ink-tertiary mt-1">
                      预估金额
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量导入商机</DialogTitle>
            <DialogDescription>
              支持上传 Excel / CSV，也可以从 Excel 复制表格后粘贴。必填列为客户名称、项目名称；内部代报时需填写归属经销商ID。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3 md:flex-row md:items-center md:justify-between">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,text/csv,text/tab-separated-values"
                onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
                className="text-caption text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-1 file:px-3 file:py-1.5 file:text-caption file:text-ink-primary"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => void downloadImportTemplate()}>
                <Download className="w-4 h-4 mr-2" />
                下载模板
              </Button>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-caption font-medium text-ink-primary">粘贴数据</span>
                <span className="text-caption text-ink-tertiary">支持 Excel 复制内容 / CSV</span>
              </div>
              <textarea
                value={importText}
                onChange={(e) => updateImportText(e.target.value)}
                placeholder={IMPORT_PLACEHOLDER}
                className="min-h-48 w-full rounded-lg border border-dashed border-border bg-surface-1 p-3 font-mono text-caption text-ink-primary outline-none placeholder:whitespace-pre-line placeholder:text-ink-tertiary focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="rounded-lg border border-border">
              <div className="grid grid-cols-[1fr_1fr_100px_100px] gap-2 border-b border-border bg-surface-2 px-3 py-2 text-caption font-medium text-ink-secondary">
                <span>客户名称</span>
                <span>项目名称</span>
                <span>阶段</span>
                <span>金额</span>
              </div>
              <div className="max-h-40 overflow-auto">
                {importRows.slice(0, 5).map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_100px_100px] gap-2 border-b border-border px-3 py-2 text-caption text-ink-secondary last:border-b-0">
                    <span className="truncate">{row.customerName || '-'}</span>
                    <span className="truncate">{row.projectName || '-'}</span>
                    <span className="truncate">{stageLabel(row.stage || 'initial_contact')}</span>
                    <span className="truncate">{row.estimatedAmount ?? '-'}</span>
                  </div>
                ))}
                {importRows.length === 0 && (
                  <div className="px-3 py-6 text-center text-caption text-ink-tertiary">上传文件或粘贴数据后，这里会显示预览</div>
                )}
              </div>
            </div>

            {importResult && (
              <div className={`rounded-lg border px-3 py-2 text-caption ${importResult.failed.length > 0 ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success'}`}>
                已处理 {importResult.total} 条，成功 {importResult.success} 条，失败 {importResult.failed.length} 条。
                {importResult.failed.length > 0 && (
                  <div className="mt-1 text-ink-secondary">
                    {importResult.failed.slice(0, 3).map((f) => `第 ${f.row} 行: ${f.reason}`).join('；')}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
              关闭
            </Button>
            <Button
              onClick={submitImport}
              disabled={importing || importRows.length === 0}
              className="bg-brand-500 hover:bg-brand-600"
            >
              {importing ? '导入中...' : importRows.length > 0 ? `导入 ${importRows.length} 条` : '导入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
