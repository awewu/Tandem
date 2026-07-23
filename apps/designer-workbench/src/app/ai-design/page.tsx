'use client';

import { useState } from 'react';
import '../globals.css';

export default function AiDesignPage() {
  const [projectId, setProjectId] = useState('demo-project');
  const [systems, setSystems] = useState('freshAir,heating');
  const [requirement, setRequirement] = useState('三房两厅，地暖+新风');
  const [proposal, setProposal] = useState<any>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [gateResult, setGateResult] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const pushLog = (label: string, payload: any) => setLog((prev) => [...prev, { at: new Date().toLocaleTimeString(), label, payload }]);

  const propose = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/ai-design/propose', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          systems: systems.split(',').filter(Boolean),
          naturalLanguageRequirement: requirement,
          floorPlan: { placeholder: true },
        }),
      });
      const json = await res.json();
      setProposal(json);
      pushLog('propose', json);
    } catch (err: any) {
      pushLog('propose-error', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!proposal) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v2/ai-design/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal: proposal?.data ?? proposal }),
      });
      const json = await res.json();
      setProposal(json);
      pushLog('verify', json);
    } catch (err: any) {
      pushLog('verify-error', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const review = async () => {
    if (!calcResult || !gateResult) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v2/ai-design/review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, calcResult, gateResult }),
      });
      const json = await res.json();
      pushLog('review', json);
    } catch (err: any) {
      pushLog('review-error', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const selectQuote = async () => {
    if (!proposal) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v2/ai-design/select-quote', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, proposal: proposal?.data ?? proposal, lockMinutes: 30 }),
      });
      const json = await res.json();
      pushLog('select-quote', json);
    } catch (err: any) {
      pushLog('select-quote-error', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="dw-page">
      <header className="dw-topbar">
        <div>
          <div className="dw-h1">Sprint 4 · AI 设计引擎</div>
          <div className="dw-sub">AI 设计建议 · 方案校验 · LLM 复核 · 报价联动</div>
        </div>
        <a className="dw-link" href="/">← 返回工作台</a>
      </header>

      <div className="dw-grid">
        <section className="dw-card">
          <div className="dw-h2">方案输入</div>
          <label className="dw-label">项目 ID</label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="dw-input"
            placeholder="projectId"
          />
          <label className="dw-label">系统范围</label>
          <input
            type="text"
            value={systems}
            onChange={(e) => setSystems(e.target.value)}
            className="dw-input"
            placeholder="freshAir,heating"
          />
          <label className="dw-label">自然语言需求</label>
          <input
            type="text"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            className="dw-input"
            placeholder="自然语言需求"
          />

          <button onClick={propose} className="dw-btn dw-btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={loading}>
            {loading ? '生成中…' : '4.3 生成方案'}
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={verify} className="dw-btn" disabled={loading || !proposal}>
              4.1 确认方案
            </button>
            <button onClick={selectQuote} className="dw-btn" disabled={loading || !proposal}>
              4.5 生成报价
            </button>
          </div>

          <div className="dw-h2" style={{ marginTop: 22 }}>复核输入</div>
          <label className="dw-label">calcResult JSON</label>
          <input
            type="text"
            value={JSON.stringify(calcResult ?? {})}
            onChange={(e) => setCalcResult(e.target.value ? JSON.parse(e.target.value) : null)}
            className="dw-input"
            placeholder="calcResult JSON"
          />
          <label className="dw-label">gateResult JSON</label>
          <input
            type="text"
            value={JSON.stringify(gateResult ?? {})}
            onChange={(e) => setGateResult(e.target.value ? JSON.parse(e.target.value) : null)}
            className="dw-input"
            placeholder="gateResult JSON"
          />
          <button onClick={review} className="dw-btn" style={{ marginTop: 10 }} disabled={loading || !calcResult || !gateResult}>
            4.4 LLM 复核
          </button>
        </section>

        <section className="dw-card">
          <div className="dw-h2">执行日志</div>
          <pre style={{ minHeight: 420, margin: 0, padding: 12, borderRadius: 8, background: 'var(--surface-hover)', color: 'var(--ink-2)', fontSize: 12, lineHeight: 1.6, overflow: 'auto' }}>
            {log.length === 0 ? '点击按钮开始' : JSON.stringify(log, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
