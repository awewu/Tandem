// 多触点归因纯逻辑（度量中台）—— 与服务/DB 解耦，便于单测。
// 触点按时间升序;返回与触点等长、和为 1 的权重,再按渠道聚合。
export type AttributionModel = 'linear' | 'position' | 'time_decay';

export interface Touch {
  channel: string;
  at: number; // epoch ms
}

const DAY_MS = 24 * 3600 * 1000;

export function touchWeights(touches: Touch[], model: AttributionModel, opts: { halfLifeMs?: number; conversionAt?: number } = {}): number[] {
  const n = touches.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  if (model === 'linear') return touches.map(() => 1 / n);

  if (model === 'position') {
    // U 型:首 40% + 尾 40% + 中间 20% 均分;n==2 → 50/50
    if (n === 2) return [0.5, 0.5];
    const w = new Array(n).fill(0);
    w[0] = 0.4;
    w[n - 1] = 0.4;
    const midShare = 0.2 / (n - 2);
    for (let i = 1; i < n - 1; i++) w[i] = midShare;
    return w;
  }

  // time_decay:越接近转化，权重越高;默认半衰期 7 天
  const halfLife = opts.halfLifeMs ?? 7 * DAY_MS;
  const conv = opts.conversionAt ?? touches[n - 1].at;
  const raw = touches.map((t) => Math.pow(0.5, Math.max(0, conv - t.at) / halfLife));
  const sum = raw.reduce((s, x) => s + x, 0) || 1;
  return raw.map((x) => x / sum);
}

/** 单个转化 → 各渠道信用(同渠道多次触点累加;各渠道之和 = 1)。 */
export function attributeConversion(touches: Touch[], model: AttributionModel, opts: { halfLifeMs?: number; conversionAt?: number } = {}): Record<string, number> {
  const w = touchWeights(touches, model, opts);
  const out: Record<string, number> = {};
  touches.forEach((t, i) => { out[t.channel] = (out[t.channel] || 0) + w[i]; });
  return out;
}
