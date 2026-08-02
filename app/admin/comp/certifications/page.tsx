'use client';

/**
 * /admin/comp/certifications — HR 技能认证审批台
 *
 * 查看待审批认证列表, 通过/驳回。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Award, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CertRow {
  id: string;
  employeeId: string;
  familyId: string;
  skillId: string;
  skillName: string;
  status: string;
  evidence: string | null;
  certifiedAt: string | null;
}

export default function CompCertificationsPage() {
  const [rows, setRows] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/comp/admin/certifications', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRows(j.rows ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(id: string, approved: boolean) {
    try {
      const r = await fetch('/api/comp/admin/certifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certId: id, approved }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMsg(approved ? '已通过认证' : '已驳回');
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          技能认证审批
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          员工提交案例佐证/证书 → HR 审批通过后计入已认证技能工资
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}
      {msg && <Card className="border-success/30 bg-success/5"><CardContent className="py-2 text-caption text-success">{msg}</CardContent></Card>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">待审批 ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-10">暂无待审批认证</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1.5">员工</th>
                  <th className="text-left font-medium py-1.5">岗族</th>
                  <th className="text-left font-medium py-1.5">技能</th>
                  <th className="text-left font-medium py-1.5">证据</th>
                  <th className="text-center font-medium py-1.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1.5">{r.employeeId}</td>
                    <td className="py-1.5 text-muted-foreground">{r.familyId}</td>
                    <td className="py-1.5 font-medium">{r.skillName}</td>
                    <td className="py-1.5 max-w-[300px] truncate text-muted-foreground">{r.evidence ?? '—'}</td>
                    <td className="text-center py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] text-success" onClick={() => review(r.id, true)}>
                          <Check className="w-3 h-3" /> 通过
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] text-danger" onClick={() => review(r.id, false)}>
                          <X className="w-3 h-3" /> 驳回
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
