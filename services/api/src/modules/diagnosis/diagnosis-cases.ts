/**
 * 案例/效果内容库（第 4 步）—— 只读真实录入内容，绝不编造。
 * 事实源：docs/RYSNOVA-DIAGNOSIS-LIGHT-INTAKE-ALIGNMENT-2026-07-05.md §2 H（内容库驱动的信任元素）。
 *
 * 诚实红线：
 *  - 案例来自**运营策展的真实内容**（content/rysnova-cases.json），无内容即返回空数组，不编造 before/after 与证言。
 *  - 展示字段克制：标题/城市/户型/涉及系统/概述/图片引用/可选证言；不放虚构的节能率/回报数字。
 *  - 匹配为「相关度排序」的软筛选：同城市/同户型/系统重叠优先，绝不因无匹配而伪造。
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CaseStudy {
  id: string;
  title: string;
  city?: string;
  houseType?: string;
  /** 涉及的系统 code（对齐 SYSTEM_LABELS）。 */
  systems?: string[];
  summary?: string;
  /** DAM/对象存储图片引用（before/after 等），只存引用不复制文件。 */
  images?: { role?: string; url?: string; artifactId?: string; caption?: string }[];
  /** 真实业主证言（运营核实后录入）。 */
  testimonial?: { quote: string; author?: string };
}

export interface CaseQuery {
  systems?: string[];
  city?: string;
  houseType?: string;
  limit?: number;
}

/** 策展内容文件位置（运营维护；缺失则视为暂无案例，返回空）。 */
const CASES_FILE = process.env.RYSNOVA_CASES_FILE || path.join(process.cwd(), 'content', 'rysnova-cases.json');

/** 读取策展案例（容错）：文件缺失/解析失败 → 空数组（不抛错、不编造）。 */
export function loadCases(file: string = CASES_FILE): CaseStudy[] {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.cases) ? raw.cases : [];
    return arr.filter((c: any) => c && typeof c === 'object' && c.id && c.title) as CaseStudy[];
  } catch {
    return [];
  }
}

/**
 * 相关度排序软筛选（纯函数，便于测试）：
 *  - 同城市 +3、同户型 +2、每个系统重叠 +1；
 *  - 有 query 时按分降序、去零分（无相关不硬塞）；无 query 时原序返回前 limit。
 */
export function filterCases(cases: CaseStudy[], query: CaseQuery = {}): CaseStudy[] {
  const limit = Math.min(Number(query.limit) || 6, 24);
  const wantSystems = new Set((query.systems || []).filter(Boolean));
  const hasQuery = !!(query.city || query.houseType || wantSystems.size);
  if (!hasQuery) return cases.slice(0, limit);

  const scored = cases.map((c) => {
    let score = 0;
    if (query.city && c.city && c.city === query.city) score += 3;
    if (query.houseType && c.houseType && c.houseType === query.houseType) score += 2;
    if (wantSystems.size && Array.isArray(c.systems)) {
      score += c.systems.filter((s) => wantSystems.has(s)).length;
    }
    return { c, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.c);
}

/** 装配：读取 + 筛选（服务层调用）。 */
export function findCases(query: CaseQuery = {}, file: string = CASES_FILE): CaseStudy[] {
  return filterCases(loadCases(file), query);
}
