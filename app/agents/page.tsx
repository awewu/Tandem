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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Plus, Trash2, Save, Sparkles, Wrench, Palette, Package, Target, Megaphone, Code, PenLine, BarChart3, Users, MessageSquarePlus, Cloud, KeyRound, Eye, EyeOff, Link2, ArrowRight, X } from 'lucide-react';
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
  'agent-tech-lead': { label: '技术', color: 'bg-green-500' },
  'agent-writer': { label: '文案', color: 'bg-yellow-500' },
  'agent-data-analyst': { label: '数据', color: 'bg-cyan-500' },
  'agent-hr': { label: '人事', color: 'bg-red-500' },
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
    updateAgent(selected.id, {
      provider: {
        type: 'openai-compatible',
        baseURL: preset.baseURL ?? currentProvider.baseURL ?? '',
        apiKey: currentProvider.apiKey ?? '',
        headers: currentProvider.headers,
        presetKey: preset.key,
      },
      // 自动同步 model（如果用户没自定义过）
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

  /** 给画廊卡片显示的供应商徽章文本 */
  const providerBadgeOf = (a: { provider?: LLMProvider }): string | null => {
    if (!a.provider || a.provider.type === 'hermes') return null;
    const preset = PROVIDER_PRESETS.find((p) => p.key === a.provider?.presetKey);
    return preset?.badge ?? '代理';
  };

  return (
    <div className="flex h-full">
      <div className="w-72 border-r flex flex-col">
        <div className="p-3 border-b">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowNew((v) => !v)}>
            <Plus className="mr-1 h-3 w-3" /> New Agent
          </Button>
        </div>
        {showNew && (
          <div className="p-3 border-b space-y-2">
            <Input placeholder="Agent name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAgent()} />
            <Button size="sm" className="w-full" onClick={createAgent}>Create</Button>
          </div>
        )}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {/* 预设 Agent 分组 */}
            {agents.filter(a => PRESET_AGENTS.some(p => p.id === a.id)).length > 0 && (
              <>
                <div className="px-2 py-1 text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  预设 Agent
                </div>
                {agents.filter(a => PRESET_AGENTS.some(p => p.id === a.id)).map((a) => {
                  const Icon = AGENT_ICONS[a.id] || Bot;
                  const category = AGENT_CATEGORIES[a.id];
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'group relative w-full rounded-md flex items-stretch',
                        selectedId === a.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      )}
                    >
                      <button
                        onClick={() => setSelectedId(a.id)}
                        onDoubleClick={() => launchAgent(a.id)}
                        title="单击编辑 · 双击开始对话"
                        className="flex-1 text-left pl-3 pr-2 py-2 text-sm flex items-center gap-2 min-w-0"
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', category?.color.replace('bg-', 'text-'))} />
                        <span className="truncate flex-1">{a.name}</span>
                        {category && (
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded text-white', category.color)}>
                            {category.label}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); launchAgent(a.id); }}
                        title={`开始与 ${a.name} 对话`}
                        aria-label={`开始与 ${a.name} 对话`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2 flex items-center text-primary hover:bg-primary/20 rounded-r-md"
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </>
            )}

            {/* 自定义 Agent 分组 */}
            {agents.filter(a => !PRESET_AGENTS.some(p => p.id === a.id)).length > 0 && (
              <>
                <div className="px-2 py-1 mt-3 text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  自定义 Agent
                </div>
                {agents.filter(a => !PRESET_AGENTS.some(p => p.id === a.id)).map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      'group relative w-full rounded-md flex items-stretch',
                      selectedId === a.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    )}
                  >
                    <button
                      onClick={() => setSelectedId(a.id)}
                      onDoubleClick={() => launchAgent(a.id)}
                      title="单击编辑 · 双击开始对话"
                      className="flex-1 text-left pl-3 pr-2 py-2 text-sm flex items-center gap-2 min-w-0"
                    >
                      <Bot className="h-4 w-4 shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); launchAgent(a.id); }}
                      title={`开始与 ${a.name} 对话`}
                      aria-label={`开始与 ${a.name} 对话`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity px-2 flex items-center text-primary hover:bg-primary/20 rounded-r-md"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </>
            )}

            {agents.length === 0 && <p className="text-xs text-muted-foreground px-2">No agents yet.</p>}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {selected ? (
          <div className="max-w-2xl mx-auto space-y-4">
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
                          <CardTitle className="text-lg">{selected.name}</CardTitle>
                          {PRESET_AGENTS.some(p => p.id === selected.id) && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              预设
                            </Badge>
                          )}
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
                  <label className="text-sm font-medium">Name</label>
                  <Input value={selected.name} onChange={(e) => updateAgent(selected.id, { name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Model</label>
                    <Input value={selected.model} placeholder="e.g. gpt-4o, claude-sonnet" onChange={(e) => updateAgent(selected.id, { model: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium flex items-center justify-between">
                      <span>Temperature</span>
                      <span className="text-xs text-muted-foreground">{selected.temperature ?? 0.7}</span>
                    </label>
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={selected.temperature ?? 0.7}
                      onChange={(e) => updateAgent(selected.id, { temperature: parseFloat(e.target.value) })}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>严谨</span>
                      <span>平衡</span>
                      <span>创意</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">System Prompt</label>
                  <Textarea
                    value={selected.systemPrompt}
                    onChange={(e) => updateAgent(selected.id, { systemPrompt: e.target.value })}
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Skills</label>
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
                    placeholder="Add custom skill..."
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

                {/* 轻量 Workflow：完成后接力调用下一个 Agent */}
                <div className="border-t pt-4 space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    完成后接力 Agent
                    <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                      上游输出 → 自动作为下游输入
                    </span>
                  </label>
                  {/* 已有的接力链 */}
                  {(selected.chainTo ?? []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/40 rounded border border-dashed">
                      <Badge variant="default" className="text-xs">
                        {selected.name}
                      </Badge>
                      {(selected.chainTo ?? []).map((nid, i) => {
                        const next = agents.find((a) => a.id === nid);
                        return (
                          <div key={`${nid}-${i}`} className="flex items-center gap-1">
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              {next?.name ?? '(已删除)'}
                              <button
                                type="button"
                                aria-label="移除该接力步骤"
                                title="移除该接力步骤"
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
                  {/* 添加下一步 */}
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
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    💡 例：PM Agent → 设计 Agent → 技术 Agent，一条消息触发完整产品流程。
                  </p>
                </div>

                {/* LLM 代理配置 — 让每个 Agent 拥有独立专业 LLM 通道 */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-primary" />
                      LLM 代理配置
                    </label>
                    {currentProvider.type === 'openai-compatible' ? (
                      <Badge variant="default" className="text-[10px]">
                        {PROVIDER_PRESETS.find((p) => p.key === currentProvider.presetKey)?.badge ?? '代理已启用'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">默认 Hermes CLI</Badge>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">供应商预设</label>
                    <Select
                      value={currentProvider.presetKey ?? (currentProvider.type === 'hermes' ? 'hermes' : '')}
                      onValueChange={applyProviderPreset}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="选择 LLM 供应商..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_PRESETS.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label}
                            {p.defaultModel ? <span className="text-muted-foreground ml-2 text-xs">{p.defaultModel}</span> : null}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {currentProvider.type === 'openai-compatible' && (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground">Base URL</label>
                        <Input
                          className="mt-1 font-mono text-xs"
                          placeholder="https://api.openai.com/v1"
                          value={currentProvider.baseURL ?? ''}
                          onChange={(e) => updateProvider({ baseURL: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground flex items-center gap-1">
                          <KeyRound className="h-3 w-3" /> API Key
                          <span className="ml-auto text-[10px] text-muted-foreground/70">仅本地浏览器存储</span>
                        </label>
                        <div className="relative mt-1">
                          <Input
                            type={showApiKey ? 'text' : 'password'}
                            className="font-mono text-xs pr-9"
                            placeholder="sk-..."
                            value={currentProvider.apiKey ?? ''}
                            onChange={(e) => updateProvider({ apiKey: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey((v) => !v)}
                            title={showApiKey ? '隐藏' : '显示'}
                            aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">自定义 Headers (JSON，可选)</label>
                        <Textarea
                          rows={3}
                          className="mt-1 font-mono text-xs"
                          placeholder={'{"X-Org-Id": "..."}'}
                          defaultValue={currentProvider.headers ? JSON.stringify(currentProvider.headers, null, 2) : ''}
                          onChange={(e) => setHeadersDraft(e.target.value)}
                          onBlur={commitHeadersDraft}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        🔒 API Key 仅保存在你本地浏览器，不会上传服务器。请求由 <code className="text-foreground">/api/llm-stream</code> 转发到上面的 Base URL。
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Agent 画廊
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                点击卡片编辑 · 点击「开始对话」直接进入聊天（带预设人设和技能）
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.filter(a => PRESET_AGENTS.some(p => p.id === a.id)).map((a) => {
                const Icon = AGENT_ICONS[a.id] || Bot;
                const category = AGENT_CATEGORIES[a.id];
                return (
                  <Card
                    key={a.id}
                    className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                    onClick={() => setSelectedId(a.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn('p-2 rounded-lg', category?.color, 'bg-opacity-10')}>
                            <Icon className={cn('h-5 w-5', category?.color.replace('bg-', 'text-'))} />
                          </div>
                          <CardTitle className="text-base truncate">{a.name}</CardTitle>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {category && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded text-white', category.color)}>
                              {category.label}
                            </span>
                          )}
                          {providerBadgeOf(a) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
                              <Cloud className="h-2.5 w-2.5" />
                              {providerBadgeOf(a)}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground line-clamp-3 min-h-[3em]">
                        {a.systemPrompt.split('\n').slice(0, 2).join(' ').slice(0, 120)}…
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => { e.stopPropagation(); launchAgent(a.id); }}
                      >
                        <MessageSquarePlus className="mr-1 h-4 w-4" /> 开始对话
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
