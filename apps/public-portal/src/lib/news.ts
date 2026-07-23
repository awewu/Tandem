/* ── 新闻数据源（首批稿件，正式发布前由品牌部审校）── */

export type NewsArticle = {
  slug: string;
  title: string;
  category: '公司新闻' | '产品发布' | '行业洞察' | '品牌活动';
  date: string;
  excerpt: string;
  body: string[];
};

export const NEWS: NewsArticle[] = [
  {
    slug: 'rhautt-rheem-exclusive-authorization',
    title: '瑞合瑞德获瑞美集团（Rheem）中国独家授权，Rheem · Ruud · EverHot 三品牌落地中国',
    category: '公司新闻',
    date: '2026-05-18',
    excerpt: '瑞合瑞德正式获得瑞美集团（Rheem Manufacturing）中国区独家授权，全面运营 Rheem、Ruud、EverHot 三大品牌，覆盖热水、采暖、空气品质与水处理全线产品。',
    body: [
      '瑞合瑞德（Rhautt）今日宣布，正式获得瑞美集团（Rheem Manufacturing Company）中国区独家授权，全面负责 Rheem、Ruud、EverHot 三大品牌在中国市场的产品运营、渠道建设与售后服务体系。',
      '瑞美集团创立于 1925 年，是全球领先的热水与空气舒适系统制造商，业务遍及全球 80 余个国家。此次授权合作，标志着瑞美集团深耕中国市场的战略升级。',
      '瑞合瑞德将以上海为总部，构建覆盖全国的经销与服务网络，并结合本土化的 Econet 智控平台与 Rysnova AI 选型系统，为中国家庭与商用客户提供全场景舒适系统解决方案。',
    ],
  },
  {
    slug: 'econet-smart-platform-launch',
    title: 'Econet 智控平台发布：热水、采暖、新风、净水一屏统管',
    category: '产品发布',
    date: '2026-04-22',
    excerpt: 'Rhautt 发布 Econet 智控平台与 EC-HUB 智控中枢，实现全系统设备统一接入、本地化场景引擎与全屋能耗看板。',
    body: [
      'Rhautt 正式发布 Econet 智控平台及配套硬件 EC-HUB 智控中枢、EC-TC 智能温控器，实现热水、采暖、新风、净水设备的统一接入与联动控制。',
      'EC-HUB 支持 Wi-Fi、Zigbee、RS485 多协议接入，最多可管理 64 台设备，本地场景引擎在断网状态下仍可正常运行，响应延迟低于 100 毫秒。',
      '平台内置全屋能耗统计看板，配合热泵类产品的高能效表现，帮助用户直观掌握并持续优化家庭能源支出——这也是 Rhautt「Earth Day, Every Day.」可持续承诺的落地实践。',
    ],
  },
  {
    slug: 'heat-pump-market-insight-2026',
    title: '行业洞察：双碳目标下，热泵为何成为建筑采暖的确定性选择',
    category: '行业洞察',
    date: '2026-03-10',
    excerpt: '在建筑电气化与双碳政策推动下，空气源热泵市场持续高增长。本文从能效、政策与全生命周期成本三个维度解析热泵的确定性趋势。',
    body: [
      '在「双碳」目标与建筑电气化浪潮推动下，空气源热泵正从「可选项」变为建筑采暖的「确定性选择」。',
      '能效维度：以 COP 4.0 以上的变频热泵为例，相同热量输出下，电耗仅为传统电采暖的四分之一；对比燃气壁挂炉，全生命周期碳排放可降低 40% 以上。',
      '政策维度：多地已将热泵纳入绿色建筑与节能改造补贴目录，北方清洁取暖改造与长江流域供暖需求共同构成双增长引擎。',
      '成本维度：尽管初始投资高于传统方案，但以 10 年使用周期计算，热泵系统的总拥有成本（TCO）通常在 4-6 年内实现反超。',
      '瑞合瑞德依托瑞美集团百年热能技术积累，热泵产品线覆盖 8kW 至 20kW 全场景，并通过 Econet 平台实现能耗透明化管理。',
    ],
  },
  {
    slug: 'shanghai-flagship-experience-center',
    title: '瑞合瑞德上海旗舰体验中心启幕：全场景舒适系统实景体验',
    category: '品牌活动',
    date: '2026-02-28',
    excerpt: '位于上海浦东的 Rhautt 旗舰体验中心正式开放，1:1 实景还原热水、采暖、新风、净水全系统运行场景。',
    body: [
      '瑞合瑞德上海旗舰体验中心于浦东新区正式启幕。体验中心以「看得见的舒适」为设计理念，1:1 实景还原家庭全系统运行场景。',
      '访客可现场体验热泵采暖的静音运行、中央热水的即开即热、全热交换新风的空气品质变化，并通过 Econet 大屏实时查看各系统的能耗数据。',
      '体验中心同时设有专业选型区，Rysnova AI 选型系统可根据户型面积、使用习惯与预算，即时生成个性化系统方案与节能预估。',
    ],
  },
  {
    slug: 'sustainability-commitment-2026',
    title: 'Rhautt 发布可持续发展承诺：Earth Day, Every Day.',
    category: '公司新闻',
    date: '2026-01-15',
    excerpt: '瑞合瑞德发布可持续发展承诺与首份 ESG 行动框架，将节能产品占比、碳减排贡献与绿色建筑项目纳入年度目标。',
    body: [
      '瑞合瑞德正式发布可持续发展承诺「Earth Day, Every Day.」，并公布首份 ESG 行动框架。',
      '框架围绕三大方向：产品端持续提升高能效产品（COP≥4.0 热泵、一级能效热水）销售占比；工程端优先推动绿色建筑与既有建筑节能改造项目；运营端建立供应链碳足迹追踪机制。',
      '公司同步承诺，每年发布可持续发展报告，公开节能产品交付量、预估碳减排贡献与绿色项目数量等关键指标，接受市场与公众监督。',
    ],
  },
];

export function getArticle(slug: string): NewsArticle | undefined {
  return NEWS.find(n => n.slug === slug);
}
