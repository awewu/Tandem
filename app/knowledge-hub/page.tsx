import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  Brain,
  LayoutGrid,
  HardDrive,
  ArrowRight,
  ShieldCheck,
  Lock,
} from 'lucide-react';

/**
 * 知识导航 · 意图漏斗 (IA 混淆整改 P1)
 *
 * 用户按"我想做什么 + 信不信"选入口, 而非按数据形态猜。
 * 唯一权威 = 组织记忆 (签批后全员权威 + 喂中央 AI); 其余是上游原料 / 个人空间 / 工具。
 * 见 docs/KNOWLEDGE-MEMORY-EVOLUTION-2026-07-21.md §8。
 */

interface IntentCard {
  intent: string;
  href: string;
  moduleName: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  authority: 'company' | 'material' | 'tool' | 'personal';
}

const AUTHORITY_META: Record<
  IntentCard['authority'],
  { label: string; tone: string }
> = {
  company: { label: '公司权威 · 签批后喂 AI', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  material: { label: '共创原料 · 可申请升级', tone: 'bg-info/10 text-info border-info/20' },
  tool: { label: '数据工具', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  personal: { label: '仅自己可见 · 不喂 AI', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const CARDS: IntentCard[] = [
  {
    intent: '我要查 / 设公司权威规定',
    href: '/memories',
    moduleName: '组织记忆（需审批）',
    desc: '公司正式认可的 SOP / 红线 / 价值观 / 案例。经三级签批入库, 全员引用, 是中央 AI 决策的唯一权威依据。',
    icon: Brain,
    authority: 'company',
  },
  {
    intent: '我要沉淀 / 协作写文档',
    href: '/documents',
    moduleName: '文档协作',
    desc: '多人共创 doc / sheet / slide, 上传解析。高价值内容可一键申请升级为「组织记忆」。',
    icon: FileText,
    authority: 'material',
  },
  {
    intent: '我要做结构化数据表',
    href: '/bitable',
    moduleName: '多维表格',
    desc: '项目跟踪 / 资产清单 / 轻量 CRM 等"当数据用"的表:字段 + 多视图 + 筛选联动。区别于文档里的静态表格。',
    icon: LayoutGrid,
    authority: 'tool',
  },
  {
    intent: '我要存 / 共享 / 加工个人文件',
    href: '/drive',
    moduleName: '云盘',
    desc: '个人文件的存储与共享网盘(原件 / 大文件 / 二进制)。需要把内容读出来编辑? 上传到「文档协作」解析成可编辑文档。',
    icon: HardDrive,
    authority: 'personal',
  },
];

export default function KnowledgeHubPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <h1 className="text-title-2 font-semibold text-ink-primary">知识导航 · 我想做什么</h1>
        <p className="mt-1 text-caption text-muted-foreground">
          按你的意图选入口, 不用猜"该放哪"。
        </p>
      </div>

      {/* 唯一规则提示 */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-caption text-emerald-900">
            <span className="font-semibold">一条规则:</span> 只有
            <span className="font-semibold">「组织记忆」</span>
            是签批后全员权威、并进入中央 AI 决策依据的知识。其余模块是它的
            <span className="font-medium">上游原料</span>、
            <span className="font-medium">个人空间</span> 或
            <span className="font-medium">数据工具</span> —— 在那里设"公司"标签
            <span className="font-semibold text-warning">不等于公司发布</span>。
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const meta = AUTHORITY_META[c.authority];
          const highlight = c.authority === 'company';
          return (
            <Link key={c.href} href={c.href} className="group block">
              <Card
                className={
                  highlight
                    ? 'h-full border-emerald-300 transition-shadow hover:shadow-soft'
                    : 'h-full transition-shadow hover:shadow-soft'
                }
              >
                <CardContent className="flex h-full flex-col gap-2 py-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        highlight
                          ? 'flex h-9 w-9 items-center justify-center rounded-md bg-emerald-100 text-emerald-700'
                          : 'flex h-9 w-9 items-center justify-center rounded-md bg-surface-3 text-ink-secondary'
                      }
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink-primary">{c.intent}</div>
                      <div className="text-footnote text-muted-foreground">→ {c.moduleName}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-tertiary transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-footnote leading-relaxed text-muted-foreground">{c.desc}</p>
                  <span
                    className={`mt-auto inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${meta.tone}`}
                  >
                    {c.authority === 'personal' && <Lock className="h-2.5 w-2.5" />}
                    {c.authority === 'company' && <ShieldCheck className="h-2.5 w-2.5" />}
                    {meta.label}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* 速记: 3 类 + 两条易混点 */}
      <Card>
        <CardContent className="space-y-2 py-4 text-footnote text-muted-foreground">
          <div className="font-medium text-ink-primary">记不住?就记 3 类:</div>
          <div>
            <span className="font-medium text-emerald-700">① 公司权威</span> = 组织记忆(签批后喂 AI,唯一权威) ·
            <span className="font-medium text-info"> ② 协作产出</span> = 文档协作 + 多维表格(团队一起做) ·
            <span className="font-medium text-slate-600"> ③ 个人文件</span> = 云盘(只有自己看)
          </div>
          <div className="border-t pt-2">
            <span className="font-medium">两个常见纠结:</span>
          </div>
          <div>· 做表:排版给人看的静态表 → 文档协作;要筛选/多视图当数据用 → 多维表格。</div>
          <div>· 个人文件:存原件 / 分享 → 云盘;要把内容读出来编辑 → 上传到文档协作解析。</div>
        </CardContent>
      </Card>
    </div>
  );
}
