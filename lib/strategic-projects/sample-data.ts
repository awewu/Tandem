export type StrategicProjectRisk = 'normal' | 'attention' | 'overdue';
export type StrategicProjectStatus = '进行中' | '未开始' | '已完成';
export type StrategicTaskStatus = '进行中' | '未接受' | '已取消' | '已完成';

export interface StrategicTask {
  id: string;
  title: string;
  priority: 'P2' | 'P3';
  status: StrategicTaskStatus;
  owner: string;
  dueDate: string;
  progress: number;
  overdueText?: string;
}

export interface StrategicMilestone {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  progress: number;
  tone: 'blue' | 'yellow' | 'neutral';
  tasks: StrategicTask[];
}

export interface StrategicProject {
  id: string;
  name: string;
  status: StrategicProjectStatus;
  risk: StrategicProjectRisk;
  riskLabel: string;
  owner: string;
  completion: number;
  completionText: string;
  tasksText: string;
  overdueTasks: number;
  startDate: string;
  dueDate: string;
  objective: string;
  progressChip: string;
  milestones: StrategicMilestone[];
}

const defaultTasks = (projectId: string, owner: string): StrategicMilestone[] => [
  {
    id: `${projectId}-default`,
    title: '默认分组',
    owner,
    dueDate: '12/31',
    progress: 0,
    tone: 'blue',
    tasks: [
      {
        id: `${projectId}-default-1`,
        title: '战略项目启动与目标拆解',
        priority: 'P3',
        status: '进行中',
        owner,
        dueDate: '12/31',
        progress: 0,
      },
    ],
  },
];

const v3Milestones: StrategicMilestone[] = [
  {
    id: 'v3-default',
    title: '默认分组',
    owner: '张一舟',
    dueDate: '12/31',
    progress: 0,
    tone: 'blue',
    tasks: [
      { id: 'v3-t1', title: '重点项目支持', priority: 'P3', status: '进行中', owner: '张一舟', dueDate: '12/31', progress: 0, overdueText: '逾期205天' },
      { id: 'v3-t2', title: '交付标准体系建设', priority: 'P3', status: '已取消', owner: '张一舟', dueDate: '12/31', progress: 31 },
      { id: 'v3-t3', title: '产品端：产品引入、立项跟进、设计阶段模板体系化', priority: 'P3', status: '进行中', owner: '张一舟', dueDate: '12/31', progress: 0 },
      { id: 'v3-t4', title: '引入短期补充性空气侧产品', priority: 'P3', status: '进行中', owner: '张一舟', dueDate: '12/31', progress: 0, overdueText: '逾期24天' },
      { id: 'v3-t5', title: '梳理现有空气产品阵容', priority: 'P3', status: '进行中', owner: '张一舟', dueDate: '12/31', progress: 40 },
    ],
  },
  {
    id: 'v3-brand',
    title: '空调品牌传播与线上媒体矩阵运营',
    owner: '巴喜平',
    dueDate: '12/31',
    progress: 0,
    tone: 'yellow',
    tasks: [
      { id: 'v3-t6', title: 'RUUD官号、瑞德宜居账号及职人号内容规划及发布运营', priority: 'P3', status: '进行中', owner: '巴喜平', dueDate: '12/31', progress: 40 },
      { id: 'v3-t7', title: '上海发布会、成都经销商会推进及行业媒体对接', priority: 'P3', status: '进行中', owner: '巴喜平', dueDate: '12/31', progress: 0, overdueText: '逾期1天' },
      { id: 'v3-t8', title: '空调产品图集、系统图集及产品系统功能视频', priority: 'P3', status: '进行中', owner: '巴喜平', dueDate: '12/31', progress: 0, overdueText: '逾期1天' },
    ],
  },
  {
    id: 'v3-launch',
    title: '热泵主机、空气侧设备顺利上市',
    owner: '周杰',
    dueDate: '12/31',
    progress: 16,
    tone: 'blue',
    tasks: [
      { id: 'v3-t9', title: 'Q3主机上市和空气侧设备上市工作推动', priority: 'P3', status: '未接受', owner: '周杰', dueDate: '12/31', progress: 0 },
      { id: 'v3-t10', title: 'Q3新品市场端资料与政策规划输出', priority: 'P3', status: '进行中', owner: '周杰', dueDate: '12/31', progress: 30 },
      { id: 'v3-t11', title: '新品上市前期预热及落地交付案例集', priority: 'P3', status: '未接受', owner: '周杰', dueDate: '12/31', progress: 35 },
      { id: 'v3-t12', title: '空调事业部市场推广把控', priority: 'P3', status: '进行中', owner: '周杰', dueDate: '12/31', progress: 60 },
      { id: 'v3-t13', title: '开启整合营销尝试，并迭代验证语言', priority: 'P3', status: '已完成', owner: '周杰', dueDate: '12/31', progress: 100 },
    ],
  },
  {
    id: 'v3-channel',
    title: '华东、西南一城一商渠道开发',
    owner: '毕韬',
    dueDate: '12/31',
    progress: 0,
    tone: 'blue',
    tasks: [
      { id: 'v3-t14', title: '标杆客户1家，合计开发3家(华中区域：河南、湖北、湖南)', priority: 'P3', status: '进行中', owner: '毕韬', dueDate: '12/31', progress: 0 },
      { id: 'v3-t15', title: '华东区域新增空调签约客户12家', priority: 'P3', status: '进行中', owner: '毕韬', dueDate: '12/31', progress: 0 },
      { id: 'v3-t16', title: '重庆、陕西新增签约空调客户6家', priority: 'P3', status: '未接受', owner: '毕韬', dueDate: '12/31', progress: 0 },
      { id: 'v3-t17', title: '云贵川新增空调签约客户10家', priority: 'P3', status: '未接受', owner: '毕韬', dueDate: '12/31', progress: 0 },
      { id: 'v3-t18', title: '新签标杆客户2家', priority: 'P3', status: '已取消', owner: '毕韬', dueDate: '12/31', progress: 0 },
    ],
  },
];

const v6Milestones: StrategicMilestone[] = [
  {
    id: 'v6-architecture',
    title: '瑞合瑞德集团品牌架构',
    owner: '李永胜',
    dueDate: '12/31',
    progress: 0,
    tone: 'blue',
    tasks: [
      { id: 'v6-t1', title: '集团市场物料规范化', priority: 'P3', status: '进行中', owner: '李永胜', dueDate: '08/31', progress: 0 },
      { id: 'v6-t2', title: '集团品牌故事及文章输出', priority: 'P2', status: '进行中', owner: '李永胜', dueDate: '08/31', progress: 60 },
      { id: 'v6-t3', title: 'LOGO设计方案-保留大写R框架，参考希尔顿欢朋', priority: 'P3', status: '进行中', owner: '李永胜', dueDate: '08/31', progress: 100 },
      { id: 'v6-t4', title: '集团定位：多品牌运营的母品牌，打造暖通界的百胜', priority: 'P3', status: '进行中', owner: '李永胜', dueDate: '08/31', progress: 80 },
    ],
  },
  {
    id: 'v6-visual',
    title: '品牌视觉规范',
    owner: '赵祎',
    dueDate: '08/31',
    progress: 16,
    tone: 'yellow',
    tasks: [
      { id: 'v6-t5', title: '集团官网视觉把控', priority: 'P3', status: '进行中', owner: '赵祎', dueDate: '08/31', progress: 0 },
      { id: 'v6-t6', title: '成都ILC展厅视觉', priority: 'P3', status: '进行中', owner: '赵祎', dueDate: '08/31', progress: 0 },
      { id: 'v6-t7', title: '上海ILC展厅视觉', priority: 'P3', status: '进行中', owner: '赵祎', dueDate: '08/31', progress: 70 },
      { id: 'v6-t8', title: 'Rhautt Group品牌视觉把控', priority: 'P3', status: '进行中', owner: '赵祎', dueDate: '08/31', progress: 50 },
      { id: 'v6-t9', title: '恒热官网上线', priority: 'P3', status: '进行中', owner: '赵祎', dueDate: '08/31', progress: 0, overdueText: '逾期14天' },
    ],
  },
  {
    id: 'v6-water',
    title: '热水产品策略-助力销售目标达!',
    owner: '陈佳欢',
    dueDate: '12/31',
    progress: 16,
    tone: 'yellow',
    tasks: [
      { id: 'v6-t10', title: '恒热冰境展示方案定稿', priority: 'P3', status: '进行中', owner: '陈佳欢', dueDate: '12/31', progress: 25, overdueText: '逾期7天' },
      { id: 'v6-t11', title: '热水官方账号内容规划，固化更新频次', priority: 'P3', status: '进行中', owner: '陈佳欢', dueDate: '12/31', progress: 50 },
      { id: 'v6-t12', title: '恒热品牌润轮定稿', priority: 'P2', status: '已完成', owner: '陈佳欢', dueDate: '12/31', progress: 100 },
      { id: 'v6-t13', title: '瑞美/恒热案例差异化输出', priority: 'P3', status: '进行中', owner: '陈佳欢', dueDate: '12/31', progress: 0, overdueText: '逾期7天' },
      { id: 'v6-t14', title: '产品品类命名调整签发', priority: 'P3', status: '进行中', owner: '陈佳欢', dueDate: '12/31', progress: 0 },
    ],
  },
  {
    id: 'v6-air',
    title: '空调产品策略-助力销售达成20',
    owner: '巴喜平',
    dueDate: '12/31',
    progress: 20,
    tone: 'yellow',
    tasks: [
      { id: 'v6-t15', title: '瑞德AquaHART视觉设计', priority: 'P3', status: '已完成', owner: '巴喜平', dueDate: '12/31', progress: 100 },
      { id: 'v6-t16', title: '官方账号内容规划，更新频率排期', priority: 'P3', status: '进行中', owner: '巴喜平', dueDate: '12/31', progress: 100 },
      { id: 'v6-t17', title: '持续用户证言内容更新', priority: 'P3', status: '进行中', owner: '巴喜平', dueDate: '12/31', progress: 60 },
      { id: 'v6-t18', title: '确定空调技术路线', priority: 'P2', status: '进行中', owner: '巴喜平', dueDate: '08/31', progress: 25 },
      { id: 'v6-t19', title: '瑞德品牌润轮定稿', priority: 'P2', status: '进行中', owner: '巴喜平', dueDate: '12/31', progress: 90, overdueText: '逾期21天' },
    ],
  },
  {
    id: 'v6-culture',
    title: '市场组织文化建设',
    owner: '余丽琴',
    dueDate: '12/31',
    progress: 0,
    tone: 'blue',
    tasks: [
      { id: 'v6-t20', title: '跨BU联合完成任务 占比≥70%（共创新浪术、互评物料、联合市场拜访）', priority: 'P2', status: '进行中', owner: '余丽琴', dueDate: '12/31', progress: 0 },
      { id: 'v6-t21', title: '建立集团品牌共同体的身份认同与常态化协作', priority: 'P2', status: '进行中', owner: '余丽琴', dueDate: '12/31', progress: 20 },
      { id: 'v6-t22', title: '最佳品牌应用案例季度评选机制', priority: 'P2', status: '进行中', owner: '余丽琴', dueDate: '12/31', progress: 0 },
    ],
  },
];

export const strategicProjects: StrategicProject[] = [
  {
    id: 'v1',
    name: 'V1-创新引领',
    status: '进行中',
    risk: 'normal',
    riskLabel: '正常推进',
    owner: '朱萌萌',
    completion: 0,
    completionText: '0%',
    tasksText: '0/0',
    overdueTasks: 0,
    startDate: '07/06',
    dueDate: '12/31',
    objective: '-',
    progressChip: '0%',
    milestones: defaultTasks('v1', '朱萌萌'),
  },
  {
    id: 'v2',
    name: 'V2-供应链成本优化',
    status: '进行中',
    risk: 'normal',
    riskLabel: '正常推进',
    owner: '王立德',
    completion: 0,
    completionText: '0%',
    tasksText: '0/0',
    overdueTasks: 0,
    startDate: '07/06',
    dueDate: '12/31',
    objective: '-',
    progressChip: '0%',
    milestones: defaultTasks('v2', '王立德'),
  },
  {
    id: 'v3',
    name: 'V3-RUUD水机空调业务发展',
    status: '进行中',
    risk: 'overdue',
    riskLabel: '已有延期...',
    owner: '张一舟',
    completion: 27,
    completionText: '27%',
    tasksText: '1/21',
    overdueTasks: 6,
    startDate: '2025/12/21',
    dueDate: '01/19',
    objective: '-',
    progressChip: '27.35%',
    milestones: v3Milestones,
  },
  {
    id: 'v4',
    name: 'V4-热泵产品竞争力提升',
    status: '进行中',
    risk: 'overdue',
    riskLabel: '已有延期...',
    owner: '吴学亮',
    completion: 57,
    completionText: '57%',
    tasksText: '0/18',
    overdueTasks: 13,
    startDate: '2025/12/21',
    dueDate: '01/19',
    objective: '-',
    progressChip: '57%',
    milestones: defaultTasks('v4', '吴学亮'),
  },
  {
    id: 'v5',
    name: 'V5-Digital Empowerment Biz',
    status: '进行中',
    risk: 'attention',
    riskLabel: '注意风险',
    owner: '伍旭涛',
    completion: 62,
    completionText: '62%',
    tasksText: '30/55',
    overdueTasks: 24,
    startDate: '2025/12/21',
    dueDate: '12/31',
    objective: '-',
    progressChip: '62%',
    milestones: defaultTasks('v5', '伍旭涛'),
  },
  {
    id: 'v6',
    name: 'V6-Rhautt Group品牌升级',
    status: '进行中',
    risk: 'overdue',
    riskLabel: '已有延期...',
    owner: '余丽琴',
    completion: 44,
    completionText: '44%',
    tasksText: '4/28',
    overdueTasks: 7,
    startDate: '01/01',
    dueDate: '01/19',
    objective: '-',
    progressChip: '44.46%',
    milestones: v6Milestones,
  },
  {
    id: 'v7',
    name: 'V7-企业文化建设',
    status: '进行中',
    risk: 'normal',
    riskLabel: '正常推进',
    owner: '熊伟',
    completion: 0,
    completionText: '0%',
    tasksText: '0/0',
    overdueTasks: 0,
    startDate: '02/01',
    dueDate: '12/30',
    objective: '-',
    progressChip: '0%',
    milestones: defaultTasks('v7', '熊伟'),
  },
  {
    id: 'v8',
    name: 'V8-热水品类2亿销售达成',
    status: '进行中',
    risk: 'attention',
    riskLabel: '注意风险',
    owner: '袁创创',
    completion: 43,
    completionText: '43%',
    tasksText: '6/43',
    overdueTasks: 6,
    startDate: '06/25',
    dueDate: '07/24',
    objective: '-',
    progressChip: '43%',
    milestones: defaultTasks('v8', '袁创创'),
  },
  {
    id: 'v9',
    name: 'V9-客户满意度提升≥90%',
    status: '进行中',
    risk: 'overdue',
    riskLabel: '已有延期...',
    owner: '吴学亮',
    completion: 70,
    completionText: '70%',
    tasksText: '40/63',
    overdueTasks: 8,
    startDate: '01/18',
    dueDate: '02/16',
    objective: '-',
    progressChip: '70%',
    milestones: defaultTasks('v9', '吴学亮'),
  },
];

export function findStrategicProject(id: string) {
  return strategicProjects.find((project) => project.id === id);
}
