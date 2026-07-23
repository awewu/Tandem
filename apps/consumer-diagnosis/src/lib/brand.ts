/**
 * 瑞诺瓦品牌事实源（ADAPTED FROM public-portal/lib/brand.ts → 中性第三方策略）
 * ────────────────────────────────────────────────────────────────
 * 页面/组件只从此处取品牌命名/NAP/关系/外链，禁止散落硬编码。
 * 改这些值须先改 brand-registry.json（唯一源），再同步至此。
 * VI 颜色/字体走 globals.css 的 --rv-* token（亦源自 registry）。
 *
 * 已决（2026-07-02/03）：
 *  - 瑞诺瓦 = Rysnova（自主品牌，对外中性第三方策略 · 阳谋）
 *  - 对外呈现为中立行业工具/AI 问诊，不主打集团归属
 *  - 英文名固化为 Rysnova
 *  - 热线 400-886-9119；总部上海市浦东新区
 * 待补（__TODO__）：ICP 备案号、法律运营主体全称。
 */

export const BRAND = {
  nameCn: '瑞诺瓦',
  nameEn: 'Rysnova',
  taglineCn: 'AI 舒适家问诊',
  taglineEn: 'AI-Powered Home Comfort',
  domain: 'rysnova.com.cn',
  brandMark: 'RYSNOVA',
} as const;

export const CONTACT = {
  hotline: '400-886-9119',
  hotlineTel: '4008869119',
  emails: {
    service: 'service@rysnova.com.cn',
    business: 'business@rhautt.com',
    media: 'media@rhautt.com',
  },
  address: '上海市浦东新区',
  hours: '周一至周六 9:00-18:00',
} as const;

export const LEGAL = {
  copyrightHolder: '瑞诺瓦',
  poweredBy: 'Powered by Rysnova',
  // 待法务提供 —— 渲染时若为 null 则显示占位而非杜撰
  entityCn: null as string | null, // 运营主体工商全称
  icp: null as string | null,      // 真实 ICP 备案号
} as const;

/** 环境变量驱动的外链（生产注入 NEXT_PUBLIC_*；无 localhost 断链） */
export const LINKS = {
  groupPortal: process.env.NEXT_PUBLIC_GROUP_URL ?? 'https://rhautt.com',
  everhot:     process.env.NEXT_PUBLIC_EVERHOT_URL ?? 'https://everhot.com.cn',
  rheem:       process.env.NEXT_PUBLIC_RHEEM_URL ?? 'https://www.rheem.com.cn',
  ruud:        process.env.NEXT_PUBLIC_RUUD_URL ?? 'https://www.ruud.com.cn',
  dealer:      process.env.NEXT_PUBLIC_DEALER_URL ?? 'https://dealer.rhautt.com',
} as const;

/** 系统族产品/解决方案 */
export const SYSTEM_FAMILIES = [
  { icon: '🚿', name: '中央热水', metric: '≤ 5s 出热水',   desc: '中央热水主机 · 即热/储热 · 商住两用' },
  { icon: '🔥', name: '采暖制冷', metric: 'COP ≥ 4.2',     desc: '空气源/地源热泵 · 地暖盘管 · 分集水器' },
  { icon: '🌬️', name: '空气品质', metric: 'CO₂ ≤ 800ppm',  desc: '全热交换新风 · PM2.5 过滤 · 湿度控制' },
  { icon: '💧', name: '水处理',   metric: 'TDS ≤ 50ppm',   desc: '前置过滤 · 软水 · 直饮净水一体' },
  { icon: '📡', name: '智控系统', metric: '响应 <100ms',   desc: 'BACnet / Modbus · 边缘计算 · 离线自持' },
];

/** 支持中心入口 */
export const SUPPORT = [
  { icon: '📄', name: '产品规格 Specs', desc: '规格书 · 技术参数 · 选型手册' },
  { icon: '📚', name: '文档 Docs',      desc: '安装手册 · BIM 族库 · CAD 图纸' },
  { icon: '🛡️', name: '质保 Warranty',  desc: '质保政策 · 保修范围 · 期限查询' },
  { icon: '📝', name: '产品注册 Register', desc: '安装登记 · 激活质保 · 售后建档' },
];

export const currentYear = () => new Date().getFullYear();
