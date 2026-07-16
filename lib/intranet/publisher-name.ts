import type { IntranetPost } from '@/lib/types/intranet-post';

const LEGACY_SHOWCASE_AUTHORS: Record<string, string> = {
  '恒热 Everhot · 2026 Q2 启动: 华东增长第一': '何恒',
  '差旅与报销新政 (2026 版)': '何娟',
  '里程碑: 第 100 家经销商签约': '李伟',
  '夏季福利: 全员体检 + 高温补贴': '何娟',
};

export function resolveIntranetPublisherName(
  post: Pick<IntranetPost, 'title' | 'publishedBy' | 'publishedByName'>,
  userNameById: ReadonlyMap<string, string>,
): string {
  return post.publishedByName?.trim()
    || userNameById.get(post.publishedBy)
    || LEGACY_SHOWCASE_AUTHORS[post.title]
    || '未知人员';
}
