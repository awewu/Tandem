'use client';

/**
 * <ExcelImportExport /> · KPI 模块 Excel 导入/导出复用组件
 *
 * 用于 /admin/kpi/subjects 和 /admin/kpi/setup.
 *
 * Props:
 *   - exportUrl: 导出 GET URL (含 query)
 *   - importUrl: 导入 POST URL (会自动追加 ?dryRun=1 做预览)
 *   - exportFilename: 下载文件名
 *   - label: 实体名 (科目 / KPI)
 *   - onImported?: 导入成功后回调 (供 page 刷新)
 *
 * 流程:
 *   1. 选文件 → 自动 dryRun
 *   2. 展示行级结果 (ok/failed/errors)
 *   3. 全部 ok → "确认导入" 按钮可点 → 真实导入
 *   4. 有 failed → 仅能"取消" 或选其他文件
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Upload, AlertCircle, CheckCircle2, FileSpreadsheet, X } from 'lucide-react';

interface RowResult {
  row: number;
  ok: boolean;
  errors: string[];
  createdId?: string;
}

interface ImportSummary {
  total: number;
  ok: number;
  failed: number;
  rows: RowResult[];
  dryRun: boolean;
}

interface Props {
  exportUrl: string;
  importUrl: string;
  exportFilename?: string;
  label: string;
  /** 调用方决定是否禁用 (如 cycle.status !== draft) */
  importDisabled?: boolean;
  importDisabledReason?: string;
  onImported?: () => void;
}

export function ExcelImportExport({
  exportUrl,
  importUrl,
  exportFilename,
  label,
  importDisabled,
  importDisabledReason,
  onImported,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [committed, setCommitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ------- Export -------

  const onExport = async () => {
    setBusy(true);
    try {
      const r = await fetch(exportUrl);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        exportFilename ?? `${label}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`导出失败: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // ------- Import (2-step: dry-run → commit) -------

  const reset = () => {
    setFile(null);
    setSummary(null);
    setError(null);
    setCommitted(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openDialog = () => {
    reset();
    setDialogOpen(true);
  };

  const onSelectFile = async (f: File) => {
    setFile(f);
    setSummary(null);
    setError(null);
    setCommitted(false);
    await doImport(f, true);
  };

  const doImport = async (f: File, dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const sep = importUrl.includes('?') ? '&' : '?';
      const url = dryRun ? `${importUrl}${sep}dryRun=1` : importUrl;
      const r = await fetch(url, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setSummary(j as ImportSummary);
      if (!dryRun) {
        setCommitted(true);
        onImported?.();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canCommit = summary?.dryRun === true && summary.failed === 0 && summary.ok > 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void onExport()} disabled={busy}>
          <Download className="h-4 w-4 mr-1" />
          导出
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={openDialog}
          disabled={busy || importDisabled}
          title={importDisabled ? importDisabledReason : ''}
        >
          <Upload className="h-4 w-4 mr-1" />
          导入
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              导入 {label} (Excel)
            </DialogTitle>
            <DialogDescription>
              先做 dry-run 预览, 确认无错误后再提交. 用导出文件作为模板可保证列对齐.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="block">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={busy || committed}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onSelectFile(f);
                }}
                className="block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:font-medium hover:file:bg-accent"
              />
            </label>

            {file && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {file.name} ({Math.round(file.size / 1024)} KB)
                <button
                  type="button"
                  onClick={reset}
                  className="text-rose-500 hover:underline"
                  disabled={busy}
                >
                  <X className="h-3 w-3 inline" />
                  清除
                </button>
              </div>
            )}

            {error && (
              <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-md flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {summary && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    ok {summary.ok}
                  </Badge>
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                    failed {summary.failed}
                  </Badge>
                  <Badge variant="outline">合计 {summary.total}</Badge>
                  {summary.dryRun ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      预览 (未落库)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      已落库
                    </Badge>
                  )}
                </div>

                {summary.failed > 0 && (
                  <div className="border border-rose-200 bg-rose-50 rounded-md p-2 max-h-64 overflow-y-auto">
                    <div className="text-xs text-rose-700 font-medium mb-1">失败行明细:</div>
                    <table className="w-full text-xs">
                      <tbody>
                        {summary.rows
                          .filter((r) => !r.ok)
                          .map((r) => (
                            <tr key={r.row} className="border-b border-rose-200/50 last:border-0">
                              <td className="py-1 pr-2 font-mono text-rose-700 align-top w-12">
                                行 {r.row}
                              </td>
                              <td className="py-1 text-rose-700">
                                {r.errors.map((er, i) => (
                                  <div key={i}>· {er}</div>
                                ))}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {committed && summary.ok > 0 && (
                  <div className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    {summary.ok} 条 {label} 已导入
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              {committed ? '关闭' : '取消'}
            </Button>
            {canCommit && file && (
              <Button onClick={() => void doImport(file, false)} disabled={busy}>
                {busy ? '导入中…' : `确认导入 ${summary?.ok} 条`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
