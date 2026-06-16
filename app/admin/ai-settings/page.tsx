'use client';

import { useEffect, useState } from 'react';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface AiSettingsForm {
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  deepseekR1Model: string;
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  anthropicModel: string;
  qwenApiKey: string;
  qwenBaseUrl: string;
  qwenModel: string;
  doubaoApiKey: string;
  doubaoBaseUrl: string;
  doubaoModel: string;
  kimiApiKey: string;
  kimiBaseUrl: string;
  kimiModel: string;
  hermesBaseUrl: string;
  hermesModel: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingApiUrl: string;
  embeddingApiKey: string;
  tavilyApiKey: string;
  braveSearchApiKey: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpSecure: string;
}

const EMPTY: AiSettingsForm = {
  deepseekApiKey: '', deepseekBaseUrl: '', deepseekModel: '',
  deepseekR1Model: '', anthropicApiKey: '', anthropicBaseUrl: '',
  anthropicModel: '', qwenApiKey: '', qwenBaseUrl: '', qwenModel: '',
  doubaoApiKey: '', doubaoBaseUrl: '', doubaoModel: '',
  kimiApiKey: '', kimiBaseUrl: '', kimiModel: '',
  hermesBaseUrl: '', hermesModel: '',
  embeddingProvider: '', embeddingModel: '', embeddingApiUrl: '', embeddingApiKey: '',
  tavilyApiKey: '', braveSearchApiKey: '',
  smtpHost: '', smtpPort: '', smtpUser: '',
  smtpPass: '', smtpFrom: '', smtpSecure: '',
};

interface FieldProps {
  label: string;
  field: keyof AiSettingsForm;
  form: AiSettingsForm;
  onChange: (k: keyof AiSettingsForm, v: string) => void;
  isKey?: boolean;
  placeholder?: string;
}

function Field({ label, field, form, onChange, isKey, placeholder }: FieldProps) {
  const [show, setShow] = useState(false);
  const masked = isKey && !show;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-footnote text-ink-secondary font-medium">{label}</label>
      <div className="relative">
        <input
          type={masked ? 'password' : 'text'}
          value={form[field]}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder ?? (isKey ? 'sk-…（留空则沿用环境变量）' : '')}
          className="w-full rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500 pr-8"
        />
        {isKey && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-primary"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  badge?: string;
  children: React.ReactNode;
}

function Section({ title, badge, children }: SectionProps) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-1 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-caption font-semibold text-ink-primary">{title}</h2>
        {badge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3 text-ink-secondary font-mono">
            {badge}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export default function AiSettingsPage() {
  const [form, setForm] = useState<AiSettingsForm>(EMPTY);
  const [status, setStatus] = useState<'loading' | 'ok' | 'saving' | 'saved' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  const onChange = (k: keyof AiSettingsForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    fetch('/api/admin/ai-settings', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings ?? {};
        setForm((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(s).filter(([, v]) => typeof v === 'string'),
          ),
        }));
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  async function handleSave() {
    setStatus('saving');
    try {
      const body: Record<string, string> = {};
      for (const [k, v] of Object.entries(form)) {
        if (typeof v === 'string' && v.trim()) body[k] = v.trim();
      }
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('saved');
      setTimeout(() => setStatus('ok'), 2500);
    } catch (err) {
      setErrMsg((err as Error).message);
      setStatus('error');
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64 text-ink-secondary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载配置…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-3 font-bold text-ink-primary">AI 配置管理</h1>
          <p className="text-caption text-ink-secondary mt-0.5">
            DB 中存储的配置优先于环境变量，修改后立即生效（无需重启）。
            留空字段将沿用服务器环境变量兜底。
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-caption font-medium disabled:opacity-50 transition"
        >
          {status === 'saving' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : status === 'saved' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {status === 'saving' ? '保存中…' : status === 'saved' ? '已保存' : '保存'}
        </button>
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-2xl border border-danger bg-danger/5 px-4 py-3 text-caption text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errMsg || '加载失败，请刷新重试'}
        </div>
      )}

      <div className="rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-footnote text-ink-secondary space-y-1">
        <p className="font-medium text-ink-primary">优先级说明</p>
        <p>① 本页保存的 DB 配置（最高）→ ② 服务器 .env / 环境变量（兜底）</p>
        <p>Key 字段展示为脱敏格式（sk-****xxxx），提交新值才会覆盖。</p>
      </div>

      <Section title="DeepSeek" badge="deepseek-v3 / deepseek-r1">
        <Field label="API Key" field="deepseekApiKey" form={form} onChange={onChange} isKey />
        <Field label="Base URL" field="deepseekBaseUrl" form={form} onChange={onChange} placeholder="https://api.deepseek.com/v1" />
        <Field label="Chat 模型名" field="deepseekModel" form={form} onChange={onChange} placeholder="deepseek-chat" />
        <Field label="R1 推理模型名" field="deepseekR1Model" form={form} onChange={onChange} placeholder="deepseek-reasoner" />
      </Section>

      <Section title="Anthropic (Claude)" badge="claude-opus-4-5">
        <Field label="API Key" field="anthropicApiKey" form={form} onChange={onChange} isKey />
        <Field label="Base URL" field="anthropicBaseUrl" form={form} onChange={onChange} placeholder="https://api.anthropic.com/v1" />
        <Field label="模型名" field="anthropicModel" form={form} onChange={onChange} placeholder="claude-opus-4-5" />
      </Section>

      <Section title="通义千问 (Qwen)" badge="qwen-max">
        <Field label="API Key" field="qwenApiKey" form={form} onChange={onChange} isKey />
        <Field label="Base URL" field="qwenBaseUrl" form={form} onChange={onChange} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
        <Field label="模型名" field="qwenModel" form={form} onChange={onChange} placeholder="qwen-max" />
      </Section>

      <Section title="豆包 (Doubao)" badge="doubao-pro">
        <Field label="API Key" field="doubaoApiKey" form={form} onChange={onChange} isKey />
        <Field label="Base URL" field="doubaoBaseUrl" form={form} onChange={onChange} placeholder="https://ark.cn-beijing.volces.com/api/v3" />
        <Field label="模型名" field="doubaoModel" form={form} onChange={onChange} placeholder="doubao-1-5-pro-256k" />
      </Section>

      <Section title="Kimi" badge="kimi-k2">
        <Field label="API Key" field="kimiApiKey" form={form} onChange={onChange} isKey />
        <Field label="Base URL" field="kimiBaseUrl" form={form} onChange={onChange} placeholder="https://api.moonshot.cn/v1" />
        <Field label="模型名" field="kimiModel" form={form} onChange={onChange} placeholder="moonshot-v1-128k" />
      </Section>

      <Section title="本地 Hermes / Ollama" badge="hermes-4">
        <Field label="Base URL" field="hermesBaseUrl" form={form} onChange={onChange} placeholder="http://localhost:11434/v1" />
        <Field label="模型名" field="hermesModel" form={form} onChange={onChange} placeholder="hermes3" />
      </Section>

      <Section title="Embedding 向量化">
        <div className="flex flex-col gap-1">
          <label className="text-footnote text-ink-secondary font-medium">Provider</label>
          <select
            value={form.embeddingProvider}
            onChange={(e) => onChange('embeddingProvider', e.target.value)}
            className="rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">沿用环境变量</option>
            <option value="none">关闭 (none)</option>
            <option value="openai">OpenAI 兼容 (openai)</option>
            <option value="ollama">本地 Ollama (ollama)</option>
          </select>
        </div>
        <Field label="模型名" field="embeddingModel" form={form} onChange={onChange} placeholder="BAAI/bge-m3" />
        <Field label="API URL" field="embeddingApiUrl" form={form} onChange={onChange} placeholder="https://api.siliconflow.cn/v1/embeddings" />
        <Field label="API Key" field="embeddingApiKey" form={form} onChange={onChange} isKey />
      </Section>

      <Section title="Web 搜索增强">
        <Field label="Tavily API Key" field="tavilyApiKey" form={form} onChange={onChange} isKey placeholder="tvly-…（免费 1000 次/月）" />
        <Field label="Brave Search API Key" field="braveSearchApiKey" form={form} onChange={onChange} isKey placeholder="BSA…（免费 2000 次/月）" />
      </Section>

      <Section title="邮件 (SMTP)">
        <Field label="SMTP Host" field="smtpHost" form={form} onChange={onChange} placeholder="smtp.qq.com" />
        <Field label="端口" field="smtpPort" form={form} onChange={onChange} placeholder="587" />
        <Field label="用户名" field="smtpUser" form={form} onChange={onChange} placeholder="noreply@example.com" />
        <Field label="密码 / 授权码" field="smtpPass" form={form} onChange={onChange} isKey />
        <Field label="发件人" field="smtpFrom" form={form} onChange={onChange} placeholder="Tandem <noreply@example.com>" />
        <div className="flex flex-col gap-1">
          <label className="text-footnote text-ink-secondary font-medium">SSL</label>
          <select
            value={form.smtpSecure}
            onChange={(e) => onChange('smtpSecure', e.target.value)}
            className="rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">沿用环境变量</option>
            <option value="0">STARTTLS (端口 587)</option>
            <option value="1">SSL (端口 465)</option>
          </select>
        </div>
      </Section>

      <div className="flex items-center gap-2 text-footnote text-ink-secondary">
        <RefreshCw className="w-3 h-3" />
        修改保存后，下一次 API 请求即生效（路由器在 boot 阶段读取 DB 配置）。
      </div>
    </div>
  );
}
