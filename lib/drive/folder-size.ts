import type { DriveFile } from '@/lib/types/feishu-catchup';

export function buildFolderSizeMap(files: DriveFile[]): Map<string, number> {
  const byId = new Map(files.filter((file) => !file.deletedAt).map((file) => [file.id, file]));
  const childrenByParent = new Map<string, DriveFile[]>();
  for (const file of Array.from(byId.values())) {
    if (!file.parentId) continue;
    childrenByParent.set(file.parentId, [...(childrenByParent.get(file.parentId) ?? []), file]);
  }

  const memo = new Map<string, number>();
  const folderSize = (folderId: string, visiting: Set<string>): number => {
    if (memo.has(folderId)) return memo.get(folderId) ?? 0;
    if (visiting.has(folderId)) return 0;
    visiting.add(folderId);
    let total = 0;
    for (const child of childrenByParent.get(folderId) ?? []) {
      total += child.isFolder ? folderSize(child.id, visiting) : child.size ?? 0;
    }
    visiting.delete(folderId);
    memo.set(folderId, total);
    return total;
  };

  for (const file of Array.from(byId.values())) {
    if (file.isFolder) folderSize(file.id, new Set());
  }
  return memo;
}
