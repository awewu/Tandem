'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore, PRESET_AGENTS, PROVIDER_PRESETS, type LLMProvider } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Plus, Trash2, Save, Sparkles, Wrench, Palette, Package, Target, Megaphone, Code, PenLine, BarChart3, Users, MessageSquarePlus, Cloud, KeyRound, Eye, EyeOff, Link2, ArrowRight, X, CheckSquare, Coins, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const AGENT_ICONS: Record<string, React.ElementType> = {
  'agent-designer': Palette,
  'agent-pm': Package,
  'agent-strategy': Target,
  'agent-marketing': Megaphone,
  'agent-tech-lead': Code,
  'agent-writer': PenLine,
  'agent-data-analyst': BarChart3,
  'agent-hr': Users,
};

const AGENT_CATEGORIES: Record<string, { label: string; color: string }> = {
  'agent-designer': { label: '设计', color: 'bg-pink-500' },
  'agent-pm': { label: '产品', color: 'bg-blue-500' },
  'agent-strategy': { label: '战略', color: 'bg-purple-500' },
  'agent-marketing': { label: '市场', color: 'bg-orange-500' },
  'agent-tech-lead': { label: '技术', color: 'bg-success' },
  'agent-writer': { label: '文案', color: 'bg-yellow-500' },
  'agent-data-analyst': { label: '数据', color: 'bg-cyan-500' },
  'agent-hr': { label: '人事', color: 'bg-danger' },
};

const PRESET_SKILLS = [
  'agent-teams-playbook',
  'self-improvement',
  'autoresearch',
  'subagent-driven-development',
  'native-mcp',
];

export default function AgentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { agents, addAgent, updateAgent, deleteAgent } = useAgentStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [headersDraft, setHeadersDraft] = useState<string>('');

  const selected = agents.find((a) => a.id === selectedId);

  const launchAgent = (agentId: string) => {
    router.push(`/chat?agent=${encodeURIComponent(agentId)}`);
  };

  const createAgent = () => {
    if (!newName.trim()) return;
    const id = crypto.randomUUID();
    addAgent({
      id,
      name: newName.trim(),
      model: '',
      skills: [],
      systemPrompt: 'You are a helpful assistant.',
    });
    setShowNew(false);
    setNewName('');
    setSelectedId(id);
  };

  const toggleSkill = (skill: string) => {
    if (!selected) return;
    const has = selected.skills.includes(skill);
    updateAgent(selected.id, {
      skills: has ? selected.skills.filter((s) => s !== skill) : [...selected.skills, skill],
    });
  };

  /** 当前选中 Agent 的 provider，未设置时按 'hermes' 处理 */
  const currentProvider: LLMProvider = selected?.provider ?? { type: 'hermes' };

  const updateProvider = (patch: Partial<LLMProvider>) => {
    if (!selected) return;
    const merged: LLMProvider = { ...currentProvider, ...patch };
    // type=hermes 时清掉 OpenAI 兼容字段，避免脏数据
    if (merged.type === 'hermes') {
      updateAgent(selected.id, { provider: { type: 'hermes' } });
    } else {
      updateAgent(selected.id, { provider: merged });
    }
  };

  const applyProviderPreset = (presetKey: string) => {
    if (!selected) return;
    const preset = PROVIDER_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;

    if (preset.type === 'hermes') {
      updateAgent(selected.id, { provider: { type: 'hermes', presetKey: 'hermes' } });
      return;
    }

    if (preset.type === 'team') {
      updateAgent(selected.id, {
        provider: {
          type: 'team',
          teamProvider: preset.teamProvider ?? '',
          presetKey: preset.key,
        },
        model: preset.defaultModel || selected.model,
      });
      return;
    }

    // openai-compatible (Personal)
    updateAgent(selected.id, {
      provider: {
        type: 'openai-compatible',
        baseURL: preset.baseURL ?? currentProvider.baseURL ?? '',
        apiKey: currentProvider.apiKey ?? '',
        headers: currentProvider.headers,
        presetKey: preset.key,
      },
      model: preset.defaultModel || selected.model,
    });
  };

  const commitHeadersDraft = () => {
    if (!selected) return;
    const text = headersDraft.trim();
    if (!text) {
      updateProvider({ headers: undefined });
      return;
    }
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const cleaned: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'string') cleaned[k] = v;
        }
        updateProvider({ headers: cleaned });
      }
    } catch {
      // 忽略非法 JSON，不写入
    }
  };

  const [viewTab, setViewTab] = useState<'market' | 'workshop'>('market');
  const [activeWarRoomAgentId, setActiveWarRoomAgentId] = useState<string | null>(null);
  const [warRoomDoc, setWarRoomDoc] = useState<string>('');
  const [warRoomChat, setWarRoomChat] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [warRoomInput, setWarRoomInput] = useState<string>('');
  const [isAnlyzing, setIsAnlyzing] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [pushedSuccess, setPushSuccess] = useState<boolean>(false);

  const marketAgents = [
    {
      id: 'market-sla',
      name: '财务对账与 SLA 优化专家',
      desc: '自动诊断系统可用性 SLA，审查服务器带宽超额开销及预算偏差率。平均节省 1.2h / 次。',
      rating: '4.9',
      calls: '1,280',
      icon: Coins,
      color: 'text-rose-500 bg-rose-50 border-rose-200',
      docPreset: '【战略对账单 · SLA 异常审查】\n\n当前可用性: 99.95% (本周目标: 99.99%)\n昨日丢包率: 0.08% (超额卡点)\n服务器带宽均值: 450Mbps (预算超额 15%)\n\n异常诊断报告：\n1. 核心链路发现由于老接口冗余重试导致的连接暴涨，引起 CPU 15% 虚高。\n2. 丢包主要集中在 14:00-16:00 获客买量高峰段。',
      aiInitialMsg: '哈啰！我是公司配置的 SLA 优化专家。我已经加载了左侧的可用性报告。检测到昨日丢包率 0.08% 属于考核红区，你可以写下任何重构或改进思路（例如“下午完成了老接口重构并拦截了异常报错”），我会帮你自动估算 SLA 指标回推建议并一键沉淀。',
    },
    {
      id: 'market-prd',
      name: 'PRD 产品架构 Co-pilot',
      desc: '协助将 5min 日报的原始碎碎念重构为标准的 Product Requirement Document。平均节省 2.5h / 次。',
      rating: '4.8',
      calls: '840',
      icon: Package,
      color: 'text-indigo-500 bg-indigo-50 border-indigo-200',
      docPreset: '# 【PRD 草稿 · 5min 日报 ↔ OKR 智能推流】\n\n## 1. 业务痛点\n当前员工写周报痛苦，拉进度条反人性，主管无法通过干瘪百分比快速对账卡点。\n\n## 2. 解决方案\n引入 AI 每日 5 分钟引导，提炼 Action Plan 反向推流更新，仪表盘实时报警。',
      aiInitialMsg: '我是你的 PRD 智能工作搭子。我已经就位。我们可以针对左侧的 PRD 大纲进行方案深化（例如：“增加一个 24h 人工否决窗口”），我会实时帮你补全用例和交互大纲！',
    },
    {
      id: 'market-legal',
      name: '法务合同审查员 (Contract Guard)',
      desc: '严格审核第三方数据采购合同风险，确保赔偿条款、知识产权及数据合规 §13 底线。平均节省 1.8h / 次。',
      rating: '4.7',
      calls: '620',
      icon: ShieldCheck,
      color: 'text-sky-500 bg-sky-50 border-sky-200',
      docPreset: '【标准数据采购合同 · 风险条款审查草稿】\n\n第一条：乙方授权甲方使用其商业数据库，采购总额 15 万元。\n\n第六条（免责）：若由于不可抗力或系统故障导致数据授权中断，乙方不承担任何赔偿责任，且不退还已支付款项。\n\n第十二条（生物信息）：乙方有权静默采集并监控甲方使用人员的屏幕活动和声纹等生物特征以做合规审计。',
      aiInitialMsg: '你好！我是公司法务专家。我已经对左侧合同进行了首轮诊断。第十二条违反了我们产品宪章 §13.2 的“尊严归员工，不监控生物特征与考勤活动”的底层红线！建议将该条删除或改写。你可以让我出具改写补丁。',
    },
  ];

  const handleSummon = (id: string) => {
    const agent = marketAgents.find(a => a.id === id);
    if (!agent) return;
    setActiveWarRoomAgentId(id);
    setWarRoomDoc(agent.docPreset);
    setWarRoomChat([{ role: 'assistant', content: agent.aiInitialMsg }]);
    setWarRoomInput('');
    setPushSuccess(false);
  };

  const handleWarRoomSend = async () => {
    if (!warRoomInput.trim() || !activeWarRoomAgentId) return;
    const agent = marketAgents.find(a => a.id === activeWarRoomAgentId);
    if (!agent) return;

    const userMsg = warRoomInput.trim();
    setWarRoomChat(prev => [...prev, { role: 'user', content: userMsg }]);
    setWarRoomInput('');
    setIsAnlyzing(true);
    setStreamingText('');

    // 用本地变量累积，避免依赖异步 setState 读旧值
    let accumulated = '';
    let llmError: string | null = null;

    try {
      const res = await fetch('/api/llm-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamProvider: 'claude-opus-4-5',
          systemPrompt: `你现在充当 Tandem 作战室的 ${agent.name} 标准智能体助手。
左侧是当前的业务工作草稿：
"""
${warRoomDoc}
"""

用户提出了协同命令或改写要求："${userMsg}"。
请基于你的人设，针对业务草稿给出具体、深刻的诊断和修改建议，字数控制在 200 字内。`,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // SSE 流式解析
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of frame.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const json = JSON.parse(payload);
              if (typeof json.content === 'string') {
                accumulated += json.content;
                setStreamingText(accumulated);
              } else if (typeof json.error === 'string') {
                llmError = json.error;
              }
            } catch { /* ignore non-JSON frames */ }
          }
        }
      }
    } catch (e) {
      llmError = (e as Error).message;
    } finally {
      setIsAnlyzing(false);
    }

    // 结束后把累积内容写进对话历史；如果失败/为空则诚实标注
    if (accumulated.trim()) {
      setWarRoomChat(prev => [...prev, { role: 'assistant', content: accumulated }]);
    } else {
      const fallbackHint = llmError
        ? `LLM 调用失败（${llmError}）。检查 /docs/AI-SETUP.md 配置 provider 后重试。`
        : 'LLM 未返回内容。请检查 TAF Router 是否注册了 claude-opus-4-5 provider。';
      setWarRoomChat(prev => [...prev, { role: 'assistant', content: `⚠️ ${fallbackHint}` }]);
      toast({ variant: 'destructive', title: 'AI 未响应', description: fallbackHint });
    }
  };

  // 一键沉淀为 Decision Card (P1/P2 闭环)
  const handlePushDecision = async () => {
    if (!activeWarRoomAgentId) return;
    const agent = marketAgents.find(a => a.id === activeWarRoomAgentId);
    if (!agent) return;

    try {
      const res = await fetch('/api/convergence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `来自【${agent.name}】作战室的工作决议`,
          description: warRoomDoc.slice(0, 500),
          // KR 软绑定守门：未明确挂 KR 时必须给 ≥10 字理由
          noKrReason: `来自 ${agent.name} 作战室的协作产物，暂未挂载具体 KR。`,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }
      setPushSuccess(true);
      toast({ variant: 'success', title: '决议已沉淀', description: '已在议事室创建对应决议卡，可在 /convergence 查看。' });
    } catch (e) {
      toast({ variant: 'destructive', title: '沉淀失败', description: (e as Error).message });
    }
  };

  return (
    <div className="flex h-full bg-slate-50/50">
      {/* 侧边栏 (自创 Agent 工作台列表) */}
      <div className="w-72 border-r bg-white flex flex-col shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <Tabs value={viewTab} onValueChange={(v) => { setViewTab(v as 'market' | 'workshop'); setActiveWarRoomAgentId(null); }} className="w-full">
            <TabsList className="grid grid-cols-2 h-8 w-full p-0.5 bg-slate-100">
              <TabsTrigger value="market" className="text-[11px] h-7">🏢 智能体超市</TabsTrigger>
              <TabsTrigger value="workshop" className="text-[11px] h-7">⚙️ 自创 Agent</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ScrollArea className="flex-1 p-2">
          {viewTab === 'market' ? (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                官方标准智能体 (MARKET)
              </div>
              {marketAgents.map((a) => {
                const Icon = a.icon;
                const isSelected = activeWarRoomAgentId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => handleSummon(a.id)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg border text-footnote flex flex-col gap-1 transition-all",
                      isSelected
                        ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20 shadow-soft-sm"
                        : "bg-white hover:bg-muted/40 border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      {a.name.slice(0, 10)}...
                    </div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{a.desc}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {/* 原有自定义 Agent 渲染列表 */}
              <div className="p-3 border-b">
                <Button variant="outline" size="sm" className="w-full h-8 text-footnote" onClick={() => setShowNew((v) => !v)}>
                  <Plus className="mr-1 h-3 w-3" /> 新建 Agent
                </Button>
              </div>
              {showNew && (
                <div className="p-3 border-b space-y-2 animate-fade-in">
                  <Input placeholder="Agent 名字" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAgent()} className="h-8 text-footnote" />
                  <Button size="sm" className="w-full h-8 text-footnote" onClick={createAgent}>创建</Button>
                </div>
              )}
              {agents.filter(a => !PRESET_AGENTS.some(p => p.id === a.id)).map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedId(a.id); setActiveWarRoomAgentId(null); }}
                  className={cn(
                    'w-full text-left pl-3 py-2 text-footnote flex items-center gap-2 rounded-md transition-colors',
                    selectedId === a.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  )}
                >
                  <Bot className="h-4 w-4 shrink-0" />
                  <span className="truncate">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 右侧主面板：如果是 Marketplace 召唤状态，渲染分屏作战室 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeWarRoomAgentId ? (
          (() => {
            const agent = marketAgents.find(a => a.id === activeWarRoomAgentId)!;
            return (
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white animate-fade-in">
                {/* 作战室 Header */}
                <header className="px-5 py-3 border-b flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <span className={cn('p-1.5 rounded-lg border', agent.color)}>
                      <agent.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-footnote font-bold text-slate-800">{agent.name}作战工作台</h2>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span>公司托管专家</span>
                        <span>·</span>
                        <span>节省 {agent.rating === '4.9' ? '1.2h' : '1.8h'} / 次</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pushedSuccess ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] h-8 px-3 animate-bounce">
                        🚀 决议沉淀成功！已入库
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={handlePushDecision} className="h-8 text-footnote bg-indigo-600 hover:bg-indigo-700">
                        <Save className="h-3.5 w-3.5 mr-1" />
                        一键沉淀为决议卡 (Decision Card)
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setActiveWarRoomAgentId(null)} className="h-8 w-8 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </header>

                {/* 作战室主体：双分屏布局 */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
                  {/* 左侧：工作实体画布 (Editable Text Area) */}
                  <div className="border-r flex flex-col overflow-hidden bg-slate-50/20">
                    <div className="px-4 py-2 border-b bg-slate-50/40 text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <CheckSquare className="h-3 w-3 text-primary" />
                      当前业务工作草稿 (支持编辑修改)
                    </div>
                    <textarea
                      value={warRoomDoc}
                      onChange={(e) => setWarRoomDoc(e.target.value)}
                      className="flex-1 p-5 text-footnote leading-relaxed font-mono whitespace-pre-wrap outline-none resize-none bg-transparent"
                    />
                  </div>

                  {/* 右侧：AI 讨论流 */}
                  <div className="flex flex-col overflow-hidden bg-white">
                    <div className="px-4 py-2 border-b bg-slate-50/40 text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                      AI 联合对账与审查建议流
                    </div>
                    {/* 消息历史 */}
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {warRoomChat.map((msg, i) => (
                          <div key={i} className={cn('flex items-start gap-2.5 text-footnote', msg.role === 'user' ? 'justify-end' : '')}>
                            {msg.role === 'assistant' && (
                              <span className={cn('p-1 rounded bg-indigo-100 text-indigo-700 shrink-0 mt-0.5')}>
                                <agent.icon className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <div className={cn(
                              'p-3 rounded-lg max-w-[85%] leading-relaxed',
                              msg.role === 'user'
                                ? 'bg-slate-900 text-white font-medium'
                                : 'bg-slate-100 text-slate-800'
                            )}>
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {isAnlyzing && streamingText && (
                          <div className="flex items-start gap-2.5 text-footnote animate-pulse">
                            <span className="p-1 rounded bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                              <agent.icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="p-3 rounded-lg max-w-[85%] leading-relaxed bg-slate-100 text-slate-800 whitespace-pre-wrap font-mono">
                              {streamingText}
                              <span className="inline-block w-1.5 h-3 ml-0.5 bg-indigo-500 animate-pulse align-middle" />
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    {/* 输入发送框 */}
                    <div className="p-4 border-t flex items-center gap-2 bg-slate-50/30">
                      <Input
                        value={warRoomInput}
                        onChange={(e) => setWarRoomInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleWarRoomSend()}
                        placeholder="e.g. 帮我把第十二条违规屏幕监控条款修改为符合宪章合规的表述..."
                        className="text-footnote h-9"
                        disabled={isAnlyzing}
                      />
                      <Button size="sm" onClick={handleWarRoomSend} disabled={isAnlyzing || !warRoomInput.trim()} className="h-9 px-4 text-footnote">
                        {isAnlyzing ? '对账中...' : '发送'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : selected ? (
          /* 原有自创 Agent 详情渲染面板 */
          <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = AGENT_ICONS[selected.id] || Bot;
                      const category = AGENT_CATEGORIES[selected.id];
                      return (
                        <>
                          <Icon className={cn('h-5 w-5', category?.color.replace('bg-', 'text-'))} />
                          <CardTitle className="text-headline">{selected.name}</CardTitle>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => launchAgent(selected.id)}>
                      <MessageSquarePlus className="mr-1 h-4 w-4" /> 开始对话
                    </Button>
                    {!PRESET_AGENTS.some(p => p.id === selected.id) && (
                      <Button size="sm" variant="destructive" onClick={() => { deleteAgent(selected.id); setSelectedId(null); }}>
                        <Trash2 className="mr-1 h-3 w-3" /> 删除
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-caption font-medium">Name</label>
                  <Input value={selected.name} onChange={(e) => updateAgent(selected.id, { name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-caption font-medium">Model</label>
                    <Input value={selected.model} placeholder="gpt-4o" onChange={(e) => updateAgent(selected.id, { model: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-caption font-medium">Temperature</label>
                    <Input type="number" min="0" max="1" step="0.1" value={selected.temperature ?? 0.7} onChange={(e) => updateAgent(selected.id, { temperature: parseFloat(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="text-caption font-medium">System Prompt</label>
                  <Textarea value={selected.systemPrompt} onChange={(e) => updateAgent(selected.id, { systemPrompt: e.target.value })} rows={4} />
                </div>

                {/* Skills */}
                <div>
                  <label className="text-caption font-medium">Skills</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PRESET_SKILLS.map((skill) => (
                      <Badge
                        key={skill}
                        variant={selected.skills.includes(skill) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleSkill(skill)}
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="自定义 skill (Enter 追加)..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !selected.skills.includes(val)) {
                          updateAgent(selected.id, { skills: [...selected.skills, val] });
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>

                {/* 接力链 */}
                <div className="border-t pt-4 space-y-2">
                  <label className="text-caption font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    完成后接力 Agent
                    <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                      上游输出 → 自动作为下游输入
                    </span>
                  </label>
                  {(selected.chainTo ?? []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/40 rounded border border-dashed">
                      <Badge variant="default" className="text-footnote">{selected.name}</Badge>
                      {(selected.chainTo ?? []).map((nid, i) => {
                        const next = agents.find((a) => a.id === nid);
                        return (
                          <div key={`${nid}-${i}`} className="flex items-center gap-1">
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-footnote flex items-center gap-1">
                              {next?.name ?? '(已删除)'}
                              <button
                                type="button"
                                aria-label="移除该接力步骤"
                                onClick={() =>
                                  updateAgent(selected.id, {
                                    chainTo: (selected.chainTo ?? []).filter((_, idx) => idx !== i),
                                  })
                                }
                                className="ml-0.5 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (!v) return;
                      updateAgent(selected.id, {
                        chainTo: [...(selected.chainTo ?? []), v],
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="+ 追加下一个 Agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents
                        .filter((a) => a.id !== selected.id)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Provider 配置 (Team / Personal 双栏) */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-caption font-medium flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-primary" />
                      模型配置
                    </label>
                    {currentProvider.type === 'team' ? (
                      <Badge className="text-[10px] bg-violet-600 hover:bg-violet-600">🏢 Team Token</Badge>
                    ) : currentProvider.type === 'openai-compatible' ? (
                      <Badge variant="default" className="text-[10px]">
                        🔑 {PROVIDER_PRESETS.find((p) => p.key === currentProvider.presetKey)?.badge ?? '个人 Key'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Hermes CLI</Badge>
                    )}
                  </div>

                  {(() => {
                    const isTeam = currentProvider.type === 'team';
                    const teamPresets = PROVIDER_PRESETS.filter((p) => p.group === 'team');
                    const personalPresets = PROVIDER_PRESETS.filter((p) => p.group === 'personal');
                    const providerTab: 'team' | 'personal' = isTeam ? 'team' : 'personal';
                    const setProviderTab = (tab: 'team' | 'personal') => {
                      if (tab === 'team') {
                        applyProviderPreset(teamPresets[0]?.key ?? 'team-claude-opus');
                      } else {
                        applyProviderPreset('hermes');
                      }
                    };

                    return (
                      <>
                        <div className="flex rounded-lg border border-border overflow-hidden text-caption">
                          <button
                            type="button"
                            onClick={() => setProviderTab('team')}
                            className={cn(
                              'flex-1 py-2 flex items-center justify-center gap-1.5 font-medium transition-colors',
                              providerTab === 'team'
                                ? 'bg-violet-600 text-white'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            )}
                          >
                            🏢 Team
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', providerTab === 'team' ? 'bg-white/20' : 'bg-muted-foreground/20')}>
                              公司配额
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setProviderTab('personal')}
                            className={cn(
                              'flex-1 py-2 flex items-center justify-center gap-1.5 font-medium transition-colors',
                              providerTab === 'personal'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            )}
                          >
                            🔑 Personal
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', providerTab === 'personal' ? 'bg-white/20' : 'bg-muted-foreground/20')}>
                              自有 Key
                            </span>
                          </button>
                        </div>

                        {providerTab === 'team' && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-muted-foreground">
                              使用公司统一配置的大模型 Token，无需填写 API Key。
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {teamPresets.map((p) => {
                                const active = currentProvider.type === 'team' && currentProvider.presetKey === p.key;
                                return (
                                  <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => applyProviderPreset(p.key)}
                                    className={cn(
                                      'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all',
                                      active
                                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                                        : 'border-border bg-muted/30 hover:border-violet-300'
                                    )}
                                  >
                                    <span className={cn('text-footnote font-semibold', active ? 'text-violet-700 dark:text-violet-300' : '')}>
                                      {p.label}
                                    </span>
                                    {p.description && (
                                      <span className="text-[10px] text-muted-foreground leading-tight">{p.description}</span>
                                    )}
                                    {active && <span className="text-[10px] text-violet-600 font-medium mt-0.5">✓ 已选</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {providerTab === 'personal' && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-footnote text-muted-foreground">供应商</label>
                              <Select
                                value={currentProvider.presetKey ?? (currentProvider.type === 'hermes' ? 'hermes' : '')}
                                onValueChange={applyProviderPreset}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="选择 LLM 供应商..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {personalPresets.map((p) => (
                                    <SelectItem key={p.key} value={p.key}>
                                      <span>{p.label}</span>
                                      {p.defaultModel && <span className="text-muted-foreground ml-2 text-footnote">{p.defaultModel}</span>}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {currentProvider.type === 'openai-compatible' && (
                              <>
                                <div>
                                  <label className="text-footnote text-muted-foreground">Base URL</label>
                                  <Input
                                    className="mt-1 font-mono text-footnote"
                                    placeholder="https://api.openai.com/v1"
                                    value={currentProvider.baseURL ?? ''}
                                    onChange={(e) => updateProvider({ baseURL: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <label className="text-footnote text-muted-foreground flex items-center gap-1">
                                    <KeyRound className="h-3 w-3" /> API Key
                                    <span className="ml-auto text-[10px] text-muted-foreground/70">仅本地浏览器存储</span>
                                  </label>
                                  <div className="relative mt-1">
                                    <Input
                                      type={showApiKey ? 'text' : 'password'}
                                      className="font-mono text-footnote pr-9"
                                      placeholder="sk-..."
                                      value={currentProvider.apiKey ?? ''}
                                      onChange={(e) => updateProvider({ apiKey: e.target.value })}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowApiKey((v) => !v)}
                                      aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-footnote text-muted-foreground">自定义 Headers (JSON，可选)</label>
                                  <Textarea
                                    rows={2}
                                    className="mt-1 font-mono text-footnote"
                                    placeholder={'{"X-Org-Id": "..."}'}
                                    defaultValue={currentProvider.headers ? JSON.stringify(currentProvider.headers, null, 2) : ''}
                                    onChange={(e) => setHeadersDraft(e.target.value)}
                                    onBlur={commitHeadersDraft}
                                  />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  🔒 API Key 仅保存在本地浏览器，不上传服务器。
                                </p>
                              </>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* 初始大画廊（超市形态） */
          <div className="max-w-5xl mx-auto py-6 space-y-6 animate-fade-in">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-headline font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  AI 智能体超市
                </h2>
                <p className="text-footnote text-muted-foreground mt-1">
                  选择标准 Agent 进入作战室协同；产出可一键沉淀为议事室 Decision Card。
                </p>
              </div>
              <Badge variant="outline" className="bg-warning/5 text-warning border-warning/20 text-[10px]">
                V1 演示 Agent · 后端 catalog 待接入
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {marketAgents.map((a) => {
                const Icon = a.icon;
                return (
                  <Card
                    key={a.id}
                    className="group cursor-pointer transition-all hover:shadow-soft hover:border-primary/50 flex flex-col bg-white"
                    onClick={() => handleSummon(a.id)}
                  >
                    <CardHeader className="pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('p-2 rounded-lg border shrink-0', a.color)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <CardTitle className="text-caption font-bold text-slate-800">{a.name}</CardTitle>
                          <p className="text-[10px] text-muted-foreground mt-0.5">每周对账活跃 · {a.calls}次召唤</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {a.desc}
                      </p>
                      <Button size="sm" className="w-full text-footnote h-8 bg-indigo-600 hover:bg-indigo-700 mt-2">
                        <Sparkles className="mr-1 h-3.5 w-3.5" /> 召唤进入作战室
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
