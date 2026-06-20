/**
 * POST /api/bitable/seed-templates
 *
 * 给当前用户预置 3 张实用模板表 (项目跟踪 / 客户台账 / 招聘漏斗), 每张带示例行,
 * 让表格 / 看板 / 日历三视图开箱即有内容。按表名幂等: 已存在同名表则跳过。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore, generateId } from '@/lib/storage/repository';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import type { BitableColumn } from '@/lib/types/bitable';

interface TemplateSpec {
  name: string;
  description: string;
  columns: BitableColumn[];
  rows: Array<Record<string, unknown>>;
}

/** 相对今天 +n 天的 YYYY-MM-DD */
function dayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildTemplates(): TemplateSpec[] {
  return [
    {
      name: '项目跟踪',
      description: '部门项目台账 · 表格/看板(按状态)/日历(按截止)',
      columns: [
        { id: 'name', name: '项目', type: 'text', width: 200, required: true },
        {
          id: 'status',
          name: '状态',
          type: 'select',
          options: [
            { value: '待办', color: 'slate' },
            { value: '进行中', color: 'amber' },
            { value: '已完成', color: 'emerald' },
            { value: '已搁置', color: 'rose' },
          ],
        },
        {
          id: 'priority',
          name: '优先级',
          type: 'select',
          options: [
            { value: '高', color: 'rose' },
            { value: '中', color: 'amber' },
            { value: '低', color: 'slate' },
          ],
        },
        { id: 'owner', name: '负责人', type: 'text' },
        { id: 'due', name: '截止', type: 'date' },
      ],
      rows: [
        { name: '热水事业部 Q1 新品上市', status: '进行中', priority: '高', owner: '产品部', due: dayOffset(5) },
        { name: '空气能渠道拓展', status: '待办', priority: '中', owner: '渠道部', due: dayOffset(12) },
        { name: '制造良品率提升专项', status: '进行中', priority: '高', owner: '制造部', due: dayOffset(2) },
        { name: '售后备件齐套率优化', status: '已完成', priority: '中', owner: '售后部', due: dayOffset(-3) },
        { name: 'CRM 系统切换', status: '已搁置', priority: '低', owner: 'IT', due: dayOffset(20) },
      ],
    },
    {
      name: '客户台账',
      description: '销售商机管理 · 看板(按阶段)/日历(按跟进日)',
      columns: [
        { id: 'name', name: '客户名称', type: 'text', width: 200, required: true },
        {
          id: 'stage',
          name: '阶段',
          type: 'select',
          options: [
            { value: '线索', color: 'slate' },
            { value: '商机', color: 'sky' },
            { value: '成交', color: 'emerald' },
            { value: '流失', color: 'rose' },
          ],
        },
        { id: 'industry', name: '行业', type: 'text' },
        { id: 'amount', name: '预计金额(万)', type: 'number' },
        { id: 'followUp', name: '跟进日期', type: 'date' },
      ],
      rows: [
        { name: '万科地产', stage: '商机', industry: '地产', amount: 180, followUp: dayOffset(3) },
        { name: '碧桂园', stage: '线索', industry: '地产', amount: 90, followUp: dayOffset(7) },
        { name: '某连锁酒店', stage: '成交', industry: '酒店', amount: 260, followUp: dayOffset(-2) },
        { name: '区域经销商A', stage: '商机', industry: '经销', amount: 60, followUp: dayOffset(1) },
        { name: '老客户B', stage: '流失', industry: '工程', amount: 0, followUp: dayOffset(-10) },
      ],
    },
    {
      name: '招聘漏斗',
      description: 'HR 招聘流程 · 看板(按阶段)/日历(按面试日)',
      columns: [
        { id: 'name', name: '候选人', type: 'text', width: 160, required: true },
        { id: 'role', name: '岗位', type: 'text', width: 160 },
        {
          id: 'stage',
          name: '阶段',
          type: 'select',
          options: [
            { value: '初筛', color: 'slate' },
            { value: '面试', color: 'amber' },
            { value: 'offer', color: 'sky' },
            { value: '入职', color: 'emerald' },
            { value: '淘汰', color: 'rose' },
          ],
        },
        { id: 'interview', name: '面试日期', type: 'date' },
      ],
      rows: [
        { name: '张三', role: '热水产品经理', stage: '面试', interview: dayOffset(1) },
        { name: '李四', role: '渠道销售', stage: '初筛', interview: dayOffset(4) },
        { name: '王五', role: '制造工艺工程师', stage: 'offer', interview: dayOffset(-1) },
        { name: '赵六', role: '售后主管', stage: '入职', interview: dayOffset(-6) },
        { name: '孙七', role: '财务分析', stage: '淘汰', interview: dayOffset(-8) },
      ],
    },
  ];
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // Tenant isolation: 收敛到统一 withTenantScope (宪章 §23).
  const tables = withTenantScope(getStore().bitableTables, auth.tenantId);
  const existing = (await tables.list()).filter((t) => t.ownerId === auth.userId);
  const existingNames = new Set(existing.map((t) => t.name));

  const now = new Date().toISOString();
  const created: string[] = [];
  for (const tpl of buildTemplates()) {
    if (existingNames.has(tpl.name)) continue;
    await tables.create({
      name: tpl.name,
      description: tpl.description,
      ownerId: auth.userId,
      columns: tpl.columns,
      rows: tpl.rows.map((data) => ({
        id: generateId('row'),
        data,
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    });
    created.push(tpl.name);
  }
  return NextResponse.json({ ok: true, created, skipped: existingNames.size });
}
