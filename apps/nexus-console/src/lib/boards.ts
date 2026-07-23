// Single source of structure for the Rhautt Nexus control plane.
// Mirrors platform-modules.json (board1 brand-management / board2 dealer-enablement).
// This is the NON-VISUAL control plane: it manages content/material/release/deploy
// metadata only. It never hosts or swallows the independent brand-site UIs.

export type BadgeVariant = 'default' | 'ok' | 'warn' | 'red' | 'info';

export type Cell = string | { badge: string; variant?: BadgeVariant };

export type Block =
  | {
      type: 'cards';
      items: { title: string; icon?: string; kpi?: string; desc?: string; badge?: { text: string; variant?: BadgeVariant } }[];
    }
  | { type: 'table'; head: string[]; rows: Cell[][]; empty?: string }
  | { type: 'note'; text: string }
  | { type: 'live'; probe: 'health' };

export interface Panel {
  key: string; // section slug
  nav: string;
  icon: string;
  crumb: string;
  h1: string;
  sub: string;
  blocks: Block[];
}

export interface Board {
  id: string; // route segment
  dot: BadgeVariant;
  name: string;
  panels: Panel[];
}

export const BOARDS: Board[] = [
  {
    id: 'comfort',
    dot: 'red',
    name: '板块一 · Rhautt Comfort（品牌与市场）',
    panels: [
      {
        key: 'overview',
        nav: '板块总览',
        icon: 'LayoutGrid',
        crumb: '板块一 · Rhautt Comfort',
        h1: '品牌与市场 · 板块总览',
        sub: '管理集团及旗下品牌官网内容 + 市场物料，不托管各站 UI（各站独立）。',
        blocks: [
          {
            type: 'cards',
            items: [
              { title: '在管站点', icon: 'Globe', kpi: '4', desc: '2 自建 · 2 外链占位' },
              { title: '物料资产', icon: 'FolderOpen', kpi: '0', desc: '海报/画册/图片/视频（占位）' },
              { title: '产品条目', icon: 'Package', kpi: '0', desc: '各品牌独立产品库' },
              { title: '待发布', icon: 'Rocket', kpi: '0', desc: '上新 / ICP 备案' },
            ],
          },
          { type: 'note', text: '铁律：中枢只管「内容 / 物料 / 发布 / 外链配置」，各品牌官网 UI/VI 完全独立。' },
        ],
      },
      {
        key: 'sites',
        nav: '网站管理',
        icon: 'Globe',
        crumb: '板块一 / 网站管理',
        h1: '网站管理',
        sub: '集团 + 旗下品牌站点入口与交付方式。',
        blocks: [
          {
            type: 'table',
            head: ['站点', '域名', '交付', 'VI / 内容架构', '状态'],
            rows: [
              ['集团官网 public-portal', 'rhautt.com', { badge: '自建', variant: 'red' }, 'aosmith 架构 × ruud 调性', { badge: '待建', variant: 'warn' }],
              ['Everhot everhot-cn', 'everhot.com.cn', { badge: '自建', variant: 'red' }, 'rheem 三受众架构 · 暖红', { badge: '已建·待精修', variant: 'ok' }],
              ['Rheem rheem-cn', 'rheem.com.cn', { badge: '外链' }, '外部站', { badge: '占位' }],
              ['Ruud ruud-cn', 'ruud.com.cn', { badge: '外链' }, '外部站', { badge: '占位' }],
            ],
          },
        ],
      },
      {
        key: 'dam',
        nav: '市场物料库 DAM',
        icon: 'FolderOpen',
        crumb: '板块一 / 市场物料库',
        h1: '市场物料库（DAM）',
        sub: '统一上传 / 分类 / 版本 / 审批 / 投放；存储走对象存储（file-artifact）。',
        blocks: [
          { type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。' },
          {
            type: 'cards',
            items: [
              { title: '上传素材', icon: 'Upload', desc: '海报 · 画册 · 产品图 · 视频' },
              { title: '分类标签', icon: 'Tag', desc: '按品牌 / 渠道 / 活动' },
              { title: '审批流', icon: 'CheckCircle2', desc: '提交 → 审核 → 发布' },
            ],
          },
          { type: 'table', head: ['文件', '类型', '品牌', '版本', '状态'], rows: [], empty: '暂无物料（接入 file-artifact 后在此列出资产）' },
        ],
      },
      {
        key: 'catalog',
        nav: '品牌产品库',
        icon: 'Package',
        crumb: '板块一 / 品牌产品库',
        h1: '品牌产品库',
        sub: '各品牌独立产品库（③ 品牌运营库）。',
        blocks: [
          { type: 'table', head: ['品牌', '产品数', '最近更新'], rows: [], empty: '暂无产品数据（确认 product-catalog 已导入）' },
        ],
      },
      {
        key: 'publish',
        nav: '上新 / 发布',
        icon: 'Rocket',
        crumb: '板块一 / 上新发布',
        h1: '上新 / 发布',
        sub: '上新、ICP 备案、站点发布。',
        blocks: [
          { type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。占位：发布队列与 ICP 备案配置将在此。' },
        ],
      },
    ],
  },
  {
    id: 'enablement',
    dot: 'info',
    name: '板块二 · 瑞诺瓦赋能平台（部署管理）',
    panels: [
      {
        key: 'overview',
        nav: '板块总览',
        icon: 'LayoutGrid',
        crumb: '板块二 · 瑞诺瓦赋能平台',
        h1: '赋能平台 · 部署管理总览',
        sub: '管理三件套软件的交付部署；编排部署但不吞并运行时。',
        blocks: [
          { type: 'live', probe: 'health' },
          {
            type: 'cards',
            items: [
              { title: '租户', icon: 'Building2', kpi: '0', desc: '经销商 / 门店（PG-RLS）' },
              { title: '当前版本', icon: 'Tag', kpi: '—', desc: '问诊 / CRM / BIM 三件套' },
              { title: '环境', icon: 'Server', kpi: '3', desc: 'dev · staging · prod' },
              { title: '健康', icon: 'HeartPulse', kpi: '—', desc: 'SLO / 故障' },
            ],
          },
          { type: 'note', text: '铁律：每件套保留独立 namespace + 独立部署路径；中枢负责编排、发布、回滚、监控。' },
        ],
      },
      {
        key: 'tenants',
        nav: '租户开通',
        icon: 'Building2',
        crumb: '板块二 / 租户开通',
        h1: '租户开通',
        sub: '开通经销商 / 门店 / 角色（PostgreSQL 行级隔离 RLS）。',
        blocks: [
          { type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。' },
          { type: 'table', head: ['租户', '类型', '启用件套', '席位', '状态'], rows: [], empty: '暂无租户（骨架占位）' },
        ],
      },
      {
        key: 'releases',
        nav: '版本 / 发布',
        icon: 'Tag',
        crumb: '板块二 / 版本发布',
        h1: '版本 / 发布',
        sub: '按件套 namespace 独立发布，dev → staging → prod。',
        blocks: [
          { type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。' },
          {
            type: 'table',
            head: ['件套', 'namespace', 'dev', 'staging', 'prod'],
            rows: [
              ['瑞诺瓦 AI 问诊', 'rysnova', { badge: 'v—', variant: 'ok' }, { badge: '—' }, { badge: '—' }],
              ['舒适家居 CRM', 'crm', { badge: 'v—', variant: 'ok' }, { badge: '—' }, { badge: '—' }],
              ['技术支持 BIM', 'rysnova-bim', { badge: 'v—', variant: 'ok' }, { badge: '—' }, { badge: '—' }],
            ],
          },
        ],
      },
      {
        key: 'envs',
        nav: '环境 / 部署状态',
        icon: 'Server',
        crumb: '板块二 / 环境部署',
        h1: '环境 / 部署状态',
        sub: '环境总览、部署状态、回滚。',
        blocks: [
          { type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。' },
          {
            type: 'cards',
            items: [
              { title: 'dev', icon: 'Server', desc: '本地 / 开发', badge: { text: '运行中', variant: 'ok' } },
              { title: 'staging', icon: 'Server', desc: '预发', badge: { text: '未部署' } },
              { title: 'prod', icon: 'Server', desc: '生产', badge: { text: '未部署' } },
            ],
          },
          { type: 'note', text: '占位：对接 docker-compose / 部署编排 + 回滚演练。' },
        ],
      },
      {
        key: 'health',
        nav: '健康 / 监控',
        icon: 'HeartPulse',
        crumb: '板块二 / 健康监控',
        h1: '健康 / 监控',
        sub: '可观测性 + 治理产物（SBOM / guard / hammer）。',
        blocks: [
          { type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。' },
          { type: 'live', probe: 'health' },
          {
            type: 'cards',
            items: [
              { title: '服务健康', icon: 'HeartPulse', kpi: '—', desc: 'api · calc-engine' },
              { title: 'Guard 通过率', icon: 'ShieldCheck', kpi: '—', desc: '50+ 守卫 · hammer L1–L9' },
              { title: 'SBOM/溯源', icon: 'Package', kpi: '—', desc: '供应链证据' },
            ],
          },
        ],
      },
    ],
  },
];

// Board 3: Growth Engine (推广与增长)
BOARDS.push({
  id: 'growth',
  dot: 'ok',
  name: '板块三 · 推广与增长引擎',
  panels: [
    {
      key: 'overview',
      nav: '板块总览',
      icon: 'LayoutGrid',
      crumb: '板块三 · 推广与增长',
      h1: '增长引擎 · 板块总览',
      sub: '四引擎驱动品牌曝光与获客：GEO · 文案 · 舆情 · 营销自动化。',
      blocks: [
        {
          type: 'cards',
          items: [
            { title: 'GEO 分析', icon: 'Search', kpi: '8', desc: '探测 8 个 AI 引擎品牌可见度' },
            { title: '文案 Copilot', icon: 'PenTool', kpi: '—', desc: '多平台矩阵文案生成（待建）' },
            { title: '舆情雷达', icon: 'Radio', kpi: '—', desc: '公开源采集+AI 情感分级（待建）' },
            { title: '营销自动化', icon: 'Zap', kpi: '—', desc: 'UTM 归因+ROI 看板（待建）' },
          ],
        },
        { type: 'note', text: '当前优先推进：GEO 分析引擎（AI 搜索可见度探测）。' },
      ],
    },
    {
      key: 'geo',
      nav: 'GEO 可见度分析',
      icon: 'Search',
      crumb: '板块三 / GEO 可见度分析',
      h1: 'GEO 可见度分析',
      sub: '探测品牌/产品在各 AI 搜索引擎中的推荐可见度，发现内容缺口。',
      blocks: [{ type: 'note', text: '交互式工具加载中…' }],
    },
    {
      key: 'copywriter',
      nav: '文案 Copilot',
      icon: 'PenTool',
      crumb: '板块三 / 文案 Copilot',
      h1: '文案 Copilot',
      sub: '多平台矩阵文案生成·品牌护栏·核准流。',
      blocks: [{ type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。待建：文案生成引擎将在此实现。' }],
    },
    {
      key: 'sentiment',
      nav: '舆情雷达',
      icon: 'Radio',
      crumb: '板块三 / 舆情雷达',
      h1: '舆情雷达',
      sub: '公开源采集·AI 情感分级·危机预警。',
      blocks: [{ type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。待建：舆情监测引擎将在此实现。' }],
    },
    {
      key: 'automation',
      nav: '营销自动化',
      icon: 'Zap',
      crumb: '板块三 / 营销自动化',
      h1: '营销自动化',
      sub: 'UTM 归因·ROI 看板·线索评分。',
      blocks: [{ type: 'note', text: '🚧 该模块正在建设中，数据与交互功能将陆续上线。待建：营销自动化引擎将在此实现。' }],
    },
  ],
});

export function getBoard(id: string): Board | undefined {
  return BOARDS.find((b) => b.id === id);
}

export function getPanel(boardId: string, sectionKey: string): Panel | undefined {
  return getBoard(boardId)?.panels.find((p) => p.key === sectionKey);
}
