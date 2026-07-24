'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Loader2,
  ChevronRight,
  ChevronDown,
  Target,
  Sparkles,
  ListChecks,
  Building2,
  Folder,
  Users,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useDynamicStyle } from '@/lib/hooks/use-dynamic-style';
import { getOkrDisplayLevel, getOkrDisplayLevelLabel, type OkrDisplayLevel } from '@/lib/okr/display-level';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';
import { useOrgStore } from '@/lib/store/org';
import { useAuthStore } from '@/lib/hooks/use-current-user';
import type { HrDept } from '@/lib/org/departments';
import type { PersonLike, ResolvedOwner } from '@/lib/org/ownership';

/**
 * /okr/cascade — OKR 5 层级联视图 (Q5 重型 OKR)
 *
 * 视图: O → KR → Initiative → DC → AP
 * 只读. 编辑在 /okr.
 *
 * Layer color coding:
 *   Objective    🏢 蓝
 *   KR          🎯 绿/黄/红 (健康度)
 *   Initiative  ⚡ 紫
 *   DecisionCard 💡 橙 (品牌)
 *   ActionItem  ✓ 中性
 */

interface KeyResult {
  id: string;
  title: string;
  ownerId: string;
  measureType: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit?: string;
  riskStatus: 'on_track' | 'at_risk' | 'off_track';
}

interface Objective {
  id: string;
  title: string;
  level: 'company' | 'team' | 'individual';
  tags?: string[];
  ownerId: string;
  keyResults: KeyResult[];
}

interface Initiative {
  id: string;
  title: string;
  keyResultId: string;
  status: 'planned' | 'in_progress' | 'done' | 'blocked';
  decisionCardIds?: string[];
}

interface DecisionCard {
  id: string;
  title: string;
  convergenceState: string;
  primaryKrId?: string;
  noKrReason?: string;
  relatedKr?: string[];
  createdAt: string;
}

type OrgNodeKind = 'company' | 'system' | 'department' | 'person' | 'unassigned';
type ScopeMode = 'company' | 'system' | 'department' | 'person';

interface OrgNode {
  id: string;
  kind: OrgNodeKind;
  label: string;
  path: string[];
  parentId: string | null;
  children: OrgNode[];
  ownerIds: Set<string>;
  stats: OrgStats;
  headId?: string | null;
  person?: PersonLike;
  dept?: HrDept;
}

interface OrgStats {
  objectives: number;
  krs: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
}

interface OwnerMeta {
  path: string;
  managerName: string;
}

interface ScopeListNode {
  id: string;
  label: string;
  path: string[];
  stats: OrgStats;
  objectiveIds: Set<string>;
}

const ROOT_NODE_ID = 'org:company';
const UNASSIGNED_NODE_ID = 'org:unassigned';

const EMPTY_STATS: OrgStats = {
  objectives: 0,
  krs: 0,
  onTrack: 0,
  atRisk: 0,
  offTrack: 0,
};

function cloneStats(): OrgStats {
  return { ...EMPTY_STATS };
}

function addStats(target: OrgStats, source: OrgStats) {
  target.objectives += source.objectives;
  target.krs += source.krs;
  target.onTrack += source.onTrack;
  target.atRisk += source.atRisk;
  target.offTrack += source.offTrack;
}

function canonicalPersonOwnerId(id: string): string {
  return id.startsWith('person:') ? id.slice(7) : id;
}

function canonicalTeamOwnerId(id: string): string {
  return id.startsWith('team:') ? id.slice(5) : id;
}

function ownerIdAliases(ownerId: string): string[] {
  if (ownerId.startsWith('person:')) {
    const id = ownerId.slice(7);
    return [ownerId, id];
  }
  if (ownerId.startsWith('team:')) {
    const id = ownerId.slice(5);
    return [ownerId, id];
  }
  return [ownerId, `person:${ownerId}`, `team:${ownerId}`];
}

function formatOrgPath(path: string[]): string {
  if (path.length > 1 && path[0] === '公司') return path.slice(1).join(' / ');
  return path.join(' / ');
}

function riskStatsForObjective(obj: Objective): OrgStats {
  const stats = cloneStats();
  stats.objectives = 1;
  stats.krs = obj.keyResults.length;
  for (const kr of obj.keyResults) {
    if (kr.riskStatus === 'on_track') stats.onTrack += 1;
    else if (kr.riskStatus === 'at_risk') stats.atRisk += 1;
    else stats.offTrack += 1;
  }
  return stats;
}

function makeOrgNode(input: {
  id: string;
  kind: OrgNodeKind;
  label: string;
  path: string[];
  parentId: string | null;
  headId?: string | null;
  person?: PersonLike;
  dept?: HrDept;
}): OrgNode {
  return {
    ...input,
    children: [],
    ownerIds: new Set(),
    stats: cloneStats(),
  };
}

function buildFallbackDepts(departments: ReturnType<typeof useOwnerDirectory>['departments']): HrDept[] {
  return departments.flatMap((d, idx) => [
    {
      id: d.id,
      name: d.name,
      parentId: null,
      headId: null,
      description: '',
      order: idx,
      tenantId: '',
      createdAt: '',
      updatedAt: '',
    },
    ...d.ministries.map((m, mIdx) => ({
      id: m.id,
      name: m.name,
      parentId: d.id,
      headId: null,
      description: m.description ?? '',
      order: mIdx,
      tenantId: '',
      createdAt: '',
      updatedAt: '',
    })),
  ]);
}

function buildOrgModel(input: {
  objectives: Objective[];
  hrDepts: HrDept[];
  fallbackDepartments: ReturnType<typeof useOwnerDirectory>['departments'];
  people: PersonLike[];
  resolveOwner: (ownerId: string | undefined | null) => ResolvedOwner;
  nameOf: (ownerId: string | undefined | null) => string;
}) {
  const depts = input.hrDepts.length > 0
    ? input.hrDepts
    : buildFallbackDepts(input.fallbackDepartments);
  const root = makeOrgNode({
    id: ROOT_NODE_ID,
    kind: 'company',
    label: '公司',
    path: ['公司'],
    parentId: null,
  });
  const unassigned = makeOrgNode({
    id: UNASSIGNED_NODE_ID,
    kind: 'unassigned',
    label: '未归属 / 待整理',
    path: ['未归属 / 待整理'],
    parentId: ROOT_NODE_ID,
  });

  const nodes = new Map<string, OrgNode>([[root.id, root], [unassigned.id, unassigned]]);
  const deptNodes = new Map<string, OrgNode>();
  const personNodes = new Map<string, OrgNode>();

  for (const dept of depts) {
    const node = makeOrgNode({
      id: `dept:${dept.id}`,
      kind: 'department',
      label: dept.name,
      path: [dept.name],
      parentId: dept.parentId ? `dept:${dept.parentId}` : ROOT_NODE_ID,
      headId: dept.headId,
      dept,
    });
    nodes.set(node.id, node);
    deptNodes.set(dept.id, node);
  }

  for (const node of Array.from(deptNodes.values())) {
    const parent = node.parentId ? nodes.get(node.parentId) : root;
    const actualParent = parent ?? root;
    node.parentId = actualParent.id;
    node.path = [...actualParent.path, node.label];
    actualParent.children.push(node);
  }

  for (const person of input.people) {
    const homeDept = person.ministryId ? deptNodes.get(person.ministryId) : undefined;
    const parent = homeDept ?? unassigned;
    const node = makeOrgNode({
      id: `person:${person.id}`,
      kind: 'person',
      label: person.name,
      path: [...parent.path, person.name],
      parentId: parent.id,
      person,
    });
    node.ownerIds.add(person.id);
    node.ownerIds.add(`person:${person.id}`);
    nodes.set(node.id, node);
    personNodes.set(person.id, node);
    parent.children.push(node);
  }

  root.children.push(unassigned);

  function findOwnerNode(ownerId: string, level: OkrDisplayLevel): OrgNode {
    if (level === 'company' || ownerId === '__company__' || ownerId === 'system') return root;
    const rawTeamId = ownerId.startsWith('team:') ? canonicalTeamOwnerId(ownerId) : null;
    if (rawTeamId) return deptNodes.get(rawTeamId) ?? unassigned;
    const rawPersonId = canonicalPersonOwnerId(ownerId);
    const personNode = personNodes.get(rawPersonId);
    if (personNode) return personNode;
    const teamNode = deptNodes.get(rawPersonId);
    if (teamNode) return teamNode;
    const resolved = input.resolveOwner(ownerId);
    if (resolved.personId) return personNodes.get(resolved.personId) ?? unassigned;
    if (resolved.ministryId) return deptNodes.get(resolved.ministryId) ?? unassigned;
    if (resolved.deptId) return deptNodes.get(resolved.deptId) ?? unassigned;
    return unassigned;
  }

  const objectiveCoverageNodeIds = new Map<string, Set<string>>();
  const ownerMeta = new Map<string, OwnerMeta>();

  function recordOwnerMeta(ownerId: string, node: OrgNode) {
    for (const alias of ownerIdAliases(ownerId)) {
      ownerMeta.set(alias, {
        path: formatOrgPath(node.path),
        managerName: node.person?.managerId ? input.nameOf(node.person.managerId) : '—',
      });
    }
  }

  for (const obj of input.objectives) {
    const level = getOkrDisplayLevel(obj);
    const node = findOwnerNode(obj.ownerId, level);
    const coverage = new Set<string>([node.id]);
    recordOwnerMeta(obj.ownerId, node);
    addStats(node.stats, riskStatsForObjective(obj));
    node.ownerIds.add(obj.ownerId);
    for (const kr of obj.keyResults) {
      const krNode = findOwnerNode(kr.ownerId, 'individual');
      coverage.add(krNode.id);
      recordOwnerMeta(kr.ownerId, krNode);
    }
    objectiveCoverageNodeIds.set(obj.id, coverage);
  }

  function rollup(node: OrgNode): OrgStats {
    for (const child of node.children) {
      addStats(node.stats, rollup(child));
      for (const ownerId of Array.from(child.ownerIds)) node.ownerIds.add(ownerId);
    }
    return node.stats;
  }
  rollup(root);

  for (const node of Array.from(nodes.values())) {
    node.children.sort((a: OrgNode, b: OrgNode) => {
      if (a.kind === 'person' && b.kind !== 'person') return 1;
      if (a.kind !== 'person' && b.kind === 'person') return -1;
      return a.label.localeCompare(b.label, 'zh-CN');
    });
  }

  return { root, nodes, objectiveCoverageNodeIds, ownerMeta, hasHrDepts: input.hrDepts.length > 0 };
}

function isNodeUnder(nodeId: string, ancestorId: string, nodes: Map<string, OrgNode>): boolean {
  let cursor = nodes.get(nodeId);
  while (cursor?.parentId) {
    if (cursor.parentId === ancestorId) return true;
    cursor = nodes.get(cursor.parentId);
  }
  return false;
}

function shouldShowOrgNode(node: OrgNode): boolean {
  if (node.kind === 'company') return true;
  if (node.kind === 'unassigned') return node.stats.objectives > 0 || node.stats.krs > 0;
  return node.stats.objectives > 0 || node.stats.krs > 0;
}

const LEVEL_TAGS = ['公司', '体系', '部门', '团队', '个人'];
const SYSTEM_NAME_ALIASES: Record<string, string> = {
  '4294967251': '营销体系',
  '2754088': '营销体系',
};

function normalizeSystemName(value: string | undefined | null): string {
  const text = (value ?? '').trim();
  return SYSTEM_NAME_ALIASES[text] ?? text;
}

function getObjectiveOrgTag(obj: Objective): string {
  const tag = obj.tags?.find((item) => !LEVEL_TAGS.includes(item) && item.trim().length > 0) ?? '';
  return normalizeSystemName(tag);
}

function isOpaqueOrgLabel(value: string): boolean {
  if (!value) return true;
  if (/^\d+$/.test(value)) return true;
  return /^[A-Za-z0-9+/=]{12,}$/.test(value);
}

function splitOrgPath(path: string | undefined): string[] {
  return (path ?? '').split('/').map((item) => item.trim()).filter(Boolean);
}

function getOwnerDepartmentPath(
  ownerId: string,
  ownerMeta: Map<string, OwnerMeta>,
  ownerNameOf: (ownerId: string | undefined | null) => string,
): string[] {
  const parts = splitOrgPath(ownerMeta.get(ownerId)?.path);
  const ownerName = ownerNameOf(ownerId).trim();
  if (parts.length > 1 && ownerName && parts[parts.length - 1] === ownerName) {
    return parts.slice(0, -1);
  }
  return parts;
}

function getSystemKey(obj: Objective): string {
  const tag = getObjectiveOrgTag(obj);
  if (tag) return tag;
  return obj.ownerId || '未归属体系';
}

function getSystemLabel(obj: Objective, ownerNameOf: (ownerId: string | undefined | null) => string): string {
  const tag = getObjectiveOrgTag(obj);
  return tag || ownerNameOf(obj.ownerId) || '未归属体系';
}

function buildSystemNodes(
  objectives: Objective[],
  ownerNameOf: (ownerId: string | undefined | null) => string,
): ScopeListNode[] {
  const nodes = new Map<string, ScopeListNode>();
  for (const obj of objectives) {
    if (getOkrDisplayLevel(obj) !== 'system') continue;
    const key = getSystemKey(obj);
    const label = getSystemLabel(obj, ownerNameOf);
    let node = nodes.get(key);
    if (!node) {
      node = {
        id: `system:${key}`,
        label,
        path: ['公司', label],
        stats: cloneStats(),
        objectiveIds: new Set<string>(),
      };
      nodes.set(key, node);
    }
    addStats(node.stats, riskStatsForObjective(obj));
    node.objectiveIds.add(obj.id);
  }
  return Array.from(nodes.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

function getDepartmentLabel(
  obj: Objective,
  ownerMeta: Map<string, OwnerMeta>,
  ownerNameOf: (ownerId: string | undefined | null) => string,
): string {
  const tag = getObjectiveOrgTag(obj);
  if (tag && !isOpaqueOrgLabel(tag)) return tag;
  const ownerDept = getOwnerDepartmentPath(obj.ownerId, ownerMeta, ownerNameOf).pop();
  if (ownerDept) return ownerDept;
  const krDept = obj.keyResults
    .map((kr) => getOwnerDepartmentPath(kr.ownerId, ownerMeta, ownerNameOf).pop())
    .find(Boolean);
  return krDept ?? '未归属部门';
}

function getDepartmentPath(
  obj: Objective,
  ownerMeta: Map<string, OwnerMeta>,
  ownerNameOf: (ownerId: string | undefined | null) => string,
  label: string,
): string[] {
  const tag = getObjectiveOrgTag(obj);
  const ownerPath = getOwnerDepartmentPath(obj.ownerId, ownerMeta, ownerNameOf);
  if (ownerPath.length > 0 && ownerPath[ownerPath.length - 1] === label) return ownerPath;
  if (tag && !isOpaqueOrgLabel(tag)) return [label];
  if (ownerPath.length > 0) return ownerPath;
  const krPath = obj.keyResults
    .map((kr) => getOwnerDepartmentPath(kr.ownerId, ownerMeta, ownerNameOf))
    .find((path) => path.length > 0);
  if (krPath) return krPath;
  return [label];
}

function buildDepartmentNodes(
  objectives: Objective[],
  ownerMeta: Map<string, OwnerMeta>,
  ownerNameOf: (ownerId: string | undefined | null) => string,
): ScopeListNode[] {
  const nodes = new Map<string, ScopeListNode>();
  for (const obj of objectives) {
    if (getOkrDisplayLevel(obj) !== 'department') continue;
    const label = getDepartmentLabel(obj, ownerMeta, ownerNameOf);
    const path = getDepartmentPath(obj, ownerMeta, ownerNameOf, label);
    const key = formatOrgPath(path) || label;
    let node = nodes.get(key);
    if (!node) {
      node = {
        id: `department-scope:${key}`,
        label,
        path,
        stats: cloneStats(),
        objectiveIds: new Set<string>(),
      };
      nodes.set(key, node);
    }
    addStats(node.stats, riskStatsForObjective(obj));
    node.objectiveIds.add(obj.id);
  }
  return Array.from(nodes.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

function modeMatchesObjective(mode: ScopeMode, obj: Objective): boolean {
  const level = getOkrDisplayLevel(obj);
  if (mode === 'company') return level === 'company';
  if (mode === 'system') return level === 'system';
  if (mode === 'department') return level === 'department';
  return level === 'individual';
}

function addNodeAndAncestors(nodeId: string, nodes: Map<string, OrgNode>, target: Set<string>) {
  let cursor = nodes.get(nodeId);
  while (cursor) {
    target.add(cursor.id);
    cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
  }
}

function buildOrgModeStats(
  objectives: Objective[],
  orgModel: ReturnType<typeof buildOrgModel>,
  mode: 'department' | 'person',
): Map<string, OrgStats> {
  const stats = new Map<string, OrgStats>();
  const ensure = (nodeId: string) => {
    const current = stats.get(nodeId);
    if (current) return current;
    const next = cloneStats();
    stats.set(nodeId, next);
    return next;
  };

  for (const obj of objectives) {
    if (!modeMatchesObjective(mode, obj)) continue;
    const coverage = orgModel.objectiveCoverageNodeIds.get(obj.id) ?? new Set<string>();
    const nodeIds = new Set<string>();
    for (const nodeId of Array.from(coverage)) addNodeAndAncestors(nodeId, orgModel.nodes, nodeIds);
    for (const nodeId of Array.from(nodeIds)) addStats(ensure(nodeId), riskStatsForObjective(obj));
  }
  return stats;
}

function shouldShowOrgNodeForMode(
  node: OrgNode,
  mode: 'department' | 'person',
  stats: Map<string, OrgStats>,
): boolean {
  if (node.kind === 'person' && mode === 'department') return false;
  if (node.kind === 'company') return true;
  if (node.kind === 'unassigned') return mode === 'person' && ((stats.get(node.id)?.objectives ?? 0) > 0);
  const nodeStats = stats.get(node.id) ?? EMPTY_STATS;
  return nodeStats.objectives > 0 || nodeStats.krs > 0;
}

function getVisibleOrgChildrenForMode(
  node: OrgNode,
  mode: 'department' | 'person',
  stats: Map<string, OrgStats>,
  query: string,
): OrgNode[] {
  const selfMatches = orgNodeMatchesSelf(node, query);
  return node.children.filter((child) =>
    shouldShowOrgNodeForMode(child, mode, stats) &&
    (!query || selfMatches || orgNodeMatchesQueryForMode(child, query, mode, stats)),
  );
}

function findFirstVisibleOrgNode(
  node: OrgNode,
  mode: 'department' | 'person',
  stats: Map<string, OrgStats>,
): OrgNode | null {
  for (const child of node.children) {
    if (!shouldShowOrgNodeForMode(child, mode, stats)) continue;
    if (mode === 'person') {
      if (child.kind === 'person') return child;
      const descendant = findFirstVisibleOrgNode(child, mode, stats);
      if (descendant) return descendant;
      continue;
    }
    return child;
  }
  return null;
}

function canManageOrganization(user: { roles?: string[]; permissions?: string[] } | null): boolean {
  const permissions = new Set(user?.permissions ?? []);
  if (permissions.has('organization.manage')) return true;
  const roles = new Set(user?.roles ?? []);
  return ['owner', 'admin', 'steward', 'champion'].some((role) => roles.has(role));
}

function normalizeSearchQuery(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN');
}

function textMatchesQuery(value: string | undefined | null, query: string): boolean {
  if (!query) return true;
  return (value ?? '').toLocaleLowerCase('zh-CN').includes(query);
}

function scopeListNodeMatchesQuery(node: ScopeListNode, query: string): boolean {
  if (!query) return true;
  return textMatchesQuery(node.label, query) || textMatchesQuery(formatOrgPath(node.path), query);
}

function orgNodeMatchesSelf(node: OrgNode, query: string): boolean {
  if (!query) return true;
  return [
    node.label,
    node.path.join(' / '),
    node.person?.name,
    node.dept?.name,
  ].some((value) => textMatchesQuery(value, query));
}

function orgNodeMatchesQueryForMode(
  node: OrgNode,
  query: string,
  mode: 'department' | 'person',
  statsByNode: Map<string, OrgStats>,
): boolean {
  if (!shouldShowOrgNodeForMode(node, mode, statsByNode)) return false;
  if (!query) return true;
  if (orgNodeMatchesSelf(node, query)) return true;
  return node.children.some((child) => orgNodeMatchesQueryForMode(child, query, mode, statsByNode));
}

function objectiveMatchesQuery(
  obj: Objective,
  query: string,
  ownerNameOf: (ownerId: string | undefined | null) => string,
  ownerMeta: Map<string, OwnerMeta>,
): boolean {
  if (!query) return true;
  const objMeta = ownerMeta.get(obj.ownerId);
  const fields = [
    obj.title,
    obj.tags?.join(' '),
    obj.tags?.map(normalizeSystemName).join(' '),
    getOkrDisplayLevelLabel(getOkrDisplayLevel(obj)),
    ownerNameOf(obj.ownerId),
    objMeta?.path,
    objMeta?.managerName,
  ];
  if (fields.some((value) => textMatchesQuery(value, query))) return true;

  return obj.keyResults.some((kr) => {
    const krMeta = ownerMeta.get(kr.ownerId);
    return [
      kr.title,
      kr.measureType,
      ownerNameOf(kr.ownerId),
      krMeta?.path,
      krMeta?.managerName,
    ].some((value) => textMatchesQuery(value, query));
  });
}

export default function OkrCascadePage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [cards, setCards] = useState<DecisionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedObj, setExpandedObj] = useState<Set<string>>(new Set());
  const [expandedKr, setExpandedKr] = useState<Set<string>>(new Set());
  const [scopeMode, setScopeMode] = useState<ScopeMode>('company');
  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState(ROOT_NODE_ID);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [selectedDepartmentScopeId, setSelectedDepartmentScopeId] = useState<string | null>(null);
  const [orgQuery, setOrgQuery] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');
  const treeRef = useRef<HTMLDivElement | null>(null);
  const { nameOf, people, departments, resolve } = useOwnerDirectory();
  const hrDepts = useOrgStore((s) => s.hrDepts);
  const currentUser = useAuthStore((s) => s.user);
  const canMaintainOrg = canManageOrganization(currentUser);

  const orgModel = useMemo(
    () => buildOrgModel({
      objectives,
      hrDepts,
      fallbackDepartments: departments,
      people,
      resolveOwner: resolve,
      nameOf,
    }),
    [departments, hrDepts, nameOf, objectives, people, resolve],
  );

  const selectedOrgNode = orgModel.nodes.get(selectedOrgNodeId) ?? orgModel.root;
  const systemNodes = useMemo(() => buildSystemNodes(objectives, nameOf), [nameOf, objectives]);
  const selectedSystemNode = systemNodes.find((node) => node.id === selectedSystemId) ?? systemNodes[0] ?? null;
  const departmentNodes = useMemo(
    () => buildDepartmentNodes(objectives, orgModel.ownerMeta, nameOf),
    [nameOf, objectives, orgModel.ownerMeta],
  );
  const selectedDepartmentNode =
    departmentNodes.find((node) => node.id === selectedDepartmentScopeId) ?? departmentNodes[0] ?? null;
  const personModeStats = useMemo(
    () => buildOrgModeStats(objectives, orgModel, 'person'),
    [objectives, orgModel],
  );
  const activeOrgNode = selectedOrgNode;
  const normalizedOrgQuery = normalizeSearchQuery(orgQuery);
  const normalizedGlobalQuery = normalizeSearchQuery(globalQuery);
  const filteredDepartmentNodes = useMemo(
    () => departmentNodes.filter((node) => scopeListNodeMatchesQuery(node, normalizedOrgQuery)),
    [departmentNodes, normalizedOrgQuery],
  );
  const visibleOrgRoots = useMemo(
    () =>
      scopeMode === 'person'
        ? getVisibleOrgChildrenForMode(orgModel.root, 'person', personModeStats, normalizedOrgQuery)
        : [],
    [normalizedOrgQuery, orgModel.root, personModeStats, scopeMode],
  );
  const orgTreeHasResults = useMemo(
    () => {
      if (scopeMode === 'company') return true;
      if (scopeMode === 'system') {
        return systemNodes.some((node) => scopeListNodeMatchesQuery(node, normalizedOrgQuery));
      }
      if (scopeMode === 'department') return filteredDepartmentNodes.length > 0;
      return visibleOrgRoots.length > 0;
    },
    [filteredDepartmentNodes.length, normalizedOrgQuery, scopeMode, systemNodes, visibleOrgRoots.length],
  );

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (scopeMode !== 'person') return;
    const currentVisible =
      activeOrgNode.id !== ROOT_NODE_ID &&
      shouldShowOrgNodeForMode(activeOrgNode, 'person', personModeStats);
    if (currentVisible) {
      if (selectedOrgNode.id !== activeOrgNode.id) setSelectedOrgNodeId(activeOrgNode.id);
      return;
    }
    const first = findFirstVisibleOrgNode(orgModel.root, 'person', personModeStats);
    if (first) setSelectedOrgNodeId(first.id);
  }, [activeOrgNode, orgModel.root, personModeStats, scopeMode, selectedOrgNode.id]);

  async function load() {
    setLoading(true);
    try {
      const [okrRes, cardsRes] = await Promise.all([
        fetch('/api/tandem-okr'),
        fetch('/api/convergence'),
      ]);
      const okrJson = await okrRes.json();
      const cardsJson = await cardsRes.json();
      const objs = (okrJson.objectives ?? []) as Objective[];
      setObjectives(objs);
      setCards((cardsJson.cards ?? []) as DecisionCard[]);

      // Initiatives are not in /api/tandem-okr today; collect from KRs if exposed.
      // V1: Initiatives table exists in Prisma but no GET endpoint yet — fallback empty.
      // (Will surface in M2 with /api/initiatives endpoint.)
      setInitiatives([]);

      // Auto-expand first objective if any
      if (objs.length > 0) setExpandedObj(new Set([objs[0].id]));
    } finally {
      setLoading(false);
    }
  }

  function toggleObj(id: string) {
    setExpandedObj((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleKr(id: string) {
    setExpandedKr((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const orgScopedObjectives = useMemo(() => {
    if (scopeMode === 'company') {
      return objectives.filter((obj) => getOkrDisplayLevel(obj) === 'company');
    }
    if (scopeMode === 'system') {
      if (!selectedSystemNode) return [];
      return objectives.filter((obj) =>
        getOkrDisplayLevel(obj) === 'system' && `system:${getSystemKey(obj)}` === selectedSystemNode.id,
      );
    }
    if (scopeMode === 'department') {
      if (!selectedDepartmentNode) return [];
      return objectives.filter((obj) => selectedDepartmentNode.objectiveIds.has(obj.id));
    }

    return objectives.filter((obj) => {
      if (!modeMatchesObjective(scopeMode, obj)) return false;
      if (scopeMode === 'person' && activeOrgNode.kind !== 'person') return false;
      if (activeOrgNode.id === ROOT_NODE_ID) return true;
      const coverage = orgModel.objectiveCoverageNodeIds.get(obj.id) ?? new Set<string>();
      return Array.from(coverage).some((nodeId) =>
        nodeId === activeOrgNode.id || isNodeUnder(nodeId, activeOrgNode.id, orgModel.nodes),
      );
    });
  }, [
    activeOrgNode,
    objectives,
    orgModel.nodes,
    orgModel.objectiveCoverageNodeIds,
    scopeMode,
    selectedDepartmentNode,
    selectedSystemNode,
  ]);

  const selectedObjectives = useMemo(
    () =>
      orgScopedObjectives.filter((obj) =>
        objectiveMatchesQuery(obj, normalizedGlobalQuery, nameOf, orgModel.ownerMeta),
      ),
    [nameOf, normalizedGlobalQuery, orgModel.ownerMeta, orgScopedObjectives],
  );

  const filteredObjectives = useMemo(() => {
    return [...selectedObjectives].sort((a, b) => {
      const levelOrder: Record<OkrDisplayLevel, number> = { company: 0, system: 1, department: 2, individual: 3 };
      const la = levelOrder[getOkrDisplayLevel(a)];
      const lb = levelOrder[getOkrDisplayLevel(b)];
      if (la !== lb) return la - lb;
      return a.title.localeCompare(b.title, 'zh-CN');
    });
  }, [selectedObjectives]);

  const selectedStats = useMemo(() => {
    const stats = cloneStats();
    for (const obj of selectedObjectives) addStats(stats, riskStatsForObjective(obj));
    return stats;
  }, [selectedObjectives]);

  const selectedKrs = selectedObjectives.flatMap((o) => o.keyResults);
  const selectedKrIds = new Set(selectedKrs.map((kr) => kr.id));
  const selectedCards = cards.filter((c) =>
    (c.primaryKrId && selectedKrIds.has(c.primaryKrId)) ||
    (c.relatedKr ?? []).some((krId) => selectedKrIds.has(krId)),
  );

  function scrollToTree() {
    treeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showObjectiveDetails() {
    setExpandedObj(new Set(filteredObjectives.map((o) => o.id)));
    scrollToTree();
  }

  function showKrDetails() {
    setExpandedObj(new Set(filteredObjectives.map((o) => o.id)));
    setExpandedKr(new Set(filteredObjectives.flatMap((o) => o.keyResults.map((kr) => kr.id))));
    scrollToTree();
  }

  const activeDetailNode = useMemo<OrgNode>(() => {
    if (scopeMode === 'system' && selectedSystemNode) {
      return {
        id: selectedSystemNode.id,
        kind: 'system',
        label: selectedSystemNode.label,
        path: selectedSystemNode.path,
        parentId: ROOT_NODE_ID,
        children: [],
        ownerIds: new Set(),
        stats: selectedSystemNode.stats,
      };
    }
    if (scopeMode === 'department' && selectedDepartmentNode) {
      return {
        id: selectedDepartmentNode.id,
        kind: 'department',
        label: selectedDepartmentNode.label,
        path: selectedDepartmentNode.path,
        parentId: ROOT_NODE_ID,
        children: [],
        ownerIds: new Set(),
        stats: selectedDepartmentNode.stats,
      };
    }
    if (scopeMode === 'company') return orgModel.root;
    return activeOrgNode;
  }, [activeOrgNode, orgModel.root, scopeMode, selectedDepartmentNode, selectedSystemNode]);

  const leftSubtitle = {
    company: '公司级 OKR',
    system: '来自 OKR 表格的体系字段',
    department: '来自 OKR 表格的部门级目标',
    person: '组织树 · 仅个人级 OKR',
  }[scopeMode];

  const activeScopePath = scopeMode === 'system' && selectedSystemNode
    ? formatOrgPath(selectedSystemNode.path)
    : scopeMode === 'department' && selectedDepartmentNode
    ? formatOrgPath(selectedDepartmentNode.path)
    : scopeMode === 'company'
    ? '公司'
    : formatOrgPath(activeOrgNode.path);
  const needsPersonSelection = scopeMode === 'person' && activeOrgNode.kind !== 'person';

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-surface-1 to-surface-2/50">
      <div className="page-container py-8 space-y-5">
        {/* Header */}
        <header className="animate-fade-in-up">
          <p className="text-caption text-ink-tertiary inline-flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            OKR · 5 层级联视图
          </p>
          <h1 className="mt-1 text-title-3 text-ink-primary">事半 · OKR 树</h1>
          <p className="mt-1 text-caption text-ink-secondary">
            Objective → KR → Initiative → DecisionCard → ActionItem · AI 滞后预警 (M3)
          </p>
        </header>

        <label className="flex max-w-3xl items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-secondary shadow-soft focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
          <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
          <input
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
            placeholder="全局搜索：姓名 / 部门 / OKR / KR"
            className="min-w-0 flex-1 bg-transparent text-caption text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
          />
        </label>

        {/* Top metrics: current org node */}
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard
            label="当前范围 Objective"
            value={selectedStats.objectives}
            icon={Building2}
            tone="brand"
            onClick={showObjectiveDetails}
          />
          <MetricCard
            label="KR 健康"
            value={selectedStats.krs > 0 ? `${selectedStats.onTrack}/${selectedStats.krs}` : '—'}
            icon={Target}
            tone="success"
            hint={
              selectedStats.krs > 0
                ? `${Math.round((selectedStats.onTrack / selectedStats.krs) * 100)}% 在轨 · ${selectedStats.offTrack} 严重偏离`
                : '暂无 KR'
            }
            onClick={showKrDetails}
          />
          <MetricCard
            label="关联议事室决议"
            value={selectedCards.length}
            icon={Sparkles}
            tone="info"
            hint={`${selectedCards.filter((c) => c.primaryKrId).length} 已绑 KR`}
            href="/convergence"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <section className="card-elevated h-fit overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <p className="text-caption font-semibold text-ink-primary">OKR 范围</p>
              <p className="mt-0.5 text-footnote text-ink-tertiary">{leftSubtitle}</p>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {([
                  ['company', '公司'],
                  ['system', '体系'],
                  ['department', '部门'],
                  ['person', '个人'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setScopeMode(mode);
                      setExpandedObj(new Set());
                      setExpandedKr(new Set());
                    }}
                    className={`rounded-md px-2 py-1.5 text-caption font-medium transition-colors ${
                      scopeMode === mode
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                        : 'bg-surface-2 text-ink-secondary hover:bg-surface-3 hover:text-ink-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {scopeMode !== 'company' && (
            <div className="border-b border-border px-3 py-2">
              <label className="flex items-center gap-2 rounded-md border border-border bg-surface-1 px-2.5 py-2 text-caption text-ink-secondary focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
                <Search className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
                <input
                  value={orgQuery}
                  onChange={(event) => setOrgQuery(event.target.value)}
                  placeholder={
                    scopeMode === 'system'
                      ? '搜索体系'
                      : scopeMode === 'department'
                      ? '搜索部门'
                      : '搜索组织或人员'
                  }
                  className="min-w-0 flex-1 bg-transparent text-caption text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
                />
              </label>
            </div>
            )}
            <div className="max-h-[680px] overflow-auto p-2">
              {scopeMode === 'company' ? (
                <ScopeButton
                  id={ROOT_NODE_ID}
                  label="公司"
                  path="公司级 OKR"
                  stats={selectedStats}
                  active
                  icon={Building2}
                  onClick={() => undefined}
                />
              ) : scopeMode === 'system' ? (
                <div className="space-y-1.5">
                  {systemNodes
                    .filter((node) => scopeListNodeMatchesQuery(node, normalizedOrgQuery))
                    .map((node) => (
                      <ScopeButton
                        key={node.id}
                        id={node.id}
                        label={node.label}
                        path="体系级 OKR"
                        stats={node.stats}
                        active={selectedSystemNode?.id === node.id}
                        icon={Users}
                        onClick={() => {
                          setSelectedSystemId(node.id);
                          setExpandedObj(new Set());
                          setExpandedKr(new Set());
                        }}
                      />
                    ))}
                  {systemNodes.length === 0 && (
                    <div className="px-3 py-8 text-center text-caption text-ink-tertiary">暂无体系级 OKR</div>
                  )}
                  {systemNodes.length > 0 && !orgTreeHasResults && (
                    <div className="px-3 py-8 text-center text-caption text-ink-tertiary">没有匹配的体系</div>
                  )}
                </div>
              ) : scopeMode === 'department' ? (
                <div className="space-y-1.5">
                  {filteredDepartmentNodes.map((node) => (
                    <ScopeButton
                      key={node.id}
                      id={node.id}
                      label={node.label}
                      path={formatOrgPath(node.path)}
                      stats={node.stats}
                      active={selectedDepartmentNode?.id === node.id}
                      icon={Users}
                      onClick={() => {
                        setSelectedDepartmentScopeId(node.id);
                        setExpandedObj(new Set());
                        setExpandedKr(new Set());
                      }}
                    />
                  ))}
                  {departmentNodes.length === 0 && (
                    <div className="px-3 py-8 text-center text-caption text-ink-tertiary">暂无部门级 OKR</div>
                  )}
                  {departmentNodes.length > 0 && filteredDepartmentNodes.length === 0 && (
                    <div className="px-3 py-8 text-center text-caption text-ink-tertiary">没有匹配的部门</div>
                  )}
                </div>
              ) : orgTreeHasResults ? (
                <div className="space-y-0.5">
                  {visibleOrgRoots.map((node) => (
                    <OrgTree
                      key={node.id}
                      node={node}
                      selectedId={activeOrgNode.id}
                      query={normalizedOrgQuery}
                      mode="person"
                      statsByNode={personModeStats}
                      onSelect={(id) => {
                        setSelectedOrgNodeId(id);
                        setExpandedObj(new Set());
                        setExpandedKr(new Set());
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-3 py-8 text-center text-caption text-ink-tertiary">没有匹配的人员</div>
              )}
            </div>
          </section>

          <section ref={treeRef} className="min-w-0 space-y-4">
            <div className="card-elevated p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-footnote text-ink-tertiary">
                    {normalizedGlobalQuery ? '当前 OKR 范围 · 已搜索' : '当前 OKR 范围'}
                  </p>
                  <h2 className="mt-0.5 truncate text-headline text-ink-primary">
                    {activeScopePath}
                  </h2>
                </div>
                {canMaintainOrg && (
                  <Link
                    href="/admin/organization"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-caption font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
                  >
                    维护组织架构 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {loading ? (
              <div className="card-elevated flex items-center justify-center gap-2 p-12 text-caption text-ink-tertiary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                加载 OKR 树...
              </div>
            ) : objectives.length === 0 ? (
              <div className="card-elevated p-12 text-center">
                <p className="text-body text-ink-secondary">还没有 OKR</p>
                <Link
                  href="/okr"
                  className="mt-3 inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
                >
                  去创建第一个 Objective <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : filteredObjectives.length === 0 ? (
              <div className="card-elevated p-12 text-center">
                <p className="text-body text-ink-secondary">
                  {needsPersonSelection
                    ? '请选择具体人员查看个人 OKR'
                    : normalizedGlobalQuery
                    ? '当前 OKR 范围内没有匹配的 Objective'
                    : '当前范围下没有 Objective'}
                </p>
                {!needsPersonSelection && (
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalQuery('');
                    }}
                    className="mt-3 text-caption text-brand-600 hover:text-brand-700 font-medium"
                  >
                    {normalizedGlobalQuery ? '清空搜索条件 →' : '切换左侧范围查看 →'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredObjectives.map((obj) => (
                  <ObjectiveNode
                    key={obj.id}
                    obj={obj}
                    expanded={expandedObj.has(obj.id)}
                    onToggle={() => toggleObj(obj.id)}
                    expandedKr={expandedKr}
                    onToggleKr={toggleKr}
                    initiatives={initiatives}
                    cards={cards}
                    ownerNameOf={nameOf}
                    ownerMeta={orgModel.ownerMeta}
                  />
                ))}
              </div>
            )}
          </section>

          <OrgDetailPanel
            node={activeDetailNode}
            stats={selectedStats}
            objectives={selectedObjectives}
            cards={selectedCards}
            ownerNameOf={nameOf}
            unresolvedCount={orgModel.nodes.get(UNASSIGNED_NODE_ID)?.stats.objectives ?? 0}
          />
        </div>

        {/* Legend */}
        <div className="card-elevated p-4 mt-8">
          <p className="text-caption font-semibold text-ink-primary mb-2">5 层结构</p>
          <div className="flex flex-wrap gap-4 text-footnote text-ink-secondary">
            <Legend icon={Building2} label="Objective (O)" tone="text-info" />
            <Legend icon={Target} label="Key Result (KR)" tone="text-success" />
            <Legend icon={Sparkles} label="Initiative (跨季度)" tone="text-brand-700" />
            <Legend icon={Sparkles} label="DecisionCard (议事)" tone="text-brand-600" />
            <Legend icon={ListChecks} label="ActionItem (任务)" tone="text-ink-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────── Sub-components ────────────

function ScopeButton({
  label,
  path,
  stats,
  active,
  icon: Icon,
  onClick,
}: {
  id: string;
  label: string;
  path: string;
  stats: OrgStats;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  const hasRisk = stats.offTrack > 0 || stats.atRisk > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-3 text-left transition-colors duration-fast ${
        active
          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
          : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary'
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
        active ? 'bg-brand-100 text-brand-700' : 'bg-surface-3 text-ink-secondary'
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-caption font-semibold">{label}</span>
        <span className="mt-0.5 block truncate text-footnote opacity-75">{path}</span>
        <span className="mt-0.5 block truncate text-footnote opacity-75">
          {stats.objectives} O · {stats.krs} KR{hasRisk ? ` · ${stats.offTrack + stats.atRisk} 风险` : ''}
        </span>
      </span>
    </button>
  );
}

function OrgTree({
  node,
  selectedId,
  query,
  mode,
  statsByNode,
  onSelect,
  depth = 0,
}: {
  node: OrgNode;
  selectedId: string;
  query: string;
  mode: 'department' | 'person';
  statsByNode: Map<string, OrgStats>;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const isDepartment = node.kind === 'department';
  const isPerson = node.kind === 'person';
  const Icon =
    node.kind === 'company'
      ? Building2
      : isPerson
      ? User
      : node.kind === 'unassigned'
      ? AlertTriangle
      : isDepartment
      ? Folder
      : Users;
  const active = selectedId === node.id;
  const nodeStats = statsByNode.get(node.id) ?? EMPTY_STATS;
  const shouldShowStats = mode !== 'person' || node.kind === 'person';
  const hasRisk = shouldShowStats && (nodeStats.offTrack > 0 || nodeStats.atRisk > 0);
  const selfMatches = orgNodeMatchesSelf(node, query);
  const visibleChildren = node.children.filter((child) =>
    shouldShowOrgNodeForMode(child, mode, statsByNode) &&
    (!query || selfMatches || orgNodeMatchesQueryForMode(child, query, mode, statsByNode)),
  );
  const rowClass = active
    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
    : isDepartment
    ? 'bg-surface-2/70 text-ink-primary hover:bg-brand-50/60 hover:text-brand-700'
    : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary';
  const iconClass = active
    ? 'bg-brand-100 text-brand-700'
    : isDepartment
    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
    : isPerson
    ? 'bg-surface-1 text-ink-tertiary ring-1 ring-border'
    : 'bg-surface-3 text-ink-secondary';
  const labelClass = active
    ? 'font-semibold text-brand-700'
    : isPerson
    ? 'font-medium text-ink-secondary'
    : 'font-semibold text-ink-primary';
  const typeLabel = isPerson ? '人员' : isDepartment ? '部门' : node.kind === 'unassigned' ? '待归属' : '组织';

  return (
    <div className={isDepartment ? 'pt-0.5' : undefined}>
      <button
        type="button"
        data-org-unassigned={node.id === UNASSIGNED_NODE_ID ? 'true' : undefined}
        onClick={() => onSelect(node.id)}
        className={`flex w-full items-center gap-2 rounded-md px-2 text-left transition-colors duration-fast ${
          isDepartment ? 'py-2.5' : 'py-2'
        } ${rowClass}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${
          isPerson ? 'rounded-full' : 'rounded-md'
        } ${iconClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate text-caption ${labelClass}`}>{node.label}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${
              isPerson
                ? 'bg-surface-2 text-ink-tertiary'
                : isDepartment
                ? 'bg-brand-100 text-brand-700'
                : 'bg-warning/10 text-warning'
            }`}>
              {typeLabel}
            </span>
          </span>
          {shouldShowStats ? (
            <span className="mt-0.5 block truncate text-footnote opacity-75">
              {nodeStats.objectives} O · {nodeStats.krs} KR
              {hasRisk ? ` · ${nodeStats.offTrack + nodeStats.atRisk} 风险` : ''}
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-footnote opacity-75">选择下级人员查看 OKR</span>
          )}
        </span>
      </button>
      {visibleChildren.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {visibleChildren.map((child) => (
            <OrgTree
              key={child.id}
              node={child}
              selectedId={selectedId}
              query={query}
              mode={mode}
              statsByNode={statsByNode}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgDetailPanel({
  node,
  stats,
  objectives,
  cards,
  ownerNameOf,
  unresolvedCount,
}: {
  node: OrgNode;
  stats: OrgStats;
  objectives: Objective[];
  cards: DecisionCard[];
  ownerNameOf: (ownerId: string) => string;
  unresolvedCount: number;
}) {
  const riskyKrs = objectives
    .flatMap((obj) => obj.keyResults.map((kr) => ({ obj, kr })))
    .filter(({ kr }) => kr.riskStatus !== 'on_track')
    .slice(0, 6);
  const managerName = node.person?.managerId ? ownerNameOf(node.person.managerId) : '—';
  const headName = node.headId ? ownerNameOf(node.headId) : '未设置';
  const displayPath = formatOrgPath(node.path);
  const parentPath = node.path.slice(0, -1);
  const parentLabel =
    node.parentId && !(parentPath.length === 1 && parentPath[0] === '公司')
      ? formatOrgPath(parentPath) || '—'
      : '—';

  return (
    <aside className="card-elevated h-fit overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-caption font-semibold text-ink-primary">节点详情</p>
        <p className="mt-0.5 truncate text-footnote text-ink-tertiary">{displayPath}</p>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="text-headline text-ink-primary">{node.label}</p>
          <p className="mt-1 text-caption text-ink-secondary">
            {node.kind === 'person'
              ? `直属上级：${managerName}`
              : node.kind === 'department'
              ? `部门负责人：${headName}`
              : node.kind === 'system'
              ? '体系级总览'
              : node.kind === 'unassigned'
              ? '需要补齐负责人或组织归属'
              : '公司级总览'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Objective" value={stats.objectives} />
          <MiniStat label="KR" value={stats.krs} />
          <MiniStat label="在轨 KR" value={stats.onTrack} tone="success" />
          <MiniStat label="风险 KR" value={stats.atRisk + stats.offTrack} tone={stats.offTrack > 0 ? 'danger' : 'warning'} />
        </div>

        <div className="rounded-md border border-border bg-surface-2/50 p-3">
          <p className="text-footnote font-semibold text-ink-tertiary">组织路径</p>
          <p className="mt-1 text-caption text-ink-primary">{displayPath}</p>
          <p className="mt-2 text-footnote font-semibold text-ink-tertiary">上级组织</p>
          <p className="mt-1 text-caption text-ink-primary">{parentLabel}</p>
        </div>

        {unresolvedCount > 0 && node.id !== UNASSIGNED_NODE_ID && (
          <button
            type="button"
            onClick={() => {
              const el = document.querySelector('[data-org-unassigned="true"]') as HTMLButtonElement | null;
              el?.click();
            }}
            className="w-full rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-left text-caption text-danger hover:bg-danger/10"
          >
            还有 {unresolvedCount} 个 Objective 未挂组织，需要整理。
          </button>
        )}

        <div>
          <p className="mb-2 text-caption font-semibold text-ink-primary">风险 KR</p>
          {riskyKrs.length === 0 ? (
            <p className="rounded-md bg-success/10 px-3 py-2 text-caption text-success">当前范围暂无风险 KR</p>
          ) : (
            <div className="space-y-2">
              {riskyKrs.map(({ obj, kr }) => (
                <div key={kr.id} className="rounded-md border border-border px-3 py-2">
                  <p className="line-clamp-2 text-caption font-medium text-ink-primary">{kr.title}</p>
                  <p className="mt-1 truncate text-footnote text-ink-tertiary">{obj.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-caption font-semibold text-ink-primary">关联议事</p>
          <p className="text-caption text-ink-secondary">{cards.length} 条决议 / 议事绑定到当前范围 KR</p>
        </div>
      </div>
    </aside>
  );
}

function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    default: 'text-ink-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];
  return (
    <div className="rounded-md border border-border bg-surface-1 p-3">
      <p className="text-footnote text-ink-tertiary">{label}</p>
      <p className={`mt-1 text-headline tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function ObjectiveNode({
  obj,
  expanded,
  onToggle,
  expandedKr,
  onToggleKr,
  initiatives,
  cards,
  ownerNameOf,
  ownerMeta,
}: {
  obj: Objective;
  expanded: boolean;
  onToggle: () => void;
  expandedKr: Set<string>;
  onToggleKr: (id: string) => void;
  initiatives: Initiative[];
  cards: DecisionCard[];
  ownerNameOf: (ownerId: string) => string;
  ownerMeta: Map<string, OwnerMeta>;
}) {
  const displayLevel = getOkrDisplayLevel(obj);
  const LevelIcon = displayLevel === 'company' ? Building2 : displayLevel === 'individual' ? User : Users;
  const ownerName = ownerNameOf(obj.ownerId);
  const meta = ownerMeta.get(obj.ownerId);

  return (
    <div className="card-elevated overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 surface-interactive text-left hover:bg-surface-2 transition-colors duration-fast"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-ink-tertiary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-tertiary" />
        )}
        <span className="rounded-md bg-info/10 text-info p-2">
          <LevelIcon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[15px] font-semibold leading-5 text-ink-primary">{obj.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-ink-tertiary">
            <span>{getOkrDisplayLevelLabel(displayLevel)}</span>
            <span>负责人：{ownerName}</span>
            <span>组织：{meta?.path ?? '未归属 / 待整理'}</span>
            <span>直属上级：{meta?.managerName ?? '—'}</span>
            <span>{obj.keyResults.length} KR</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-surface-2/40 px-4 py-3 space-y-2 animate-fade-in-up">
          {obj.keyResults.length === 0 ? (
            <p className="ml-7 text-caption text-ink-tertiary py-2">暂无 KR</p>
          ) : (
            obj.keyResults.map((kr) => (
              <KrNode
                key={kr.id}
                kr={kr}
                expanded={expandedKr.has(kr.id)}
                onToggle={() => onToggleKr(kr.id)}
                initiatives={initiatives.filter((i) => i.keyResultId === kr.id)}
                cards={cards.filter((c) => c.primaryKrId === kr.id || c.relatedKr?.includes(kr.id))}
                ownerName={ownerNameOf(kr.ownerId)}
                ownerMeta={ownerMeta.get(kr.ownerId)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function KrNode({
  kr,
  expanded,
  onToggle,
  initiatives,
  cards,
  ownerName,
  ownerMeta,
}: {
  kr: KeyResult;
  expanded: boolean;
  onToggle: () => void;
  initiatives: Initiative[];
  cards: DecisionCard[];
  ownerName: string;
  ownerMeta?: OwnerMeta;
}) {
  const progress =
    kr.targetValue !== kr.startValue
      ? Math.max(0, Math.min(100, ((kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue)) * 100))
      : 0;
  const progressBarRef = useDynamicStyle<HTMLDivElement>({ width: `${progress}%` });

  const riskTone =
    kr.riskStatus === 'on_track'
      ? 'text-success bg-success/10'
      : kr.riskStatus === 'at_risk'
      ? 'text-warning bg-warning/10'
      : 'text-danger bg-danger/10';

  const RiskIcon =
    kr.riskStatus === 'on_track' ? CheckCircle2 : kr.riskStatus === 'at_risk' ? AlertTriangle : XCircle;

  return (
    <div className="ml-4 rounded-md border border-border bg-surface-1 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left surface-interactive hover:bg-surface-2 transition-colors duration-fast"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-ink-tertiary" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-ink-tertiary" />
        )}
        <span className={`rounded p-1.5 ${riskTone}`}>
          <RiskIcon className="h-3 w-3" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[14px] font-medium leading-5 text-ink-primary">{kr.title}</p>
          <p className="mt-0.5 text-footnote text-ink-tertiary">
            负责人：{ownerName} · 组织：{ownerMeta?.path ?? '未归属 / 待整理'}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex-1 max-w-xs h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div
                ref={progressBarRef}
                className={`h-full transition-all duration-base ease-decelerate ${
                  kr.riskStatus === 'on_track'
                    ? 'bg-success'
                    : kr.riskStatus === 'at_risk'
                    ? 'bg-warning'
                    : 'bg-danger'
                }`}
              />
            </div>
            <span className="text-footnote text-ink-tertiary tabular-nums">
              {kr.currentValue}{kr.unit ?? ''} / {kr.targetValue}{kr.unit ?? ''} ({Math.round(progress)}%)
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-surface-2/30 px-4 py-2 space-y-1.5 animate-fade-in-up">
          {/* Initiatives */}
          {initiatives.length > 0 && (
            <div className="space-y-1">
              <p className="ml-6 text-footnote font-semibold text-ink-tertiary uppercase tracking-wider mt-1">
                Initiative ({initiatives.length})
              </p>
              {initiatives.map((init) => (
                <div key={init.id} className="ml-6 flex items-center gap-2 px-2 py-1 text-caption text-ink-secondary">
                  <Sparkles className="h-3 w-3 text-brand-700" />
                  <span className="flex-1 truncate">{init.title}</span>
                  <InitiativeBadge status={init.status} />
                </div>
              ))}
            </div>
          )}

          {/* Decision Cards */}
          {cards.length > 0 && (
            <div className="space-y-1">
              <p className="ml-6 text-footnote font-semibold text-ink-tertiary uppercase tracking-wider mt-2">
                议事 / DC ({cards.length})
              </p>
              {cards.slice(0, 5).map((c) => (
                <Link
                  key={c.id}
                  href={`/convergence/${c.id}`}
                  className="ml-6 flex items-center gap-2 px-2 py-1 text-caption text-ink-secondary hover:bg-surface-3 hover:text-ink-primary rounded transition-colors duration-fast"
                >
                  <Sparkles className="h-3 w-3 text-brand-500" />
                  <span className="flex-1 truncate">{c.title}</span>
                  <span className="text-footnote text-ink-tertiary">{c.convergenceState}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
              {cards.length > 5 && (
                <p className="ml-6 px-2 py-0.5 text-footnote text-ink-tertiary">
                  ... 还有 {cards.length - 5} 条
                </p>
              )}
            </div>
          )}

          {initiatives.length === 0 && cards.length === 0 && (
            <p className="ml-6 text-footnote text-ink-tertiary py-1">
              暂无 Initiative / 议事 · 在 /convergence 发起新议事时绑定本 KR
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InitiativeBadge({ status }: { status: Initiative['status'] }) {
  const map = {
    planned:     { label: '计划', tone: 'bg-surface-3 text-ink-secondary' },
    in_progress: { label: '进行中', tone: 'bg-info/10 text-info' },
    done:        { label: '已成', tone: 'bg-success/10 text-success' },
    blocked:     { label: '阻塞', tone: 'bg-danger/10 text-danger' },
  };
  const m = map[status] ?? { label: status, tone: 'bg-surface-3 text-ink-secondary' };
  return <span className={`rounded px-1.5 py-0.5 text-footnote ${m.tone}`}>{m.label}</span>;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  onClick,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'info';
  hint?: string;
  onClick?: () => void;
  href?: string;
}) {
  const toneMap = {
    brand:   'bg-brand-50 text-brand-600',
    success: 'bg-success/10 text-success',
    info:    'bg-info/10 text-info',
  };
  const className =
    'card-elevated p-4 text-left transition-colors duration-fast hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-brand-100';
  const content = (
    <>
      <div className="flex items-start justify-between">
        <span className="text-caption text-ink-secondary">{label}</span>
        <span className={`rounded-md p-1.5 ${toneMap[tone]}`}>
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <div className="mt-2 text-title-3 font-semibold text-ink-primary tabular-nums">{value}</div>
      {hint && <p className="mt-1 text-footnote text-ink-tertiary">{hint}</p>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-label={`查看${label}明细`}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} aria-label={`查看${label}明细`}>
      {content}
    </button>
  );
}

function Legend({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span>{label}</span>
    </span>
  );
}
