/**
 * 问诊痛点知识库（原生收割自 Legacy PainPointDiagnosisEngineV3）。
 * 事实源：docs/RYSNOVA-DIAGNOSIS-LIGHT-INTAKE-ALIGNMENT-2026-07-05.md §2（B/C 收割改造、I 丢）。
 *
 * 收割：6 维 48 项痛点词库、户型自动勾选条件、profile→隐性痛点规则。
 * 丢弃（诚实红线）：硬编码预算/节能率%/回收年限/匹配度%/增值% 等无来源假精确数字，
 *   以及 whyChoose/talkingPoints 营销话术、calculateBudget 魔数。价格一律交 quote 域真实目录价。
 *
 * 系统 code 统一对齐新店 SYSTEM_LABELS：hot_water/heating/water_treatment/fresh_air/air/smart_control。
 * 本模块为纯数据 + 纯函数，无副作用；条件评估容错（无法解析即视为未命中，不抛错）。
 */

import type { SYSTEM_LABELS } from './diagnosis-engine';

export type SystemCode = keyof typeof SYSTEM_LABELS;

/** 痛点严重度（编辑分级，用于内部排序与渐进呈现；非产品效果承诺）。 */
export type PainSeverity = 'high' | 'medium' | 'low';

/** 六大痛点维度 code。 */
export type PainDimensionKey =
  | 'temperature'
  | 'hot_water'
  | 'air'
  | 'water'
  | 'heating_cooling'
  | 'hassle_free';

export interface PainPoint {
  /** 稳定 id（沿用 Legacy 前缀便于历史数据对齐）。 */
  id: string;
  /** 家庭语言的痛点名。 */
  name: string;
  /** 该痛点指向的系统建议（新店 code）。 */
  systems: SystemCode[];
  /** 编辑分级，仅供内部排序/呈现优先级。 */
  severity: PainSeverity;
  /** 痛点现象说明（描述问题本身，非我方方案收益）。 */
  description: string;
  /** 户型自动勾选条件（DSL，见 evaluatePainCondition）；无则不自动勾选。 */
  autoCheck?: string;
  /** 是否高频痛点：true 进 Step2 首屏，false 折叠到「继续补充细节」。 */
  primary?: boolean;
}

export interface PainDimension {
  key: PainDimensionKey;
  name: string;
  points: PainPoint[];
}

/** 6 维 48 项痛点词库。 */
export const PAIN_DIMENSIONS: PainDimension[] = [
  {
    key: 'temperature',
    name: '温度体感',
    points: [
      { id: 't_01', name: '上下楼层温差大', systems: ['heating', 'air'], severity: 'high', primary: true, description: '热空气上升导致楼上偏热、楼下偏冷，冬夏体感温差明显。', autoCheck: 'floors >= 2' },
      { id: 't_02', name: '西晒/落地窗夏热冬冷', systems: ['air', 'heating'], severity: 'high', description: '大面积玻璃或西晒导致夏季午后室温急剧上升、冬季散热快。', autoCheck: 'features.includes("大面积落地窗") || features.includes("西晒")' },
      { id: 't_03', name: '老人怕空调直吹', systems: ['air'], severity: 'high', primary: true, description: '传统分体空调冷风直吹易引起头痛、关节不适，老人更敏感。', autoCheck: 'hasElderly == true' },
      { id: 't_04', name: '采暖升温慢/不均', systems: ['heating'], severity: 'medium', description: '暖气片辐射采暖靠近处过热、远离处偏冷，升温慢。', autoCheck: 'hasFloorHeating == false' },
      { id: 't_05', name: '回南天室内闷热潮湿', systems: ['fresh_air', 'air'], severity: 'medium', description: '梅雨/回南季室内湿度偏高，体感黏腻不适。', autoCheck: 'region in ["华东","华南"]' },
      { id: 't_06', name: '顶楼/阁楼夏天过热', systems: ['air'], severity: 'high', description: '顶层受日晒影响温度偏高，普通空调降温吃力。', autoCheck: 'propertyType == "顶楼" || propertyType == "阁楼"' },
      { id: 't_07', name: '空调噪音影响睡眠', systems: ['air'], severity: 'medium', description: '分体空调内外机运行噪音影响夜间休息质量。', autoCheck: 'bedrooms >= 2' },
      { id: 't_08', name: '温度调节不精准', systems: ['smart_control', 'air'], severity: 'low', description: '传统空调温度波动大，体感忽冷忽热。', autoCheck: 'smartHome == false' },
    ],
  },
  {
    key: 'hot_water',
    name: '热水用水',
    points: [
      { id: 'h_01', name: '远端龙头放冷水久', systems: ['hot_water'], severity: 'high', primary: true, description: '卫生间距离热水器较远，开水后需排放一段冷水才出热水。', autoCheck: 'bathrooms >= 2' },
      { id: 'h_02', name: '多点同时用水水温波动', systems: ['hot_water'], severity: 'high', primary: true, description: '两处同时用热水时水温、水压容易波动。', autoCheck: 'bathrooms >= 2 || bathtubs >= 1' },
      { id: 'h_03', name: '用水高峰水流变小', systems: ['hot_water'], severity: 'medium', description: '早晚高峰多点用水导致水压下降。', autoCheck: 'occupants >= 4' },
      { id: 'h_04', name: '浴缸放不满就凉了', systems: ['hot_water'], severity: 'high', description: '大浴缸需要持续热水供应，储水式热水器容量吃紧。', autoCheck: 'bathtubs >= 1' },
      { id: 'h_05', name: '电热水器不够用', systems: ['hot_water'], severity: 'medium', description: '储水式热水器连续多人使用后需等待再加热。', autoCheck: 'occupants >= 4' },
      { id: 'h_06', name: '热水器占空间', systems: ['hot_water'], severity: 'low', description: '传统储水式热水器体积大，占用阳台/卫生间空间。', autoCheck: 'area < 100' },
      { id: 'h_07', name: '等热水浪费水', systems: ['hot_water'], severity: 'medium', description: '每次等待热水会排放掉一部分冷水，长期造成浪费。', autoCheck: 'bathrooms >= 2' },
      { id: 'h_08', name: '热水能耗/费用高', systems: ['hot_water'], severity: 'medium', description: '传统热水方式的能源费用是家庭关注点。' },
    ],
  },
  {
    key: 'air',
    name: '潮湿/空气',
    points: [
      { id: 'a_01', name: '地下空间常年潮湿发霉', systems: ['fresh_air'], severity: 'high', description: '地下室因湿气渗透，墙面家具易受潮发霉。', autoCheck: 'basement != "无"' },
      { id: 'a_02', name: '换季家人易过敏/哮喘', systems: ['fresh_air'], severity: 'high', description: '花粉、尘螨等过敏原引起打喷嚏、呼吸不适。', autoCheck: 'hasAllergy == true' },
      { id: 'a_03', name: '通风差、闷、易犯困', systems: ['fresh_air'], severity: 'medium', description: '密闭空间空气不流通，久待易头昏乏力。', autoCheck: 'ventilation == "poor"' },
      { id: 'a_04', name: '宠物/烹饪/装修异味难散', systems: ['fresh_air'], severity: 'medium', description: '异味与有害气体长期滞留室内。', autoCheck: 'hasPet == true || cookingStyle == "重油"' },
      { id: 'a_05', name: '灰尘大、滤网频繁清洗', systems: ['fresh_air'], severity: 'low', primary: true, description: '灰尘、颗粒物堆积，清洁负担重。', autoCheck: 'airQuality == "poor"' },
      { id: 'a_06', name: '梅雨季发霉', systems: ['fresh_air'], severity: 'high', primary: true, description: '梅雨季湿度持续偏高，墙面、衣柜、家具易发霉。', autoCheck: 'region in ["华东","华南"]' },
      { id: 'a_07', name: '冬天过于干燥', systems: ['fresh_air'], severity: 'medium', description: '采暖季室内湿度偏低，皮肤与呼吸道干燥不适。', autoCheck: 'region in ["华北","东北"]' },
      { id: 'a_08', name: '临街噪音大无法开窗', systems: ['fresh_air'], severity: 'medium', description: '交通噪音导致不便开窗通风，空气质量受影响。', autoCheck: 'nearRoad == true' },
      { id: 'a_09', name: '装修后担心甲醛', systems: ['fresh_air'], severity: 'high', primary: true, description: '新装修阶段家庭普遍担心甲醛等有害气体。', autoCheck: 'isNewDecoration == true' },
    ],
  },
  {
    key: 'water',
    name: '水质健康',
    points: [
      { id: 'w_01', name: '水垢多、清洗耗时', systems: ['water_treatment'], severity: 'medium', primary: true, description: '水质偏硬，水壶、龙头、花洒易结垢。', autoCheck: 'waterHardness == "high"' },
      { id: 'w_02', name: '自来水有余氯/异味', systems: ['water_treatment'], severity: 'medium', description: '自来水存在余氯味，影响饮用与口感。', autoCheck: 'waterTaste == "chlorine"' },
      { id: 'w_03', name: '母婴用水更想洁净', systems: ['water_treatment'], severity: 'high', description: '家有婴幼儿，对饮用与冲调用水洁净度要求更高。', autoCheck: 'hasInfant == true' },
      { id: 'w_04', name: '花洒喷头易堵塞', systems: ['water_treatment'], severity: 'medium', description: '水垢堵塞花洒喷孔，出水不均。', autoCheck: 'waterHardness == "high"' },
      { id: 'w_05', name: '桶装水换水麻烦占地', systems: ['water_treatment'], severity: 'low', description: '频繁换水费力，水桶占空间。', autoCheck: 'waterSource == "barrel"' },
      { id: 'w_06', name: '洗漱后皮肤干燥', systems: ['water_treatment'], severity: 'low', description: '硬水洗后皮肤紧绷、起泡少。', autoCheck: 'waterHardness == "high"' },
      { id: 'w_07', name: '衣物洗后发黄变硬', systems: ['water_treatment'], severity: 'low', description: '硬水洗涤易使衣物发黄、纤维变硬。', autoCheck: 'waterHardness == "high"' },
      { id: 'w_08', name: '厨房用水安全担忧', systems: ['water_treatment'], severity: 'medium', description: '洗菜做饭用水安全是家庭关注点。', autoCheck: 'hasInfant == true || hasElderly == true' },
    ],
  },
  {
    key: 'heating_cooling',
    name: '采暖/空调',
    points: [
      { id: 'c_01', name: '暖气片占空间不美观', systems: ['heating'], severity: 'medium', description: '暖气片占用墙面，影响家具摆放与美观。', autoCheck: 'heatingType == "radiator"' },
      { id: 'c_02', name: '空调外机位不够', systems: ['air'], severity: 'high', description: '外机位有限，难以安装多台分体空调。', autoCheck: 'propertyType == "公寓"' },
      { id: 'c_03', name: '中央空调噪音', systems: ['air'], severity: 'medium', description: '部分中央空调运行噪音影响休息。', autoCheck: 'hasCentralAC == true' },
      { id: 'c_04', name: '地暖维修困难', systems: ['heating'], severity: 'medium', description: '地暖管道问题可能需破坏地面，维修成本高。', autoCheck: 'hasFloorHeating == true' },
      { id: 'c_05', name: '长期吹空调不适', systems: ['air', 'fresh_air'], severity: 'medium', description: '长期直吹空调易引起干燥、头痛等不适。', autoCheck: 'acUsage == "high"' },
      { id: 'c_06', name: '冬季制热效果差', systems: ['heating'], severity: 'high', primary: true, description: '低温环境下普通空调制热能力下降。', autoCheck: 'region in ["华北","东北"]' },
      { id: 'c_07', name: '空调吹出灰尘/异味', systems: ['air', 'fresh_air'], severity: 'medium', description: '空调内部积灰后出风有异味。', autoCheck: 'acAge > 3' },
      { id: 'c_08', name: '外机滴水影响邻居', systems: ['air'], severity: 'low', description: '多台外机冷凝水滴落，影响楼下。', autoCheck: 'propertyType == "公寓"' },
    ],
  },
  {
    key: 'hassle_free',
    name: '省心/智能/总包',
    points: [
      { id: 's_01', name: '多品牌售后互相推诿', systems: ['smart_control'], severity: 'high', primary: true, description: '多家供应商协调困难、责任不清。', autoCheck: 'multiBrand == true' },
      { id: 's_02', name: '隐蔽工程漏水/结露', systems: ['smart_control'], severity: 'high', description: '管路设计不当，后期维修需破坏装修。', autoCheck: 'hasLeakHistory == true' },
      { id: 's_03', name: '设备无智能联动', systems: ['smart_control'], severity: 'medium', description: '各系统独立运行，需手动逐个操作。', autoCheck: 'smartHome == false' },
      { id: 's_04', name: '担心能耗高', systems: ['smart_control'], severity: 'high', primary: true, description: '能源费用是长期使用的关注点。', autoCheck: 'energyCostConcern == true' },
      { id: 's_05', name: '怕施工增项超预算', systems: ['smart_control'], severity: 'medium', description: '担心施工过程不断增项、最终超预算。', autoCheck: 'budgetStrict == true' },
      { id: 's_06', name: '怕管路设计出错', systems: ['smart_control'], severity: 'medium', description: '担心隐蔽工程设计不合理，影响后期使用。', autoCheck: 'firstTimeOwner == true' },
      { id: 's_07', name: '后期维护麻烦', systems: ['smart_control'], severity: 'medium', description: '多品牌设备维护需联系不同厂家，响应慢。', autoCheck: 'busyOwner == true' },
    ],
  },
];

/** profile → 隐性痛点建议规则（收割 aiRules；confidence 小数改为粗档 strength，去假精确）。 */
export interface ImplicitRule {
  pattern: Record<string, unknown>;
  recommend: string[];
  strength: PainSeverity;
  reason: string;
}

export const IMPLICIT_RULES: ImplicitRule[] = [
  { pattern: { propertyType: ['独栋', '叠拼', '联排'] }, recommend: ['t_01', 't_02'], strength: 'high', reason: '多层户型常见楼层温差与采光问题' },
  { pattern: { features: ['西晒'] }, recommend: ['t_02'], strength: 'high', reason: '西晒易致夏季过热' },
  { pattern: { features: ['大面积落地窗'] }, recommend: ['t_02', 't_06'], strength: 'high', reason: '大面积玻璃易致夏热冬冷' },
  { pattern: { hasElderly: true }, recommend: ['t_03', 'h_04', 'w_03'], strength: 'high', reason: '老人对温度、热水与用水洁净更敏感' },
  { pattern: { hasInfant: true }, recommend: ['t_03', 'w_03', 'a_02'], strength: 'high', reason: '婴幼儿需要舒适温度、洁净用水与空气' },
  { pattern: { bathrooms: 3 }, recommend: ['h_01', 'h_02', 'h_04'], strength: 'high', reason: '多卫生间需要稳定热水供应' },
  { pattern: { bathtubs: 1 }, recommend: ['h_04'], strength: 'medium', reason: '浴缸需要大流量持续热水' },
  { pattern: { occupants: 5 }, recommend: ['h_02', 'h_05'], strength: 'medium', reason: '多人口家庭热水需求大' },
  { pattern: { basement: ['1层', '2层'] }, recommend: ['a_01', 'a_06'], strength: 'high', reason: '地下空间常见潮湿问题' },
  { pattern: { region: '华东' }, recommend: ['a_06', 't_05'], strength: 'medium', reason: '华东梅雨季潮湿闷热' },
  { pattern: { isNewDecoration: true }, recommend: ['a_09', 'w_03'], strength: 'high', reason: '新装修阶段关注除醛与净水' },
  { pattern: { multiBrand: true }, recommend: ['s_01', 's_07'], strength: 'high', reason: '多品牌设备售后复杂' },
  { pattern: { budgetStrict: true }, recommend: ['s_04', 's_05'], strength: 'medium', reason: '预算敏感，关注能耗与增项' },
];

// ── 索引与工具 ──────────────────────────────────────────────────────────

const POINT_INDEX: Map<string, { point: PainPoint; dimension: PainDimension }> = (() => {
  const m = new Map<string, { point: PainPoint; dimension: PainDimension }>();
  for (const dim of PAIN_DIMENSIONS) for (const p of dim.points) m.set(p.id, { point: p, dimension: dim });
  return m;
})();

export function findPainPoint(id: string): PainPoint | null {
  return POINT_INDEX.get(id)?.point ?? null;
}

export function countPainPoints(): number {
  return POINT_INDEX.size;
}

/** 全部痛点（扁平）。 */
export function listPainPoints(): PainPoint[] {
  return [...POINT_INDEX.values()].map((v) => v.point);
}

/**
 * 户型条件评估（收割 V3 evaluateCondition，纯函数、容错）。
 * 支持：字段 ==/!= "字符串" 或 数字、>/</>=/<=、features.includes("x")、region in ["a","b"]、|| 组合。
 * 无法解析或缺字段一律返回 false（不抛错），保证渐进问诊稳健。
 */
export function evaluatePainCondition(condition: string | undefined, profile: Record<string, any> = {}): boolean {
  if (!condition) return false;
  // 支持顶层 || 组合（V3 里出现的唯一逻辑连接）。
  if (condition.includes('||')) {
    return condition.split('||').some((part) => evaluatePainCondition(part.trim(), profile));
  }
  try {
    const featureMatch = condition.match(/(\w+)\.includes\("([^"]+)"\)/);
    if (featureMatch) {
      const arr = profile[featureMatch[1]];
      return Array.isArray(arr) && arr.includes(featureMatch[2]);
    }
    const inMatch = condition.match(/(\w+)\s+in\s+\[(.+?)\]/);
    if (inMatch) {
      const opts = inMatch[2].replace(/"/g, '').split(',').map((s) => s.trim());
      return opts.includes(String(profile[inMatch[1]]));
    }
    const ops: { re: RegExp; fn: (a: any, b: string) => boolean }[] = [
      { re: /(\w+)\s*==\s*"([^"]+)"/, fn: (a, b) => String(a) === b },
      { re: /(\w+)\s*==\s*(true|false)/, fn: (a, b) => Boolean(a) === (b === 'true') },
      { re: /(\w+)\s*==\s*(\d+)/, fn: (a, b) => Number(a) === Number(b) },
      { re: /(\w+)\s*!=\s*"([^"]+)"/, fn: (a, b) => a !== undefined && String(a) !== b },
      { re: /(\w+)\s*>=\s*(\d+)/, fn: (a, b) => Number(a) >= Number(b) },
      { re: /(\w+)\s*<=\s*(\d+)/, fn: (a, b) => Number(a) <= Number(b) },
      { re: /(\w+)\s*>\s*(\d+)/, fn: (a, b) => Number(a) > Number(b) },
      { re: /(\w+)\s*<\s*(\d+)/, fn: (a, b) => Number(a) < Number(b) },
    ];
    for (const { re, fn } of ops) {
      const m = condition.match(re);
      if (m) {
        const val = profile[m[1]];
        if (val === undefined || val === null || val === '') return false;
        return fn(val, m[2]);
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** 渐进式诊断提纲：Step2 首屏高频痛点（primary）。 */
export function primaryPainPoints(): PainPoint[] {
  return listPainPoints().filter((p) => p.primary);
}

/** 「继续补充细节」折叠区的次级痛点，按维度分组。 */
export function secondaryPainPointsByDimension(): { key: PainDimensionKey; name: string; points: PainPoint[] }[] {
  return PAIN_DIMENSIONS.map((d) => ({
    key: d.key,
    name: d.name,
    points: d.points.filter((p) => !p.primary),
  })).filter((g) => g.points.length > 0);
}

/** 户型自动勾选：命中 autoCheck 条件的痛点 id + 说明（像医生按体检数据提示）。 */
export function autoDetectPainPoints(profile: Record<string, any> = {}): { id: string; name: string; reason: string }[] {
  const out: { id: string; name: string; reason: string }[] = [];
  for (const p of listPainPoints()) {
    if (p.autoCheck && evaluatePainCondition(p.autoCheck, profile)) {
      out.push({ id: p.id, name: p.name, reason: p.description });
    }
  }
  return out;
}

function matchPattern(profile: Record<string, any>, pattern: Record<string, unknown>): boolean {
  return Object.keys(pattern).every((key) => {
    const expected = pattern[key];
    const actual = profile[key];
    if (Array.isArray(expected)) {
      return Array.isArray(actual) ? actual.some((v) => (expected as unknown[]).includes(v)) : (expected as unknown[]).includes(actual);
    }
    return actual === expected;
  });
}

/**
 * 隐性痛点推断（收割 aiRules）：从 profile 推断业主可能没主动说、但很可能存在的痛点。
 * 排除已手选项；按 strength(high>medium>low) 排序；不产出假精确 confidence 百分比。
 */
export function inferImplicitPainPoints(
  profile: Record<string, any> = {},
  selectedIds: string[] = [],
): { id: string; name: string; systems: SystemCode[]; reason: string; strength: PainSeverity }[] {
  const selected = new Set(selectedIds);
  const seen = new Set<string>();
  const out: { id: string; name: string; systems: SystemCode[]; reason: string; strength: PainSeverity }[] = [];
  for (const rule of IMPLICIT_RULES) {
    if (!matchPattern(profile, rule.pattern)) continue;
    for (const id of rule.recommend) {
      if (selected.has(id) || seen.has(id)) continue;
      const p = findPainPoint(id);
      if (!p) continue;
      seen.add(id);
      out.push({ id, name: p.name, systems: p.systems, reason: rule.reason, strength: rule.strength });
    }
  }
  const order: Record<PainSeverity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.strength] - order[b.strength]);
}

/** 每维度一句引导式追问（渐进问诊用；家庭语言，不含术语）。 */
const DIMENSION_QUESTIONS: Record<PainDimensionKey, string> = {
  temperature: '家里冬夏的温度体感怎么样？有没有忽冷忽热、温差大或空调直吹不舒服的情况？',
  hot_water: '用热水时顺手吗？比如洗澡要不要等、多个地方同时用会不会忽冷忽热？',
  air: '室内空气和潮湿怎么样？有没有闷、异味、灰尘大，或者梅雨季发霉、装修后担心甲醛？',
  water: '家里的水质如何？有没有水垢、异味，或者家有老人小孩对饮用水更在意？',
  heating_cooling: '现在的采暖和空调用着顺心吗？有没有制热不给力、噪音、占空间或维护麻烦？',
  hassle_free: '整套系统的省心程度呢？在意智能联动、能耗，还是担心多品牌售后和施工增项？',
};

/**
 * 渐进式下一问：给出「尚未覆盖」的第一个维度的引导问题。
 * 已覆盖 = 该维度已有痛点被选中/命中。全覆盖返回 null（可进入归纳）。
 */
export function progressiveNextQuestion(coveredPainIds: string[] = []): { dimension: PainDimensionKey; question: string } | null {
  const covered = new Set(coveredPainIds);
  for (const dim of PAIN_DIMENSIONS) {
    const touched = dim.points.some((p) => covered.has(p.id));
    if (!touched) return { dimension: dim.key, question: DIMENSION_QUESTIONS[dim.key] };
  }
  return null;
}

export interface GeoQuestionSeed {
  stage: 'pre' | 'mid' | 'post';
  question: string;
  painId: string;
  systems: SystemCode[];
}

/**
 * 问诊痛点 → GEO 选题（打通增长中枢 E3）。
 * 把业主真实高频痛点转成「消费者会向 AI 搜索引擎提的问题」，供 GEO 探测与内容缺口回流。
 * 纯模板 + 痛点名填充，不编造品牌/参数；品牌可见度由 GEO 侧分析。
 */
export function painPointsToGeoQuestions(ids: string[] = []): GeoQuestionSeed[] {
  const seen = new Set<string>();
  const out: GeoQuestionSeed[] = [];
  for (const raw of ids) {
    const key = String(raw ?? '').trim();
    const p = findPainPoint(key) ?? NAME_INDEX.get(key) ?? null;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ stage: 'pre', painId: p.id, systems: p.systems, question: `${p.name}怎么解决？有哪些舒适系统方案值得推荐？` });
    out.push({ stage: 'mid', painId: p.id, systems: p.systems, question: `解决${p.name}，主流品牌怎么选、如何对比更靠谱？` });
  }
  return out;
}

const NAME_INDEX: Map<string, PainPoint> = (() => {
  const m = new Map<string, PainPoint>();
  for (const { point } of POINT_INDEX.values()) m.set(point.name, point);
  return m;
})();

/**
 * 选中痛点 → 去重后的系统建议 code（对齐 SYSTEM_LABELS）。
 * 容错：入参可为痛点 id（t_01）或痛点名（远端龙头放冷水久）；未知项忽略。
 */
export function painPointsToSystems(items: string[] = []): SystemCode[] {
  const set = new Set<SystemCode>();
  for (const raw of items) {
    const key = String(raw ?? '').trim();
    const p = findPainPoint(key) ?? NAME_INDEX.get(key) ?? null;
    if (p) p.systems.forEach((s) => set.add(s));
  }
  return [...set];
}
