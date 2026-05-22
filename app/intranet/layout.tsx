/**
 * Intranet 模块统一布局
 *
 * 合并 SubSidebar + TopSubnav 到一条横向导航 (用户偏好):
 *   - 主入口: 内网首页 / CEO 直通车 / A-Z 资源 / 内部论坛
 *   - 类目: 公告 / 政策 / 大事记 / 福利
 *   - 辅助: 高管动态 / 廉洁举报
 *
 * 保留所有路由不变, 只重构导航位置.
 */

import { IntranetSubnav } from '@/components/intranet/intranet-subnav';

export default function IntranetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <IntranetSubnav />
      <div className="flex-1 overflow-auto bg-surface-2/40">{children}</div>
    </div>
  );
}
