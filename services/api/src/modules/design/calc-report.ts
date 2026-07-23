/**
 * 计算书生成器（W-BIM-1 · 任务 1.5b）
 *
 * 外部参照（§6.8 深水区纪律）：
 * - 报告结构学 Carrier HAP 样张：输入假设 → 负荷计算（方法+出处）→ 系统配置
 *   → 校验明细（逐项标准条款）→ 结论；三级粒度（方案/系统/校验项）。
 * - 出处链模式学 calc-engine PROVENANCE（参数→方法→标准章节）。
 *
 * 纯函数、无 IO：输入 = design release 的 calcSnapshot（runCalc 产物快照），
 * 输出 = 结构化计算书 JSON（前端/PDF 渲染的单一来源）。
 * 诚实纪律：trust=estimate 时报告醒目标注"估算，不可作合规辩护依据"。
 */

export interface CalcReportSection {
  key: string;
  title: string;
  rows: Array<{ label: string; value: string; basis?: string }>;
  note?: string;
}

export interface CalcReport {
  title: string;
  generatedAt: string;
  trust: 'verified' | 'estimate';
  trustLabel: string;
  release?: {
    id: string;
    status: string;
    gatePass: boolean | null;
    overrideSigned: boolean;
    reviewedAt?: string | null;
    releasedAt?: string | null;
  };
  sections: CalcReportSection[];
  disclaimer: string;
}

const fmt = (v: unknown, unit = ''): string =>
  v === null || v === undefined || v === '' ? '—' : `${v}${unit}`;

export function buildCalcReport(
  snapshot: Record<string, any>,
  release?: {
    id: string; status: string; gatePass: boolean | null; overrideSigned: boolean;
    reviewedAt?: Date | null; releasedAt?: Date | null;
  },
): CalcReport {
  const input = snapshot?.input ?? {};
  const load = snapshot?.load ?? null;
  const verified = snapshot?.verifiedLoad ?? null;
  const trust: 'verified' | 'estimate' = snapshot?.loadTrust === 'verified' ? 'verified' : 'estimate';
  const gate = snapshot?.gate ?? { checks: [] };
  const systems = Array.isArray(snapshot?.systems) ? snapshot.systems : [];
  const dims = Array.isArray(snapshot?.comfortDimensions) ? snapshot.comfortDimensions : [];

  // 一、输入与假设（HAP: Input Data / Assumptions）
  const sInput: CalcReportSection = {
    key: 'input', title: '一、设计输入与假设',
    rows: [
      { label: '建筑面积', value: fmt(input.area, ' ㎡') },
      { label: '城市/气候', value: fmt(input.city) },
      { label: '建筑类型', value: fmt(input.buildingType) },
      ...(verified?.assumptions
        ? Object.entries(verified.assumptions).map(([k, v]) => ({
            label: `假设·${k}`, value: fmt(typeof v === 'object' ? JSON.stringify(v) : v),
          }))
        : []),
    ],
  };

  // 二、负荷计算（HAP: Load Summary，带方法与出处链）
  const provenance = verified?.provenance ?? null;
  const methodRows = provenance?.methods
    ? Object.entries(provenance.methods as Record<string, string>).map(([k, v]) => ({
        label: `方法·${k}`, value: v, basis: String(provenance.standard ?? ''),
      }))
    : [];
  const sLoad: CalcReportSection = {
    key: 'load', title: '二、负荷计算',
    rows: [
      { label: '计算等级', value: trust === 'verified' ? 'verified（可溯源精算）' : 'estimate（工程估算）' },
      { label: '冷负荷', value: fmt(verified?.cooling_load_kw ?? load?.coolingLoad ?? load?.cooling, ' kW'),
        basis: trust === 'verified' ? String(verified?.method ?? '') : '内置估算' },
      { label: '热负荷', value: fmt(verified?.heating_load_kw ?? load?.heatingLoad ?? load?.heating, ' kW'),
        basis: trust === 'verified' ? String(verified?.method ?? '') : '内置估算' },
      ...(verified?.breakdown_kw
        ? Object.entries(verified.breakdown_kw as Record<string, number>).map(([k, v]) => ({
            label: `分项·${k}`, value: fmt(Number(v).toFixed(2), ' kW'),
          }))
        : []),
      ...methodRows,
    ],
    note: verified?.warnings?.length ? `计算警告：${verified.warnings.join('；')}` : undefined,
  };

  // 三、系统配置（HAP: System Summary）
  const sSystems: CalcReportSection = {
    key: 'systems', title: '三、系统配置',
    rows: systems.map((s: any) => ({
      label: s.label, value: s.selected ? '选用' : '未选用',
      basis: s.design ? '已生成系统设计（见附录）' : undefined,
    })),
  };

  // 四、合规校验明细（HAP: 校验逐项 + 标准条款出处 —— 我方差异所在）
  const STATUS_LABEL: Record<string, string> = { pass: '通过', fail: '未达标', insufficient_data: '数据不足' };
  const sGate: CalcReportSection = {
    key: 'gate', title: '四、国标合规校验明细',
    rows: (gate.checks ?? []).map((c: any) => ({
      label: c.label, value: `${STATUS_LABEL[c.status] ?? c.status}：${c.message}`, basis: c.standard,
    })),
    note: gate.blocked
      ? `存在拦截项：${(gate.blockers ?? []).join('；')}${gate.requiresOverride ? '（需经销商签字越过方可放行）' : ''}`
      : undefined,
  };

  // 五、五恒舒适维度
  const sDims: CalcReportSection = {
    key: 'comfort', title: '五、五恒舒适维度达标',
    rows: dims.map((d: any) => ({
      label: d.label, value: d.ok === true ? '达标' : d.ok === false ? '未达标' : '数据不足', basis: d.basis,
    })),
  };

  // 六、结论
  const sConclusion: CalcReportSection = {
    key: 'conclusion', title: '六、结论',
    rows: [
      { label: '可放行（出图/锁价）', value: snapshot?.releasable ? '是' : '否（需整改或签字越过）' },
      { label: '需签字越过', value: snapshot?.requiresOverride ? '是' : '否' },
      ...(release ? [
        { label: '发布状态', value: release.status },
        { label: '越过签字', value: release.overrideSigned ? '已签署（留审计）' : '无' },
      ] : []),
    ],
  };

  return {
    title: '暖通设计计算书',
    generatedAt: new Date().toISOString(),
    trust,
    trustLabel: trust === 'verified'
      ? 'VERIFIED · ASHRAE 可溯源精算'
      : 'ESTIMATE · 工程估算（不可作合规辩护依据）',
    release: release
      ? {
          id: release.id, status: release.status, gatePass: release.gatePass,
          overrideSigned: release.overrideSigned,
          reviewedAt: release.reviewedAt ? new Date(release.reviewedAt).toISOString() : null,
          releasedAt: release.releasedAt ? new Date(release.releasedAt).toISOString() : null,
        }
      : undefined,
    sections: [sInput, sLoad, sSystems, sGate, sDims, sConclusion],
    disclaimer: String(snapshot?.disclaimer ?? '最终合规与选型由经销商负责。'),
  };
}
