'use client';

import { useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Play, Download, Upload, MousePointer, LayoutTemplate, Sparkles, Square, Loader2, CheckCircle2, XCircle, Terminal as TerminalIcon, Eye, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { isTauri, startWorkflowRun } from '@/lib/hermes-api';
import { getShowcase, type Showcase } from '@/lib/showcases';

type RunStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

interface NodeRunState {
  status: RunStatus;
  output: string;
  error?: string;
}

type NodeType = 'trigger' | 'agent' | 'tool' | 'condition' | 'output';

interface FlowNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  config: Record<string, string>;
}

interface FlowEdge {
  from: string;
  to: string;
}

const NODE_COLORS: Record<NodeType, string> = {
  trigger: 'bg-info',
  agent: 'bg-purple-500',
  tool: 'bg-orange-500',
  condition: 'bg-yellow-500',
  output: 'bg-success',
};

interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'marketing-automation',
    name: '📢 市场营销活动',
    category: 'Marketing',
    description: '自动化营销：定时触发 → 内容生成 → 质量审核 → 发布 → 分析报告',
    nodes: [
      { id: 't1', type: 'trigger', x: 100, y: 100, label: 'Schedule Trigger', config: { schedule: '0 9 * * 1' } },
      { id: 'a1', type: 'agent', x: 300, y: 100, label: 'Content Generator', config: { agent: 'marketing-agent' } },
      { id: 'c1', type: 'condition', x: 500, y: 100, label: 'Quality Check', config: { condition: 'score > 0.8' } },
      { id: 'a2', type: 'agent', x: 700, y: 60, label: 'Publish Content', config: { agent: 'publisher' } },
      { id: 'a3', type: 'agent', x: 700, y: 140, label: 'Revision', config: { agent: 'editor' } },
      { id: 'o1', type: 'output', x: 900, y: 100, label: 'Analytics Report', config: { format: 'pdf' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'c1' }, { from: 'c1', to: 'a2' }, { from: 'c1', to: 'a3' }, { from: 'a2', to: 'o1' }, { from: 'a3', to: 'a1' }],
  },
  {
    id: 'product-management',
    name: '📦 产品生命周期',
    category: 'Product',
    description: '产品管理流水线：反馈收集 → 需求分析 → 设计 → 开发 → 上线发布',
    nodes: [
      { id: 't1', type: 'trigger', x: 100, y: 100, label: 'Feedback Collection', config: { source: 'slack' } },
      { id: 'a1', type: 'agent', x: 300, y: 100, label: 'PRD Writer', config: { agent: 'product-agent' } },
      { id: 'c1', type: 'condition', x: 500, y: 100, label: 'Priority Check', config: { condition: 'priority == high' } },
      { id: 'a2', type: 'agent', x: 700, y: 60, label: 'UI/UX Design', config: { agent: 'design-agent' } },
      { id: 'a3', type: 'agent', x: 700, y: 140, label: 'Tech Spec', config: { agent: 'tech-lead' } },
      { id: 'o1', type: 'output', x: 900, y: 100, label: 'Launch Package', config: { format: 'github' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'c1' }, { from: 'c1', to: 'a2' }, { from: 'c1', to: 'a3' }, { from: 'a2', to: 'o1' }, { from: 'a3', to: 'o1' }],
  },
  {
    id: 'sales-pipeline',
    name: '💼 销售线索管理',
    category: 'Sales',
    description: '销售自动化：线索捕获 → 评分 → 分配 → 跟进培育 → 成交闭环',
    nodes: [
      { id: 't1', type: 'trigger', x: 100, y: 100, label: 'New Lead', config: { source: 'form' } },
      { id: 'a1', type: 'agent', x: 300, y: 100, label: 'Lead Scorer', config: { agent: 'sales-ai' } },
      { id: 'c1', type: 'condition', x: 500, y: 100, label: 'Score Threshold', config: { condition: 'score >= 70' } },
      { id: 'a2', type: 'agent', x: 700, y: 60, label: 'Assign Rep', config: { agent: 'dispatcher' } },
      { id: 'a3', type: 'agent', x: 700, y: 140, label: 'Auto-nurture', config: { agent: 'nurture-bot' } },
      { id: 'o1', type: 'output', x: 900, y: 60, label: 'CRM Update', config: { format: 'salesforce' } },
      { id: 'o2', type: 'output', x: 900, y: 140, label: 'Weekly Report', config: { format: 'email' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'c1' }, { from: 'c1', to: 'a2' }, { from: 'c1', to: 'a3' }, { from: 'a2', to: 'o1' }, { from: 'a3', to: 'o2' }],
  },
  {
    id: 'document-approval',
    name: '📄 企业审批流程',
    category: 'Enterprise',
    description: '企业文档审批：提交 → 初审 → 复审 → 归档 → 分发',
    nodes: [
      { id: 't1', type: 'trigger', x: 100, y: 100, label: 'Document Submit', config: { source: 'upload' } },
      { id: 'a1', type: 'agent', x: 300, y: 100, label: 'Format Check', config: { agent: 'compliance' } },
      { id: 'c1', type: 'condition', x: 500, y: 100, label: 'Auto-approved?', config: { condition: 'risk < low' } },
      { id: 'a2', type: 'agent', x: 700, y: 60, label: 'Manager Review', config: { agent: 'manager' } },
      { id: 'a3', type: 'agent', x: 700, y: 140, label: 'Legal Review', config: { agent: 'legal' } },
      { id: 'o1', type: 'output', x: 900, y: 100, label: 'Archive & Distribute', config: { format: 'pdf' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'c1' }, { from: 'c1', to: 'o1' }, { from: 'c1', to: 'a2' }, { from: 'a2', to: 'a3' }, { from: 'a3', to: 'o1' }],
  },
  {
    id: 'okr-tracking',
    name: '🎯 OKR 目标追踪',
    category: 'Management',
    description: '目标管理：设定 OKR → 定期检查 → 自动同步 → 生成报告',
    nodes: [
      { id: 't1', type: 'trigger', x: 100, y: 100, label: 'Weekly Check-in', config: { schedule: '0 9 * * 5' } },
      { id: 'a1', type: 'agent', x: 300, y: 100, label: 'Data Collector', config: { agent: 'data-agent' } },
      { id: 'c1', type: 'condition', x: 500, y: 100, label: 'On Track?', config: { condition: 'progress >= 0.7' } },
      { id: 'a2', type: 'agent', x: 700, y: 60, label: 'Alert Manager', config: { agent: 'alert-bot' } },
      { id: 'a3', type: 'agent', x: 700, y: 140, label: 'Generate Report', config: { agent: 'reporter' } },
      { id: 'o1', type: 'output', x: 900, y: 100, label: 'Dashboard Update', config: { format: 'json' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'c1' }, { from: 'c1', to: 'a2' }, { from: 'c1', to: 'a3' }, { from: 'a2', to: 'a3' }, { from: 'a3', to: 'o1' }],
  },
  {
    id: 'master-production',
    name: '🏭 主生产计划 MPS',
    category: 'Manufacturing',
    description: '制造生产计划：需求预测 → 产能规划 → 物料检查 → 排程 → 执行',
    nodes: [
      { id: 't1', type: 'trigger', x: 100, y: 100, label: 'Forecast Update', config: { source: 'erp' } },
      { id: 'a1', type: 'agent', x: 300, y: 60, label: 'Demand Analysis', config: { agent: 'planning-ai' } },
      { id: 'a2', type: 'agent', x: 300, y: 140, label: 'Capacity Check', config: { agent: 'capacity-bot' } },
      { id: 'c1', type: 'condition', x: 500, y: 100, label: 'Feasible?', config: { condition: 'capacity >= demand' } },
      { id: 'a3', type: 'agent', x: 700, y: 60, label: 'Material Planning', config: { agent: 'mpn-agent' } },
      { id: 'a4', type: 'agent', x: 700, y: 140, label: 'Production Schedule', config: { agent: 'scheduler' } },
      { id: 'o1', type: 'output', x: 900, y: 100, label: 'Work Orders', config: { format: 'pdf' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 't1', to: 'a2' }, { from: 'a1', to: 'c1' }, { from: 'a2', to: 'c1' }, { from: 'c1', to: 'a3' }, { from: 'c1', to: 'a4' }, { from: 'a3', to: 'o1' }, { from: 'a4', to: 'o1' }],
  },

  // ======================================================
  // 恒热（Hot Water Expert）业务专属工作流模板
  // 每个模板都附带高质量人工撰写的样板输出（lib/showcases.ts）
  // ======================================================
  {
    id: 'hh-product-launch',
    name: '🚿 恒热新品上市推广',
    category: '恒热 / Hot Water Expert',
    description: '产品上市流水线：定位 → 卖点矩阵 → 渠道分发 → 推广包',
    nodes: [
      { id: 't1', type: 'trigger', x: 80,  y: 100, label: '上市启动', config: { source: 'manual' } },
      { id: 'a1', type: 'agent',   x: 260, y: 100, label: '产品定位',           config: { agent: 'agent-hh-promo' } },
      { id: 'a2', type: 'agent',   x: 460, y: 100, label: '卖点矩阵',           config: { agent: 'agent-hh-promo' } },
      { id: 'a3', type: 'agent',   x: 660, y: 100, label: '渠道分发计划',       config: { agent: 'agent-hh-gtm' } },
      { id: 'o1', type: 'output',  x: 880, y: 100, label: '推广包',             config: { format: 'pdf' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'a2' }, { from: 'a2', to: 'a3' }, { from: 'a3', to: 'o1' }],
  },
  {
    id: 'hh-brand-geo',
    name: '🔍 恒热品牌 GEO 优化',
    category: '恒热 / Hot Water Expert',
    description: '面向 AI 引擎的内容优化：问句矩阵 → SCQA 标准 → 投放清单 → KPI 监测 → 战报',
    nodes: [
      { id: 't1', type: 'trigger', x: 80,  y: 120, label: 'GEO 启动',     config: { source: 'manual' } },
      { id: 'a1', type: 'agent',   x: 260, y: 120, label: '问句矩阵审计', config: { agent: 'agent-hh-geo' } },
      { id: 'a2', type: 'agent',   x: 460, y: 120, label: '内容标准 SCQA', config: { agent: 'agent-hh-geo' } },
      { id: 'a3', type: 'agent',   x: 660, y: 80,  label: '投放渠道清单', config: { agent: 'agent-hh-geo' } },
      { id: 'a4', type: 'agent',   x: 660, y: 160, label: 'KPI 与监测',   config: { agent: 'agent-data-analyst' } },
      { id: 'o1', type: 'output',  x: 880, y: 120, label: 'GEO 战报',     config: { format: 'md' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'a2' }, { from: 'a2', to: 'a3' }, { from: 'a2', to: 'a4' }, { from: 'a3', to: 'o1' }, { from: 'a4', to: 'o1' }],
  },
  {
    id: 'hh-monthly-mps',
    name: '🏭 恒热月度生产主计划',
    category: '恒热 / Hot Water Expert',
    description: '月度 MPS：需求预测 → 产能盘点 → 物料齐套 → 周排产 → 风险对策 → 工单',
    nodes: [
      { id: 't1', type: 'trigger', x: 80,  y: 140, label: '月度计划启动', config: { source: 'erp' } },
      { id: 'a1', type: 'agent',   x: 260, y: 80,  label: '需求预测',     config: { agent: 'agent-hh-mps' } },
      { id: 'a2', type: 'agent',   x: 260, y: 200, label: '产能盘点',     config: { agent: 'agent-hh-mps' } },
      { id: 'a3', type: 'agent',   x: 460, y: 140, label: '物料齐套',     config: { agent: 'agent-hh-mps' } },
      { id: 'a4', type: 'agent',   x: 660, y: 80,  label: '周排产计划',   config: { agent: 'agent-hh-mps' } },
      { id: 'a5', type: 'agent',   x: 660, y: 200, label: '风险与对策',   config: { agent: 'agent-strategy' } },
      { id: 'o1', type: 'output',  x: 880, y: 140, label: '工单包',       config: { format: 'mes' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 't1', to: 'a2' }, { from: 'a1', to: 'a3' }, { from: 'a2', to: 'a3' }, { from: 'a3', to: 'a4' }, { from: 'a3', to: 'a5' }, { from: 'a4', to: 'o1' }, { from: 'a5', to: 'o1' }],
  },
  {
    id: 'hh-video-script',
    name: '🎬 恒热抖音视频脚本',
    category: '恒热 / Hot Water Expert',
    description: '短视频生产链：钩子设计 → 完整分镜 → 封面/标题 → 投放参数 → 拍摄包',
    nodes: [
      { id: 't1', type: 'trigger', x: 80,  y: 120, label: '视频任务',     config: { source: 'manual' } },
      { id: 'a1', type: 'agent',   x: 260, y: 120, label: '钩子设计',     config: { agent: 'agent-hh-video' } },
      { id: 'a2', type: 'agent',   x: 460, y: 120, label: '完整分镜',     config: { agent: 'agent-hh-video' } },
      { id: 'a3', type: 'agent',   x: 660, y: 80,  label: '封面 + 标题',  config: { agent: 'agent-hh-video' } },
      { id: 'a4', type: 'agent',   x: 660, y: 160, label: '投放参数',     config: { agent: 'agent-marketing' } },
      { id: 'o1', type: 'output',  x: 880, y: 120, label: '可拍摄脚本包', config: { format: 'pdf' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'a2' }, { from: 'a2', to: 'a3' }, { from: 'a2', to: 'a4' }, { from: 'a3', to: 'o1' }, { from: 'a4', to: 'o1' }],
  },
  {
    id: 'hh-gtm-sprint',
    name: '🚀 恒热 GTM 6 周冲刺',
    category: '恒热 / Hot Water Expert',
    description: '市场进入 Sprint：细分 → 渠道矩阵 → 价格盘 → 6 周节奏 → KPI → 战报',
    nodes: [
      { id: 't1', type: 'trigger', x: 80,  y: 140, label: 'GTM 启动',      config: { source: 'manual' } },
      { id: 'a1', type: 'agent',   x: 260, y: 140, label: '市场细分',      config: { agent: 'agent-hh-gtm' } },
      { id: 'a2', type: 'agent',   x: 460, y: 80,  label: '渠道矩阵',      config: { agent: 'agent-hh-gtm' } },
      { id: 'a3', type: 'agent',   x: 460, y: 200, label: '价格盘',        config: { agent: 'agent-hh-gtm' } },
      { id: 'a4', type: 'agent',   x: 660, y: 140, label: '6 周 Sprint',   config: { agent: 'agent-hh-gtm' } },
      { id: 'a5', type: 'agent',   x: 860, y: 80,  label: 'KPI 与里程碑',  config: { agent: 'agent-strategy' } },
      { id: 'o1', type: 'output',  x: 860, y: 200, label: 'GTM 战报',      config: { format: 'md' } },
    ],
    edges: [{ from: 't1', to: 'a1' }, { from: 'a1', to: 'a2' }, { from: 'a1', to: 'a3' }, { from: 'a2', to: 'a4' }, { from: 'a3', to: 'a4' }, { from: 'a4', to: 'a5' }, { from: 'a4', to: 'o1' }, { from: 'a5', to: 'o1' }],
  },
];

export default function WorkflowsPage() {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true); // 默认展开模板
  const [showcaseOpen, setShowcaseOpen] = useState<Showcase | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Execution state
  const [running, setRunning] = useState(false);
  const [runStates, setRunStates] = useState<Record<string, NodeRunState>>({});
  const [logLines, setLogLines] = useState<string[]>([]);
  const [showExecPanel, setShowExecPanel] = useState(false);
  const [initialInput, setInitialInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const appendLog = (line: string) =>
    setLogLines((prev) => {
      const next = [...prev, line];
      return next.length > 500 ? next.slice(-500) : next;
    });

  const stopRun = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  };

  const runWorkflow = async () => {
    if (running) return;
    if (nodes.length === 0) {
      appendLog('[error] No nodes to run.');
      return;
    }
    setShowExecPanel(true);
    setRunning(true);
    setLogLines([`[start] Executing ${nodes.length} nodes…`]);
    const initialStates: Record<string, NodeRunState> = {};
    nodes.forEach((n) => (initialStates[n.id] = { status: 'idle', output: '' }));
    setRunStates(initialStates);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const result = await startWorkflowRun({ nodes, edges, initialInput });
      if (result.mode === 'tauri') {
        // Listen for events via Tauri event bus
        const { listen } = await import('@tauri-apps/api/event').catch(() => ({ listen: null as any }));
        if (!listen) throw new Error('Tauri event API unavailable');
        const eventName = `workflow:${result.runId}`;
        const unlisten = await listen(eventName, (msg: any) => {
          const data = msg?.payload || {};
          const ev = data.event || 'message';
          handleEvent(ev, data);
          if (ev === 'done') {
            unlisten?.();
            abortRef.current = null;
            setRunning(false);
          }
        });
        // Set up abort to call unlisten
        ac.signal.addEventListener('abort', () => {
          unlisten?.();
        });
        return; // Tauri path resolves async; don't fall through to finally
      }
      const res = result.response;
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE: split on double-newline
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = block.split('\n');
          let event = 'message';
          let dataStr = '';
          for (const l of lines) {
            if (l.startsWith('event: ')) event = l.slice(7).trim();
            else if (l.startsWith('data: ')) dataStr += l.slice(6);
          }
          if (!dataStr) continue;
          let data: any;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }
          handleEvent(event, data);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendLog(`[error] ${err.message || err}`);
      } else {
        appendLog('[stopped] Aborted by user.');
      }
    } finally {
      if (!isTauri()) {
        setRunning(false);
        abortRef.current = null;
      }
    }
  };

  const handleEvent = (event: string, data: any) => {
    switch (event) {
      case 'plan':
        appendLog(`[plan] ${data.total} nodes ordered`);
        break;
      case 'node:start': {
        const id = data.id;
        appendLog(`[run] ▶ ${data.label} (${data.type})`);
        setRunStates((prev) => ({ ...prev, [id]: { ...(prev[id] || { output: '' }), status: 'running' } }));
        break;
      }
      case 'node:chunk': {
        const id = data.id;
        setRunStates((prev) => ({
          ...prev,
          [id]: {
            status: 'running',
            output: (prev[id]?.output || '') + (data.chunk || ''),
          },
        }));
        break;
      }
      case 'node:done': {
        const id = data.id;
        setRunStates((prev) => ({
          ...prev,
          [id]: { status: 'done', output: data.output || prev[id]?.output || '' },
        }));
        appendLog(`[done] ✓ node ${id.slice(0, 8)} (exit ${data.code ?? 0})`);
        break;
      }
      case 'node:error': {
        const id = data.id;
        setRunStates((prev) => ({
          ...prev,
          [id]: { status: 'error', output: prev[id]?.output || '', error: data.stderr },
        }));
        appendLog(`[error] ✗ node ${id.slice(0, 8)}: ${data.stderr || 'failed'}`);
        break;
      }
      case 'error':
        appendLog(`[error] ${data.message}`);
        break;
      case 'done':
        appendLog(data.ok ? '[end] Workflow completed.' : `[end] Workflow failed at ${data.failedAt || 'unknown'}.`);
        break;
    }
  };

  const loadTemplate = (tpl: WorkflowTemplate) => {
    setNodes(tpl.nodes.map(n => ({ ...n, id: crypto.randomUUID(), config: { ...n.config } })));
    setEdges(tpl.edges.map(e => ({ ...e })));
    setShowTemplates(false);
  };

  const addNode = (type: NodeType) => {
    const id = crypto.randomUUID();
    setNodes((prev) => [...prev, { id, type, x: 100 + prev.length * 30, y: 100 + prev.length * 20, label: type, config: {} }]);
  };

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setSelectedId(null);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setDragging(id);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updateNode(dragging, { x, y });
    },
    [dragging]
  );

  const handleMouseUp = () => setDragging(null);

  const selectedNode = nodes.find((n) => n.id === selectedId);

  const exportFlow = () => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFlow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="w-64 border-r p-4 space-y-4 overflow-auto">
        <h2 className="font-semibold text-caption">工作流构建器</h2>

        <div className="space-y-2">
          <Label className="text-footnote">Initial Input</Label>
          <Input
            placeholder="Optional seed prompt"
            value={initialInput}
            onChange={(e) => setInitialInput(e.target.value)}
            className="h-8 text-footnote"
          />
          {!running ? (
            <Button
              size="sm"
              className="w-full bg-success hover:bg-success text-white"
              onClick={runWorkflow}
              disabled={nodes.length === 0}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              Run Workflow
            </Button>
          ) : (
            <Button size="sm" variant="destructive" className="w-full" onClick={stopRun}>
              <Square className="mr-1 h-3.5 w-3.5" />
              Stop
            </Button>
          )}
          {(logLines.length > 0 || Object.keys(runStates).length > 0) && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-footnote h-7"
              onClick={() => setShowExecPanel((v) => !v)}
            >
              <TerminalIcon className="mr-1 h-3 w-3" />
              {showExecPanel ? 'Hide' : 'Show'} Execution Panel
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {showTemplates ? '收起模板 ▲' : '选择模板 ▼'}
          </Button>

          {showTemplates && (
            <div className="space-y-2 max-h-80 overflow-auto border rounded-md p-2 bg-muted/30">
              {WORKFLOW_TEMPLATES.map((tpl) => {
                const showcase = getShowcase(tpl.id);
                return (
                  <div
                    key={tpl.id}
                    className="p-2 rounded-md hover:bg-muted transition-colors group"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => loadTemplate(tpl)}
                    >
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4 text-primary" />
                        <span className="font-medium text-footnote flex-1">{tpl.name}</span>
                        {showcase && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/10 text-warning dark:bg-warning dark:text-warning font-medium">
                            含样板
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{tpl.category} · {tpl.description}</div>
                    </div>
                    {showcase && (
                      <button
                        type="button"
                        className="mt-1.5 w-full text-[10px] flex items-center justify-center gap-1 py-1 rounded border border-warning/30 dark:border-warning text-warning dark:text-warning hover:bg-warning/5 dark:hover:bg-warning/40 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowcaseOpen(showcase);
                        }}
                      >
                        <Eye className="h-3 w-3" /> 查看样板输出（{showcase.nodes.length} 步）
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-footnote text-muted-foreground mb-1">添加节点</div>
          {([
            { type: 'trigger' as const, label: '触发器' },
            { type: 'agent' as const, label: 'Agent' },
            { type: 'tool' as const, label: '工具' },
            { type: 'condition' as const, label: '条件' },
            { type: 'output' as const, label: '输出' },
          ]).map(({ type, label }) => (
            <Button key={type} variant="outline" size="sm" className="w-full justify-start" onClick={() => addNode(type)}>
              <div className={`w-3 h-3 rounded-full mr-2 ${NODE_COLORS[type]}`} />
              {label}
            </Button>
          ))}
        </div>
        <div className="pt-4 border-t space-y-2">
          <Button variant="secondary" size="sm" className="w-full" onClick={exportFlow}>
            <Download className="mr-1 h-3 w-3" /> Export
          </Button>
          <label className="block">
            <input type="file" accept=".json" className="hidden" onChange={importFlow} />
            <Button variant="secondary" size="sm" className="w-full" asChild>
              <span><Upload className="mr-1 h-3 w-3" /> Import</span>
            </Button>
          </label>
        </div>
        {selectedNode && (
          <div className="pt-4 border-t space-y-3">
            <h3 className="text-caption font-medium">Node Config</h3>
            <div>
              <Label className="text-footnote">Label</Label>
              <Input
                value={selectedNode.label}
                onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                className="h-8 text-caption"
              />
            </div>
            <Button size="sm" variant="destructive" className="w-full" onClick={() => deleteNode(selectedNode.id)}>
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div
          ref={canvasRef}
          className="flex-1 relative bg-muted/20 overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelectedId(null)}
        >
          {nodes.map((node) => {
            const rs = runStates[node.id];
            const status = rs?.status || 'idle';
            const ring =
              status === 'running'
                ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-background animate-pulse'
                : status === 'done'
                  ? 'ring-2 ring-success/50 ring-offset-2 ring-offset-background'
                  : status === 'error'
                    ? 'ring-2 ring-danger/50 ring-offset-2 ring-offset-background'
                    : '';
            return (
              <div
                key={node.id}
                className={cn(
                  'absolute px-3 py-2 rounded-md text-white text-footnote font-medium cursor-move select-none shadow-soft-lg',
                  NODE_COLORS[node.type],
                  selectedId === node.id && !ring && 'ring-2 ring-white',
                  ring
                )}
                data-x={node.x}
                data-y={node.y}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                ref={(el) => {
                  if (el) {
                    el.style.setProperty('--node-x', `${node.x}px`);
                    el.style.setProperty('--node-y', `${node.y}px`);
                    el.style.left = `var(--node-x)`;
                    el.style.top = `var(--node-y)`;
                  }
                }}
              >
                <div className="flex items-center gap-1.5">
                  {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                  {status === 'error' && <XCircle className="h-3 w-3" />}
                  <span>{node.label}</span>
                </div>
              </div>
            );
          })}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MousePointer className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-caption">Add nodes from the sidebar to build a workflow</p>
              </div>
            </div>
          )}
        </div>

        {showExecPanel && (
          <div className="border-t bg-background h-64 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2 text-caption font-medium">
                <TerminalIcon className="h-4 w-4" />
                Execution Log
                {running && <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />}
              </div>
              <div className="flex items-center gap-2 text-footnote text-muted-foreground">
                <span>
                  {Object.values(runStates).filter((s) => s.status === 'done').length} done /
                  {' '}
                  {Object.values(runStates).filter((s) => s.status === 'error').length} err /
                  {' '}
                  {Object.keys(runStates).length} total
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-footnote"
                  onClick={() => {
                    setLogLines([]);
                    setRunStates({});
                  }}
                  disabled={running}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 min-h-0">
              <ScrollArea className="border-r">
                <div className="p-3 font-mono text-footnote space-y-0.5">
                  {logLines.map((l, i) => (
                    <div
                      key={i}
                      className={cn(
                        'whitespace-pre-wrap break-all',
                        l.includes('[error]') && 'text-danger',
                        l.includes('[end]') && 'text-success font-semibold',
                        l.includes('[start]') && 'text-info font-semibold',
                        l.includes('[run]') && 'text-yellow-600',
                        l.includes('[done]') && 'text-success'
                      )}
                    >
                      {l}
                    </div>
                  ))}
                  {logLines.length === 0 && (
                    <div className="text-muted-foreground">No log entries yet.</div>
                  )}
                </div>
              </ScrollArea>
              <ScrollArea>
                <div className="p-3 space-y-2">
                  {nodes.map((n) => {
                    const rs = runStates[n.id];
                    if (!rs || (rs.status === 'idle' && !rs.output)) return null;
                    return (
                      <div key={n.id} className="rounded-md border p-2">
                        <div className="flex items-center gap-2 text-footnote font-medium mb-1">
                          <div className={cn('w-2 h-2 rounded-full', NODE_COLORS[n.type])} />
                          {n.label}
                          <span className="text-[10px] text-muted-foreground">
                            ({rs.status})
                          </span>
                        </div>
                        {rs.output && (
                          <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-32 overflow-auto bg-muted/40 p-2 rounded">
                            {rs.output.slice(0, 2000)}
                            {rs.output.length > 2000 && '\n…'}
                          </pre>
                        )}
                        {rs.error && (
                          <pre className="text-[11px] font-mono text-danger whitespace-pre-wrap break-all max-h-24 overflow-auto mt-1">
                            {rs.error}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                  {Object.keys(runStates).length === 0 && (
                    <div className="text-footnote text-muted-foreground">
                      Per-node outputs will appear here once you click Run.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* 样板输出对话框 — 展示行业专家手写的高质量案例 */}
      <Dialog open={!!showcaseOpen} onOpenChange={(o) => !o && setShowcaseOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
          {showcaseOpen && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-warning" />
                  样板：{showcaseOpen.summary}
                </DialogTitle>
                <DialogDescription className="space-y-2 pt-2">
                  <div className="text-footnote">
                    <span className="font-medium text-foreground">初始输入：</span>
                    <code className="ml-1 px-1.5 py-0.5 rounded bg-muted text-foreground">
                      {showcaseOpen.initialInput}
                    </code>
                  </div>
                  <div className="text-footnote whitespace-pre-line">
                    <span className="font-medium text-foreground">业务背景：</span>
                    {showcaseOpen.context}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 -mx-2 px-2">
                <div className="space-y-4 pb-4">
                  {showcaseOpen.nodes.map((node, idx) => (
                    <div key={node.nodeId} className="border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/60 border-b flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-warning text-white text-footnote flex items-center justify-center font-medium">
                          {idx + 1}
                        </div>
                        <span className="text-caption font-medium">{node.label}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                          {node.nodeId}
                        </span>
                      </div>
                      <pre className="p-3 text-footnote whitespace-pre-wrap break-words font-mono leading-relaxed bg-background">
                        {node.output}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-footnote text-muted-foreground">
                  {showcaseOpen.nodes.length} 步 ·{' '}
                  {showcaseOpen.nodes.reduce((s, n) => s + n.output.length, 0)} 字
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(
                          showcaseOpen.nodes
                            .map((n) => `# ${n.label}\n\n${n.output}`)
                            .join('\n\n---\n\n')
                        )
                        .catch(() => {});
                    }}
                  >
                    复制全部
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === showcaseOpen.templateId);
                      if (tpl) {
                        loadTemplate(tpl);
                        setInitialInput(showcaseOpen.initialInput);
                      }
                      setShowcaseOpen(null);
                    }}
                  >
                    用此模板开始 →
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
