import { Injectable } from '@nestjs/common';
import { Engine } from 'json-rules-engine';

// ── M11 价格护栏（PRD 4.9 配套）──────────────────────────────────────────────
// 用 json-rules-engine（ISC）做声明式定价护栏：毛利下限 / 折扣上限 / 单行毛利。
// 纯计算、无 DB 依赖，boot-smoke 安全。阈值支持租户级覆盖。

export interface GuardrailLine {
  sku?: string | null;
  name?: string | null;
  unitPrice: number;      // 售价
  unitCost?: number;      // 成本（缺省则跳过毛利校验）
  guidePrice?: number;    // 品牌指导价(MDM verified，缺省则跳过折扣校验)
  quantity?: number;
}

export interface GuardrailThresholds {
  minGrossMarginPct: number;  // 整单最低毛利率(%)
  maxDiscountPct: number;     // 相对指导价最大折扣(%)
  minLineMarginPct: number;   // 单行最低毛利率(%)
}

export interface GuardrailInput {
  items: GuardrailLine[];
  thresholds?: Partial<GuardrailThresholds>;
}

export interface GuardrailViolation {
  rule: string;
  severity: 'block' | 'warn';
  message: string;
  detail?: Record<string, unknown>;
}

export interface GuardrailResult {
  passed: boolean;          // 无任何违规
  blocked: boolean;         // 含 block 级违规（应阻断锁价/签约）
  thresholds: GuardrailThresholds;
  facts: Record<string, number | null>;
  violations: GuardrailViolation[];
}

const DEFAULT_THRESHOLDS: GuardrailThresholds = {
  minGrossMarginPct: 15,
  maxDiscountPct: 30,
  minLineMarginPct: 5,
};

@Injectable()
export class PriceGuardrailService {
  resolveThresholds(override?: Partial<GuardrailThresholds>): GuardrailThresholds {
    return { ...DEFAULT_THRESHOLDS, ...(override ?? {}) };
  }

  // 由报价项推导护栏事实
  computeFacts(items: GuardrailLine[]) {
    let subtotal = 0;
    let totalCost = 0;
    let guideTotal = 0;
    let hasCost = false;
    let hasGuide = false;
    let worstLineMarginPct: number | null = null;
    let worstLine: GuardrailLine | null = null;

    for (const it of items ?? []) {
      const qty = Number(it.quantity ?? 1);
      const price = Number(it.unitPrice ?? 0);
      subtotal += price * qty;
      if (it.unitCost != null) {
        hasCost = true;
        totalCost += Number(it.unitCost) * qty;
        if (price > 0) {
          const lm = ((price - Number(it.unitCost)) / price) * 100;
          if (worstLineMarginPct == null || lm < worstLineMarginPct) {
            worstLineMarginPct = lm;
            worstLine = it;
          }
        }
      }
      if (it.guidePrice != null) {
        hasGuide = true;
        guideTotal += Number(it.guidePrice) * qty;
      }
    }

    const grossMarginPct = hasCost && subtotal > 0 ? ((subtotal - totalCost) / subtotal) * 100 : null;
    const discountPct = hasGuide && guideTotal > 0 ? ((guideTotal - subtotal) / guideTotal) * 100 : null;

    return {
      subtotal: round(subtotal),
      totalCost: hasCost ? round(totalCost) : null,
      guideTotal: hasGuide ? round(guideTotal) : null,
      grossMarginPct: grossMarginPct == null ? null : round(grossMarginPct),
      discountPct: discountPct == null ? null : round(discountPct),
      worstLineMarginPct: worstLineMarginPct == null ? null : round(worstLineMarginPct),
      _worstLine: worstLine,
    };
  }

  async evaluate(input: GuardrailInput): Promise<GuardrailResult> {
    const thresholds = this.resolveThresholds(input.thresholds);
    const facts = this.computeFacts(input.items ?? []);
    const engine = new Engine([], { allowUndefinedFacts: true });

    // 整单毛利下限（block）
    engine.addRule({
      conditions: { all: [{ fact: 'grossMarginPct', operator: 'lessThan', value: thresholds.minGrossMarginPct }] },
      event: { type: 'gross-margin-floor', params: { severity: 'block' } },
    });
    // 折扣上限（block）
    engine.addRule({
      conditions: { all: [{ fact: 'discountPct', operator: 'greaterThan', value: thresholds.maxDiscountPct }] },
      event: { type: 'discount-ceiling', params: { severity: 'block' } },
    });
    // 单行毛利下限（warn）
    engine.addRule({
      conditions: { all: [{ fact: 'worstLineMarginPct', operator: 'lessThan', value: thresholds.minLineMarginPct }] },
      event: { type: 'line-margin-floor', params: { severity: 'warn' } },
    });

    const { events } = await engine.run({
      grossMarginPct: facts.grossMarginPct,
      discountPct: facts.discountPct,
      worstLineMarginPct: facts.worstLineMarginPct,
    });

    const violations: GuardrailViolation[] = events.map((e) => this.toViolation(e.type, (e.params as any)?.severity, thresholds, facts));
    const blocked = violations.some((v) => v.severity === 'block');

    return {
      passed: violations.length === 0,
      blocked,
      thresholds,
      facts: {
        subtotal: facts.subtotal,
        totalCost: facts.totalCost,
        guideTotal: facts.guideTotal,
        grossMarginPct: facts.grossMarginPct,
        discountPct: facts.discountPct,
        worstLineMarginPct: facts.worstLineMarginPct,
      },
      violations,
    };
  }

  private toViolation(type: string, severity: 'block' | 'warn', t: GuardrailThresholds, f: ReturnType<PriceGuardrailService['computeFacts']>): GuardrailViolation {
    switch (type) {
      case 'gross-margin-floor':
        return { rule: type, severity, message: `整单毛利率 ${f.grossMarginPct}% 低于下限 ${t.minGrossMarginPct}%`, detail: { grossMarginPct: f.grossMarginPct, min: t.minGrossMarginPct } };
      case 'discount-ceiling':
        return { rule: type, severity, message: `相对指导价折扣 ${f.discountPct}% 超过上限 ${t.maxDiscountPct}%`, detail: { discountPct: f.discountPct, max: t.maxDiscountPct } };
      case 'line-margin-floor':
        return { rule: type, severity, message: `存在单行毛利率 ${f.worstLineMarginPct}% 低于下限 ${t.minLineMarginPct}%（${f._worstLine?.name ?? f._worstLine?.sku ?? '未命名行'}）`, detail: { worstLineMarginPct: f.worstLineMarginPct, min: t.minLineMarginPct, line: f._worstLine } };
      default:
        return { rule: type, severity, message: `命中护栏规则 ${type}` };
    }
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
