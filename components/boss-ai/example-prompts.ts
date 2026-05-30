/**
 * Context-aware BossAI example prompts
 *
 * §灵魂入口升级 (2026-05-29 PT 19:40):
 *   同事在哪个页面打开 BossAI, 示例就该贴那个场景.
 *   不是 4 个通用问题, 而是 "你现在在做的事" 的问题.
 *
 * 设计原则:
 *   - 每个 path 给 4 个 prompts (不多不少)
 *   - 第一个 prompt 是"方向不明该聚焦什么", 最高频
 *   - 第二个是"具体决策", 最强的"问老板"动机
 *   - 第三/四个是"流程性"问题
 *   - 不挂当前页面的 fallback 用通用 4 个
 */

export interface ExamplePrompt {
  icon: string;
  text: string;
}

const GENERIC_PROMPTS: ExamplePrompt[] = [
  { icon: '🎯', text: '我现在应该聚焦什么 OKR?' },
  { icon: '🤝', text: '这个客户值不值得花时间?' },
  { icon: '💡', text: '这个议题怎么对齐公司战略?' },
  { icon: '📋', text: '我这周该和谁 1on1?' },
];

const PATH_PROMPTS: Record<string, ExamplePrompt[]> = {
  // OKR 中心
  '/okr': [
    { icon: '🎯', text: '我的 OKR 哪一条最该这周突破?' },
    { icon: '⚠️', text: '我有 KR 落后, 应该砍掉哪个?' },
    { icon: '🔗', text: '我这个 KR 怎么对齐公司 O1?' },
    { icon: '📈', text: '怎么把当前进度从 60% 推到 80%?' },
  ],

  // 议事室
  '/convergence': [
    { icon: '🎯', text: '这个议题该锚到哪个 OKR?' },
    { icon: '⚖️', text: 'A/B/C 三个选项, 老板会怎么选?' },
    { icon: '🚦', text: '这件事属于红/黄/绿哪个区?' },
    { icon: '👥', text: '该召集谁来这场议事?' },
  ],

  // 1on1
  '/1on1': [
    { icon: '💬', text: '跟这位同事 1on1 应该聊什么?' },
    { icon: '🎓', text: '他/她的成长瓶颈在哪?' },
    { icon: '🚩', text: '有什么风险信号我该问?' },
    { icon: '🤝', text: '怎么给反馈不伤人但有效?' },
  ],

  // Persona / 学院
  '/persona': [
    { icon: '🎓', text: '我下一阶段晋升缺什么?' },
    { icon: '🧠', text: '我应该训练分身做哪种任务?' },
    { icon: '📚', text: '哪门必修课我应该先上?' },
    { icon: '⚖️', text: '我现在的代行权限够不够用?' },
  ],

  // Atlas / 工作台
  '/atlas': [
    { icon: '🗺️', text: 'Tandem 有什么我还没用过的?' },
    { icon: '🎯', text: '今天最该做的 3 件事?' },
    { icon: '⏰', text: '我有几件事在 wait, 哪件该催?' },
    { icon: '📊', text: '我这周整体表现怎样?' },
  ],

  '/tandem': [
    { icon: '🗺️', text: 'Tandem 有什么我还没用过的?' },
    { icon: '🎯', text: '今天最该做的 3 件事?' },
    { icon: '⏰', text: '我有几件事在 wait, 哪件该催?' },
    { icon: '📊', text: '我这周整体表现怎样?' },
  ],

  // 日报 / 报告
  '/report': [
    { icon: '✍️', text: '今天的日报怎么写更聚焦?' },
    { icon: '🎯', text: '今天推进的事对得起哪个 OKR?' },
    { icon: '🚧', text: '我卡在哪了, 怎么破?' },
    { icon: '⏭️', text: '明天该聚焦什么?' },
  ],

  // 学院
  '/learning': [
    { icon: '🎓', text: '我应该先上哪门课?' },
    { icon: '🧭', text: '我的 5 个专业方向哪个最弱?' },
    { icon: '🏆', text: '怎么最快拿到 Lv.2 上手?' },
    { icon: '📜', text: '哪个证书对我最重要?' },
  ],

  // IM
  '/im': [
    { icon: '🤝', text: '这个对话该不该升级到议事?' },
    { icon: '💬', text: '我该怎么回复这条消息?' },
    { icon: '🚦', text: '这个请求属于哪个区?' },
    { icon: '⏰', text: '我有几条 @我 的没回?' },
  ],

  // 复盘
  '/retros/me': [
    { icon: '🔍', text: '这次复盘最该学到什么?' },
    { icon: '🚧', text: '同类问题以后怎么避免?' },
    { icon: '📚', text: '这件事该不该写进 SOP?' },
    { icon: '🎯', text: '哪个 OKR 因这次复盘要调?' },
  ],

  // 9-Box / 360
  '/360': [
    { icon: '🎯', text: '我该给谁请求 360 反馈?' },
    { icon: '💬', text: '怎么给同事的反馈最有用?' },
    { icon: '🌱', text: '我的盲区可能在哪?' },
    { icon: '⚖️', text: '怎么把反馈变成行动?' },
  ],

  '/nine-box': [
    { icon: '📊', text: '我现在在 9-box 哪一格?' },
    { icon: '⬆️', text: '怎么往右上格走?' },
    { icon: '🌱', text: '我团队里谁需要重点培养?' },
    { icon: '🎯', text: '我的格子对应什么动作?' },
  ],
};

/**
 * 按当前 path 取示例 prompts.
 * 支持前缀匹配 (e.g., /okr/dashboard → /okr 的 prompts).
 * 全部 miss 时返回通用 4 个.
 */
export function getExamplePrompts(currentPath: string | null | undefined): ExamplePrompt[] {
  if (!currentPath) return GENERIC_PROMPTS;

  // 精确匹配优先
  if (PATH_PROMPTS[currentPath]) return PATH_PROMPTS[currentPath];

  // 前缀匹配 (按长度倒序, 让更具体的 path 先匹配)
  const keys = Object.keys(PATH_PROMPTS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (currentPath.startsWith(key + '/')) return PATH_PROMPTS[key];
  }

  return GENERIC_PROMPTS;
}

/**
 * 给一个 path 取一个人类可读的"当前所在"标签 (BossAI header 显示).
 * 用于让同事看到 "Tandem AI 知道我在 /okr 页, 已带入上下文"
 */
export function getPathLabel(currentPath: string | null | undefined): string | null {
  if (!currentPath) return null;
  const map: Record<string, string> = {
    '/okr': 'OKR 中心',
    '/convergence': '议事室',
    '/1on1': '1on1',
    '/persona': '我的分身',
    '/atlas': '工作台',
    '/tandem': '工作台',
    '/report': '日报',
    '/learning': '学院',
    '/im': 'IM',
    '/retros/me': '复盘',
    '/360': '360 反馈',
    '/nine-box': '9-Box',
    '/portfolio': '我的成果',
    '/memories': '知识库',
    '/knowledge': '知识库',
  };
  if (map[currentPath]) return map[currentPath];
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (currentPath.startsWith(key + '/')) return map[key];
  }
  return null;
}
