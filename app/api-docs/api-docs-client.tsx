'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  ExternalLink,
  Filter,
  Lock,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  API_AUTH_DESCRIPTIONS,
  API_AUTH_LABELS,
  API_DOC_STATS,
  API_GROUPS,
  type ApiAuthLevel,
  type ApiEndpoint,
} from '@/lib/api-docs/catalog';
import { authDescription, buildEndpointDoc, type ApiField, type ApiStatus } from '@/lib/api-docs/details';

type ApiDocsClientProps = {
  endpoints: ApiEndpoint[];
  host: string;
  viewer: {
    email: string;
    roles: string[];
  };
};

const AUTH_OPTIONS: Array<{ value: 'all' | ApiAuthLevel; label: string }> = [
  { value: 'all', label: '全部权限' },
  { value: 'public', label: API_AUTH_LABELS.public },
  { value: 'auth', label: API_AUTH_LABELS.auth },
  { value: 'role', label: API_AUTH_LABELS.role },
  { value: 'middleware', label: API_AUTH_LABELS.middleware },
];

const METHOD_STYLES: Record<string, string> = {
  GET: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  POST: 'border-blue-200 bg-blue-50 text-blue-700',
  PUT: 'border-amber-200 bg-amber-50 text-amber-700',
  PATCH: 'border-violet-200 bg-violet-50 text-violet-700',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-700',
};

const AUTH_STYLES: Record<ApiAuthLevel, string> = {
  public: 'border-slate-200 bg-slate-50 text-slate-700',
  auth: 'border-sky-200 bg-sky-50 text-sky-700',
  role: 'border-red-200 bg-red-50 text-red-700',
  middleware: 'border-zinc-200 bg-zinc-50 text-zinc-700',
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title="复制完整 URL"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function FieldTable({ title, fields, emptyText }: { title: string; fields: ApiField[]; emptyText: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{title}</div>
      {fields.length === 0 ? (
        <div className="px-3 py-3 text-xs text-slate-500">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">字段</th>
                <th className="px-3 py-2 font-medium">类型</th>
                <th className="px-3 py-2 font-medium">必填</th>
                <th className="px-3 py-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map((item) => (
                <tr key={`${title}:${item.name}`}>
                  <td className="px-3 py-2 font-mono text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{item.type}</td>
                  <td className="px-3 py-2 text-slate-600">{item.required ? '是' : '否'}</td>
                  <td className="px-3 py-2 text-slate-600">{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusTable({ statuses }: { statuses: ApiStatus[] }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">返回状态码</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">HTTP 状态</th>
              <th className="px-3 py-2 font-medium">含义</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {statuses.map((item) => (
              <tr key={item.code}>
                <td className="px-3 py-2 font-mono text-slate-900">{item.code}</td>
                <td className="px-3 py-2 text-slate-600">{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ApiDocsClient({ endpoints, host, viewer }: ApiDocsClientProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [auth, setAuth] = useState<'all' | ApiAuthLevel>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const normalizedHost = host.replace(/\/$/, '');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return endpoints.filter((endpoint) => {
      const matchesQuery =
        !needle ||
        endpoint.path.toLowerCase().includes(needle) ||
        endpoint.methods.some((method) => method.toLowerCase().includes(needle)) ||
        endpoint.group.toLowerCase().includes(needle);
      const matchesGroup = group === 'all' || endpoint.group === group;
      const matchesAuth = auth === 'all' || endpoint.auth === auth;
      return matchesQuery && matchesGroup && matchesAuth;
    });
  }, [auth, endpoints, group, query]);

  const grouped = useMemo(() => {
    return API_GROUPS.map((name) => ({
      name,
      endpoints: filtered.filter((endpoint) => endpoint.group === name),
    })).filter((item) => item.endpoints.length > 0);
  }, [filtered]);

  const counts = useMemo(() => {
    return endpoints.reduce<Record<ApiAuthLevel, number>>(
      (acc, endpoint) => {
        acc[endpoint.auth] += 1;
        return acc;
      },
      { public: 0, auth: 0, role: 0, middleware: 0 },
    );
  }, [endpoints]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 md:px-8">
        <header className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                仅 owner / admin / steward 可访问
              </div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950 md:text-3xl">
                Tandem 接口文档
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                基于当前部署代码生成的 API 路由总览。默认请求域名为{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">{normalizedHost}</code>。
              </p>
            </div>
            <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xl font-semibold text-slate-950">{API_DOC_STATS.endpoints}</div>
                <div className="mt-1 text-xs text-slate-500">路由</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xl font-semibold text-slate-950">{API_DOC_STATS.methods}</div>
                <div className="mt-1 text-xs text-slate-500">方法</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xl font-semibold text-slate-950">{API_DOC_STATS.groups}</div>
                <div className="mt-1 text-xs text-slate-500">模块</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" />
            当前用户：{viewer.email}
            <span className="text-slate-300">|</span>
            角色：{viewer.roles.join(', ') || 'none'}
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {(Object.keys(API_AUTH_LABELS) as ApiAuthLevel[]).map((level) => (
            <div key={level} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-md border px-2 py-1 text-xs font-medium ${AUTH_STYLES[level]}`}>
                  {API_AUTH_LABELS[level]}
                </span>
                <span className="text-lg font-semibold text-slate-950">{counts[level]}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{API_AUTH_DESCRIPTIONS[level]}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">生产调用约定</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-700">公共请求头</div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                <li><code className="font-mono">Content-Type</code>：默认 application/json。</li>
                <li><code className="font-mono">Cookie</code>：受保护接口需携带 tandem_at。</li>
                <li><code className="font-mono">x-request-id</code>：可选，便于链路排查。</li>
              </ul>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-700">通用错误体</div>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{`{
  "error": "unauthenticated",
  "message": "optional detail",
  "requestId": "optional"
}`}</pre>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-700">状态码口径</div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                <li><code className="font-mono">200/201</code>：成功或创建成功。</li>
                <li><code className="font-mono">400</code>：参数或业务校验失败。</li>
                <li><code className="font-mono">401/403</code>：未登录或权限不足。</li>
                <li><code className="font-mono">404/409/429/5xx</code>：不存在、冲突、限流或服务异常。</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="sticky top-0 z-10 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_240px_180px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索路径、方法或模块"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="all">全部模块</option>
                {API_GROUPS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <select
              value={auth}
              onChange={(event) => setAuth(event.target.value as 'all' | ApiAuthLevel)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            >
              {AUTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <main className="space-y-5">
          {grouped.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              没有匹配的接口。
            </div>
          ) : (
            grouped.map((bucket) => (
              <section key={bucket.name} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-950">{bucket.name}</h2>
                  </div>
                  <span className="text-xs text-slate-500">{bucket.endpoints.length} 个路由</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {bucket.endpoints.map((endpoint) => {
                    const url = `${normalizedHost}${endpoint.path}`;
                    const doc = buildEndpointDoc(endpoint);
                    const key = `${endpoint.group}:${endpoint.path}`;
                    const open = expanded[key] ?? false;
                    return (
                      <article
                        key={key}
                        className="px-4 py-3 transition hover:bg-slate-50"
                      >
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_130px_42px]">
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => ({ ...prev, [key]: !open }))}
                            className="min-w-0 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {open ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                              {endpoint.methods.map((method) => (
                                <span
                                  key={method}
                                  className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold ${
                                    METHOD_STYLES[method] ?? 'border-slate-200 bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  {method}
                                </span>
                              ))}
                              <code className="break-all font-mono text-sm text-slate-900">{endpoint.path}</code>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-600">{doc.summary}</p>
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="break-all">{url}</span>
                            </div>
                          </button>
                          <div className="flex items-start lg:justify-end">
                            <span className={`rounded-md border px-2 py-1 text-xs font-medium ${AUTH_STYLES[endpoint.auth]}`}>
                              {API_AUTH_LABELS[endpoint.auth]}
                            </span>
                          </div>
                          <div className="flex items-start lg:justify-end">
                            <CopyButton value={url} />
                          </div>
                        </div>

                        {open && (
                          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                <div className="text-xs font-semibold text-slate-700">接口含义</div>
                                <p className="mt-2 text-xs leading-5 text-slate-600">{doc.summary}</p>
                              </div>
                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                <div className="text-xs font-semibold text-slate-700">鉴权说明</div>
                                <p className="mt-2 text-xs leading-5 text-slate-600">{authDescription(endpoint)}</p>
                              </div>
                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                <div className="text-xs font-semibold text-slate-700">请求地址</div>
                                <code className="mt-2 block break-all font-mono text-xs text-slate-700">{url}</code>
                              </div>
                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                <div className="text-xs font-semibold text-slate-700">请求体格式</div>
                                <code className="mt-2 block font-mono text-xs text-slate-700">{doc.contentType}</code>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4">
                              <FieldTable title="请求头" fields={doc.requestHeaders} emptyText="无特殊请求头。" />
                              <FieldTable title="路径参数" fields={doc.pathParams} emptyText="无路径参数。" />
                              <FieldTable title="查询参数" fields={doc.queryParams} emptyText="无查询参数。" />
                              <FieldTable title="请求 Body / 表单参数" fields={doc.bodyParams} emptyText="无请求体。" />
                              <FieldTable title="返回参数" fields={doc.responseFields} emptyText="无结构化响应体。" />
                              <StatusTable statuses={doc.statuses} />
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    </div>
  );
}
