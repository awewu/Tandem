'use client';

/**
 * 通讯录树 (Q2 IM 替代企微 · Day 2 · 2026-05-10)
 *
 * 位置: /im 左栏切换 [频道|通讯录] 时显示
 * 数据: useOrgStore (departments + ministries) + useOKRStore (people)
 * 交互:
 *   - 部门折叠 / 展开
 *   - 点人员 → POST /api/im/dm → 切到 1:1 频道
 *   - 部门 hover 出现 [建群] 按钮 → 打开 CreateChannelDialog (kind=department, departmentId 预填)
 *   - 搜索框过滤
 *
 * 不依赖: 后端额外 API (除 /api/im/dm 已有). 数据全 client zustand.
 */

import { useMemo, useState } from 'react';
import {
  ChevronRight, ChevronDown, Building2, UsersRound,
  User, Search, Plus,
} from 'lucide-react';
import { useOrgStore } from '@/lib/store';
import { useOrgPeopleStore, type OrgPerson } from '@/lib/org/people-source';
import type { Ministry } from '@/lib/types/governance';
import { Input } from '@/components/ui/input';

interface Props {
  /** 当前用户 ID, 自己不显示在通讯录中可点击 */
  currentUserId: string;
  /** 点击人员时触发 (父组件创建 dm 频道) */
  onSelectPerson: (personId: string) => void;
  /** 点击部门"建群"按钮触发 (父组件打开 CreateChannelDialog 并预填部门) */
  onCreateDeptChannel: (departmentId: string, departmentName: string) => void;
}

interface PersonWithMinistry extends OrgPerson {
  ministryName?: string;
  departmentName?: string;
  avatarUrl?: string;
}

export function ContactsTree({ currentUserId, onSelectPerson, onCreateDeptChannel }: Props) {
  const { departments } = useOrgStore();
  // E-pragma (2026-05-31): 合并真用户 + fixture, 真用户优先
  const people = useOrgPeopleStore((s) => s.people);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // 默认展开所有部门 (一级), 折叠 ministry (二级)
    return new Set(departments.map((d) => `dept-${d.id}`));
  });
  const [search, setSearch] = useState('');

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 索引: ministryId → 人列表
  const peopleByMinistry = useMemo(() => {
    const map = new Map<string, PersonWithMinistry[]>();
    const unassigned: PersonWithMinistry[] = [];
    for (const p of people) {
      if (p.id === currentUserId) continue; // 自己不进通讯录
      if (p.ministryId) {
        const list = map.get(p.ministryId) ?? [];
        list.push(p);
        map.set(p.ministryId, list);
      } else {
        unassigned.push(p);
      }
    }
    return { map, unassigned };
  }, [people, currentUserId]);

  // 搜索匹配 (按 person.name / ministry.name / department.name)
  const matchesSearch = (text: string): boolean => {
    if (!search.trim()) return true;
    return text.toLowerCase().includes(search.trim().toLowerCase());
  };

  const totalPeople = people.length - (people.find((p) => p.id === currentUserId) ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* 搜索 */}
      <div className="px-2 py-2 border-b border-slate-200/70">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索同事 / 部门"
            className="h-7 pl-6 text-xs"
          />
        </div>
        <div className="mt-1 px-1 text-[10px] text-slate-500">
          共 {totalPeople} 位同事 · {departments.length} 个部门
        </div>
      </div>

      {/* 树 */}
      <div className="flex-1 overflow-y-auto px-1 py-1.5 text-sm">
        {departments.map((dept) => {
          const deptKey = `dept-${dept.id}`;
          const deptOpen = expanded.has(deptKey);

          // 该部门下的全部 ministry + 人, 用于搜索过滤
          const deptPeople = dept.ministries.flatMap((m) => peopleByMinistry.map.get(m.id) ?? []);
          const deptMatches = matchesSearch(dept.name)
            || dept.ministries.some((m) => matchesSearch(m.name))
            || deptPeople.some((p) => matchesSearch(p.name));

          if (search.trim() && !deptMatches) return null;

          return (
            <div key={dept.id} className="mb-0.5">
              {/* 部门行 */}
              <div
                className="group flex items-center gap-1 rounded px-1.5 py-1 hover:bg-slate-100"
              >
                <button
                  type="button"
                  onClick={() => toggle(deptKey)}
                  className="flex flex-1 items-center gap-1 text-left"
                >
                  {deptOpen ? (
                    <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-slate-500 shrink-0" />
                  )}
                  <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="text-[12.5px] font-medium text-slate-700 truncate">
                    {dept.name}
                  </span>
                  <span className="ml-1 text-[10px] text-slate-400 tabular-nums">
                    {deptPeople.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateDeptChannel(dept.id, dept.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-500 hover:bg-slate-200"
                  title={`建 ${dept.name} 部门群`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Ministry + 人员 */}
              {deptOpen && (
                <div className="ml-3 border-l border-slate-200/70 pl-1.5">
                  {dept.ministries.map((m) => (
                    <MinistryNode
                      key={m.id}
                      ministry={m}
                      ministryPeople={peopleByMinistry.map.get(m.id) ?? []}
                      expanded={expanded}
                      onToggle={toggle}
                      onSelectPerson={onSelectPerson}
                      matchesSearch={matchesSearch}
                      searchActive={!!search.trim()}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 未分配 */}
        {peopleByMinistry.unassigned.length > 0 && (
          <div className="mb-0.5 mt-2">
            <div className="px-1.5 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              未分配 ({peopleByMinistry.unassigned.length})
            </div>
            {peopleByMinistry.unassigned
              .filter((p) => matchesSearch(p.name))
              .map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  onSelectPerson={onSelectPerson}
                />
              ))}
          </div>
        )}

        {totalPeople === 0 && (
          <div className="px-3 py-6 text-xs text-slate-500">
            暂无成员. 去 <a className="underline" href="/organization">组织架构</a> 添加.
          </div>
        )}
      </div>
    </div>
  );
}

function MinistryNode({
  ministry,
  ministryPeople,
  expanded,
  onToggle,
  onSelectPerson,
  matchesSearch,
  searchActive,
}: {
  ministry: Ministry;
  ministryPeople: PersonWithMinistry[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onSelectPerson: (personId: string) => void;
  matchesSearch: (text: string) => boolean;
  searchActive: boolean;
}) {
  const key = `min-${ministry.id}`;
  // 搜索激活时强制展开有匹配的 ministry
  const hasMatch = matchesSearch(ministry.name) || ministryPeople.some((p) => matchesSearch(p.name));
  const open = searchActive ? hasMatch : expanded.has(key);

  if (searchActive && !hasMatch) return null;

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => onToggle(key)}
        className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left hover:bg-slate-100"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
        )}
        <UsersRound className="h-3 w-3 text-cyan-600 shrink-0" />
        <span className="text-[11.5px] text-slate-600 truncate">{ministry.name}</span>
        <span className="ml-1 text-[10px] text-slate-400 tabular-nums">{ministryPeople.length}</span>
      </button>
      {open && (
        <div className="ml-3">
          {ministryPeople
            .filter((p) => !searchActive || matchesSearch(p.name))
            .map((p) => (
              <PersonRow key={p.id} person={p} onSelectPerson={onSelectPerson} />
            ))}
          {ministryPeople.length === 0 && (
            <div className="px-2 py-1 text-[10px] text-slate-400">无成员</div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonRow({
  person,
  onSelectPerson,
}: {
  person: PersonWithMinistry;
  onSelectPerson: (personId: string) => void;
}) {
  const initial = (person.name?.[0] ?? '?').toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelectPerson(person.id)}
      className="group flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-violet-50"
      title={`私聊 ${person.name}`}
    >
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt={person.name} className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-[9px] font-semibold uppercase text-white">
          {initial}
        </div>
      )}
      <span className="flex-1 text-[12px] text-slate-700 truncate">{person.name}</span>
      <User className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100" />
    </button>
  );
}
