/**
 * 集团品牌事实源（SYNCED FROM /brand-registry.json · 品牌管理中心）
 * ────────────────────────────────────────────────────────────────
 * 页面/组件只从此处取品牌命名/NAP/关系/外链，禁止散落硬编码。
 * 改这些值须先改 brand-registry.json（唯一源），再同步至此。
 * VI 颜色/字体走 globals.css 的 --brand-* / --rh-* token（亦源自 registry）。
 *
 * 已决（2026-07-02）：
 *  - 集团 = 瑞合瑞德暖通科技集团 / 简称瑞合瑞德 / Rhautt Comfort Group（废「瑞豪特」）
 *  - Rheem/Ruud/EverHot = 瑞美集团独家授权、瑞合瑞德中国独家运营
 *  - 瑞诺瓦 = Rysnova（自主品牌，对外中性第三方策略）
 *  - 热线 400-886-9119；总部 上海市浦东新区（同恒热中国）
 * 待补（__TODO__）：ICP 备案号、法律运营主体全称。
 */

export const GROUP = {
  nameCn: '瑞合瑞德暖通科技集团',
  nameShort: '瑞合瑞德',
  nameEn: 'Rhautt Comfort Group',
  brandMark: 'RHAUTT',
  taglineEn: 'Reliable · Sustainable · Intelligent',
  taglineCn: '可靠 · 可持续 · 智能',
  foundedYear: 2018,
  domain: 'rhautt.com',
} as const;

export const CONTACT = {
  hotline: '400-886-9119',
  hotlineTel: '4008869119',
  emails: {
    service: 'service@rhautt.com',
    business: 'business@rhautt.com',
    media: 'media@rhautt.com',
  },
  address: '上海市浦东新区',
  hours: '周一至周六 9:00-18:00',
} as const;

export const LEGAL = {
  copyrightHolder: '瑞合瑞德暖通科技集团',
  // 待法务提供 —— 渲染时若为 null 则显示占位而非杜撰
  entityCn: null as string | null, // 运营主体工商全称
  icp: null as string | null,      // 真实 ICP 备案号
} as const;

/** 环境变量驱动的外链（生产注入 NEXT_PUBLIC_*；无 localhost 断链） */
export const LINKS = {
  everhot:   process.env.NEXT_PUBLIC_EVERHOT_URL   ?? 'https://everhot.com.cn',
  rheem:     process.env.NEXT_PUBLIC_RHEEM_URL     ?? 'https://www.rheem.com.cn',
  ruud:      process.env.NEXT_PUBLIC_RUUD_URL      ?? 'https://www.ruud.com.cn',
  diagnosis: process.env.NEXT_PUBLIC_DIAGNOSIS_URL ?? 'https://rhautt.com',
  dealer:    process.env.NEXT_PUBLIC_DEALER_URL    ?? 'https://dealer.rhautt.com',
  console:   process.env.NEXT_PUBLIC_CONSOLE_URL   ?? 'https://console.rhautt.com',
  design:    process.env.NEXT_PUBLIC_DESIGN_URL    ?? 'https://design.rhautt.com',
  portal:    process.env.NEXT_PUBLIC_PORTAL_URL    ?? 'https://portal.rhautt.com',
  investor:  process.env.NEXT_PUBLIC_INVESTOR_URL  ?? 'https://ir.rhautt.com',
} as const;

export type BrandRelation = '授权运营' | '集团自建' | '自主品牌';

/** 品牌矩阵：口径源自 registry.brandRelationship（2026-07-02 裁定） */
export const BRAND_MATRIX: {
  name: string; sub: string; relation: BrandRelation; href: string; external: boolean;
}[] = [
  { name: 'Rheem',    sub: 'Water 水系统 · 中国独家授权运营',   relation: '授权运营', href: LINKS.rheem,     external: true },
  { name: 'Ruud',     sub: 'Air 空气系统 · 中国独家授权运营',   relation: '授权运营', href: LINKS.ruud,      external: true },
  { name: 'EverHot',  sub: 'Water 高端中央热水 · 集团中国运营', relation: '集团自建', href: LINKS.everhot,   external: true },
  { name: 'Rysnova',  sub: 'AIoT 全屋舒适问诊 · 自主平台品牌',  relation: '自主品牌', href: LINKS.diagnosis, external: true },
  { name: 'Lithnova', sub: '储能 新能源储能 · 自主设备品牌',    relation: '自主品牌', href: '/brands',       external: false },
];

/** 专业人员通道（B 端工作台） */
export const PRO_PORTALS = [
  { label: '经销商工作台', desc: 'CRM · 报价 · BIM 交付', href: LINKS.dealer,  code: 'D1' },
  { label: '经营控制台',   desc: '经营分析 · 财务 · 团队', href: LINKS.console, code: 'C2' },
  { label: '设计师工作台', desc: '方案设计 · BIM 出图',    href: LINKS.design,  code: 'D3' },
  { label: '客户查进度',   desc: '项目状态 · 验收记录',    href: LINKS.portal,  code: 'P4' },
];

/** 系统族产品/解决方案（企业站信息架构） */
export const SYSTEM_FAMILIES = [
  { code: '01', name: '中央热水', metric: '≤ 5s 出热水',   desc: '中央热水主机 · 即热/储热 · 商住两用' },
  { code: '02', name: '采暖制冷', metric: 'COP ≥ 4.2',     desc: '空气源/地源热泵 · 地暖盘管 · 分集水器' },
  { code: '03', name: '空气品质', metric: 'CO₂ ≤ 800ppm',  desc: '全热交换新风 · PM2.5 过滤 · 湿度控制' },
  { code: '04', name: '水处理',   metric: 'TDS ≤ 50ppm',   desc: '前置过滤 · 软水 · 直饮净水一体' },
  { code: '05', name: '智控系统', metric: '响应 <100ms',   desc: 'BACnet / Modbus · 边缘计算 · 离线自持' },
];

/** 支持中心入口（企业站标配） */
export const SUPPORT = [
  { code: 'SP', name: '产品规格 Specs', desc: '规格书 · 技术参数 · 选型手册' },
  { code: 'DC', name: '文档 Docs',      desc: '安装手册 · BIM 族库 · CAD 图纸' },
  { code: 'WR', name: '质保 Warranty',  desc: '质保政策 · 保修范围 · 期限查询' },
  { code: 'RG', name: '产品注册 Register', desc: '安装登记 · 激活质保 · 售后建档' },
];

/* ══════════════════════════════════════════════════════════════
 * 企业内核 · 源自《瑞合瑞德集团 2026 战略会议 Day2》P13 / P15 / P16-17
 * 使命 / 愿景 / 价值观（四个满意）/ 六项基本原则 / 七大价值观奖 / 战略
 * 对标 A.O. Smith「Our Values」信息架构：愿景置顶 → 价值观等权 → 原则 + 廉正
 * ══════════════════════════════════════════════════════════════ */

/** 公司使命 Mission（战略屋原文） */
export const MISSION = {
  cn: '以创新「高效低碳技术 + 数智化服务」为核，为家庭与商业空间提供「健康、舒适、全生命周期友好」的解决方案，让人居环境更美好。',
  en: 'Anchored in efficient low-carbon technology and digital-intelligent service, we deliver healthy, comfortable and whole-lifecycle-friendly solutions for homes and commercial spaces — making living environments better.',
} as const;

/** 公司愿景 Vision（战略屋原文） */
export const VISION = {
  cn: '成为受人尊重的水和空气产品及解决方案可持续发展的引领者。',
  en: 'To become a respected leader in the sustainable development of water and air products and solutions.',
} as const;

/** 核心价值观 · 四个满意 Four Satisfaction（不分先后） */
export const VALUES: { key: string; cn: string; en: string; desc: string }[] = [
  { key: 'customer',    cn: '客户满意', en: 'Customer Satisfaction',    desc: '为客户提供高品质的产品与解决方案是我们的首要任务；以更可持续、更高效的方案满足需求，赋予客户市场竞争优势。' },
  { key: 'employee',    cn: '员工满意', en: 'Employee Satisfaction',    desc: '拥有共同价值观的核心团队是发展的重要驱动力；以充分授权激发团队的自我驱动、本地化创新与责任担当。' },
  { key: 'shareholder', cn: '股东满意', en: 'Shareholder Satisfaction', desc: '通过清晰授权、数字化流程与严格的财务风控，实现高质量、可持续的共赢增长与稳健回报。' },
  { key: 'society',     cn: '社会满意', en: 'Society Satisfaction',     desc: '以高效低碳技术推动脱碳与节能，践行优秀企业公民责任，让人居环境更美好。' },
];

/** 六项基本原则 Guiding Principles */
export const PRINCIPLES: { cn: string; en: string }[] = [
  { cn: '以身作则',              en: 'Lead by Example' },
  { cn: '以信任激发担当',        en: 'Building Trust to Empower' },
  { cn: '倾听理解，以尊重促协作', en: 'Listening to Understand, Respecting to Collaborate' },
  { cn: '交付受人尊重的贡献',    en: 'Contributing Respectfully' },
  { cn: '创造性地思考',          en: 'Thinking Creatively' },
  { cn: '落实负责任的行动',      en: 'Acting with Responsibility' },
];

/** 七大价值观奖 Seven Value Awards（文化落地机制） */
export const AWARDS: { cn: string; en: string }[] = [
  { cn: '百折不挠奖',             en: 'Fail Forward Fast Award' },
  { cn: '客户满意奖',             en: 'Customer Satisfaction Award' },
  { cn: 'Edwin Ruud 年度创新先锋奖', en: 'Edwin Ruud Innovator Award' },
  { cn: '公益活动参与奖',         en: 'Public Service Participation Award' },
  { cn: '颠覆创新奖',             en: 'Disruption Award' },
  { cn: '工作场所安全奖',         en: 'Workplace Safety Award' },
  { cn: '环保贡献奖',             en: 'Environment Protection Award' },
];

/** 战略方向 Strategy（对外公开定性表述） */
export const STRATEGY = {
  priorities: [
    { cn: '渠道建设', en: 'Channel Building' },
    { cn: '产品创新', en: 'Product Innovation' },
    { cn: '生态共建', en: 'Ecosystem Co-creation' },
  ],
  pillars: [
    { cn: '协同增长', en: 'Grow Together',        desc: '深化 Rheem 水系统与 Ruud 空气系统的渠道与服务协同，服务更广泛的用户。' },
    { cn: '创新引领', en: 'Innovate to Lead',     desc: '持续投入高效低碳与智能化产品创新，携手瑞美集团共享全球技术。' },
    { cn: '诚信交付', en: 'Deliver on Commitments', desc: '以可靠的供应与数字化服务，持续提升产品质量、效率与交付体验。' },
  ],
} as const;

/* ── 发展历程 History（PPT P4 + P16）───────────────────────── */
export const HISTORY = {
  narrative: [
    '瑞合瑞德集团（Rhautt Comfort Group）承袭全球供暖与热水领域百年领导者——美国瑞美（Rheem）集团于 1994 年进入中国市场的专业基因与制造底蕴，立足三十载积淀，开启行业新征程。',
    '如今，集团已构建起覆盖采暖、热水、空调、净水四大核心赛道的研产销一体化平台，并在中国市场独家运营 Rheem（瑞美）、Everhot（恒热）、RUUD（路德）三大国际高端品牌，形成多品牌、多场景、差异化的产品矩阵。',
    '依托品牌资产、客户基础与前瞻战略，集团业务在东南亚、中东和澳洲等地区快速增长，持续整合全球技术与本土化能力，把握数字化与低碳转型的发展机遇，迈向更高质量、更可持续的新阶段。',
  ],
  heritage: [
    { value: '1994', label: '中国建厂', sub: 'Rheem 中国独资公司' },
    { value: '30+', label: '载积淀', sub: '本土研产销一体' },
    { value: '100', label: '年品牌基因', sub: 'Rheem 百年传承' },
    { value: '4', label: '大核心赛道', sub: '采暖 · 热水 · 空调 · 净水' },
  ],
} as const;

/** 发展路线图 Roadmap（对外公开 · 定性里程碑） */
export const ROADMAP: { period: string; phase: string; items: string[] }[] = [
  { period: '2019–2021', phase: '扩展布局', items: ['完善暖通产品品类布局', '建立本土研发团队', '建立家用热泵制造能力', '完善品牌营销体系'] },
  { period: '2022–2024', phase: '稳健深耕', items: ['深化线下核心客户服务', '拓展商用冷凝与家用采暖产品线', '提升本土制造与品质能力', '探索智能控制技术'] },
  { period: '2025–2027', phase: '创新突破', items: ['拓展空调产品品类', '推进多品牌协同运营', '升级智能化产品与制造能力', '品牌营销体系升级'] },
  { period: '2028–2030', phase: '智能可持续', items: ['推进产品智能化升级', '深化数字化运营', '拓展低碳与新能源布局'] },
];

/* ── 核心管理团队 Leadership（PPT P12）─────────────────────── */
/** 已确认对外披露的核心管理者（含真实履历） */
export const LEADERS: { name: string; en: string; role: string; bio: string; creds: string[] }[] = [
  {
    name: '李永胜', en: 'Steve Li', role: '首席执行官 CEO',
    bio: '拥有暖通行业深厚的专业知识与实践经验，以及卓越的业务拓展与团队管理能力；曾为行业标准制定与暖通行业规范化发展做出积极贡献，是中国暖通行业极具影响力的领军人物。',
    creds: ['中欧国际工商学院 EMBA', '曾任 A.O. 史密斯暖通空调事业部总经理', '曾任两大美资热水器公司中国区业务高管'],
  },
  {
    name: '丁威', en: 'Wei Ding', role: '董事长 Chairman',
    bio: '拥有二十多年中国市场「零—百亿」品牌创立与经营管理经验，成功打造家电行业领军品牌，为中国家电行业发展做出突出贡献。',
    creds: ['曾任 A.O. 史密斯集团高级副总裁兼中国公司总裁', '曾任恒洁集团首席执行官', '2025 福布斯中国·江苏工商管理影响力人物'],
  },
];

/** 其他管理成员（占位：姓名/职务已定，简介待核实发布） */
export const LEADERS_MORE: { name: string; en: string; role: string }[] = [
  { name: '余丽琴', en: 'Rosie Yu',      role: '市场营销副总裁' },
  { name: '刘小婷', en: 'Doris Liu',     role: '首席财务官' },
  { name: '吴学亮', en: 'Xueliang Wu',   role: '制造及研发总经理' },
  { name: '张莉',   en: 'Molly Zhang',   role: '人力资源总监' },
  { name: '王华',   en: 'Hua Wang',      role: '研发负责人' },
];

/* ── 制造与实验室能力 Capability（PPT P8–P10）──────────────── */
/** 生产制造能力（对外公开 · 定性能力，不含产能数字） */
export const MANUFACTURING: string[] = [
  '内胆自主生产线',
  '存储式（燃气 / 电热）热水器制造',
  '存储式热泵装配线',
  '燃气壁挂炉生产线',
  '热泵系统自主生产',
  '电气零部件进厂全检',
];

/** 实验室能力（P10）+ 耐久基准（P8） */
export const LABS: { title: string; desc: string }[] = [
  { title: '两大国家备案能效实验室', desc: 'CNAS 认可 — 燃气快速热水器 / 燃气采暖炉，及储水式电热水器能效测试。' },
  { title: '热泵与电控综合实验室', desc: '热泵性能、电控 EMC、高低温、噪音与喷淋实验室，满足对应国标要求。' },
  { title: 'Rheem 全球标准检测实验室', desc: '符合瑞美集团要求的零部件、电控高温与成品检测实验室。' },
  { title: '燃气热水器耐久性实验室', desc: '专注产品长期使用可靠性与耐久性评估，满足行业标准及客户定制化测试。' },
  { title: '供暖热水综合应用区', desc: '模拟多元化场景实际运行环境，为系统设计、选型与升级提供直观参考。' },
  { title: '可靠性测试实验室', desc: '全面评估性能稳定性、安全耐久性与功能完整性，为研发、质控与市场准入提供权威数据。' },
];

export const DURABILITY = [
  { value: '25 万次', label: '脉冲测试', sub: '澳洲标准' },
  { value: '12 年', label: '等效寿命', sub: '美国标准' },
] as const;

/* ── 可持续发展方向（对外公开 · 定性表述，不含财务/占比目标）── */
export const SUSTAINABILITY_GOALS: { title: string; desc: string }[] = [
  { title: '产品低碳化', desc: '以热泵与高效技术推动产品脱碳，降低建筑运行的能耗与碳排放。' },
  { title: '智能化升级', desc: '持续提升产品的智能化与联网运维能力，优化能效与使用体验。' },
  { title: '新能源布局', desc: '拓展新能源与储能协同，构建更绿色的家居能源生态闭环。' },
  { title: '数字化运营', desc: '推进研产销数字化，持续提升交付质量与运营效率。' },
];

/* ── 内部治理与生态协同 Governance（PPT P14）───────────────── */
export const GOVERNANCE = {
  platform: [
    '清晰的授权与权责体系',
    '标准化的业务流程与预算管控',
    '独立的审计与内部监督机制',
    '透明、诚信、合规的经营原则',
    '持续升级的数字化管理体系',
  ],
  tiers: [
    { tier: '治理层', body: '董事会', detail: '审计委员会 · 薪酬委员会 · 提名委员会' },
    { tier: '决策/执行层', body: 'CEO + 核心管理团队', detail: '业务战略与经营决策' },
    { tier: '经营层', body: '业务单元管理层与核心团队', detail: '深度经营 · 本地化创新 · 责任担当' },
  ],
  ecosystem: {
    employee: { title: '专业高效的组织', desc: '以清晰的目标与充分的授权，激发团队的专业能力、创造力与责任担当。' },
    channel: { title: '长期共赢的伙伴生态', desc: '与经销商、安装商及核心客户建立长期稳定的合作关系，协同开拓市场、共创价值。' },
  },
} as const;

export const currentYear = () => new Date().getFullYear();
