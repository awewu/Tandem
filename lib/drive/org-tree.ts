import type { DriveFile } from '@/lib/types/feishu-catchup';

export interface DriveDeptTreeNode {
  id: string;
  deptId: string;
  name: string;
  parentId: string | null;
  updatedAt: string;
  peopleCount: number;
  children: DriveDeptTreeNode[];
}

export function buildDriveDeptTree(
  depts: Array<{ id: string; name: string; parentId: string | null; updatedAt: string }>,
  folderByDeptId: Map<string, DriveFile>,
  peopleByDeptId: Map<string, number>,
): DriveDeptTreeNode[] {
  const children = new Map<string | null, DriveDeptTreeNode[]>();
  const nodeById = new Map<string, DriveDeptTreeNode>();
  const visibleDeptIds = new Set(Array.from(folderByDeptId.keys()));

  for (const dept of depts) {
    const folder = folderByDeptId.get(dept.id);
    if (!folder) continue;
    const parentId = dept.parentId && visibleDeptIds.has(dept.parentId) ? dept.parentId : null;
    const node: DriveDeptTreeNode = {
      id: folder.id,
      deptId: dept.id,
      name: dept.name,
      parentId,
      updatedAt: folder.updatedAt ?? dept.updatedAt,
      peopleCount: peopleByDeptId.get(dept.id) ?? 0,
      children: [],
    };
    nodeById.set(dept.id, node);
    children.set(parentId, [...(children.get(parentId) ?? []), node]);
  }

  for (const node of Array.from(nodeById.values())) {
    node.children = (children.get(node.deptId) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }
  return (children.get(null) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
