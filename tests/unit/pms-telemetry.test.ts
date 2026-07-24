import { describe, it, expect } from 'vitest';
import { evaluateTelemetryAlerts } from '@/lib/pms/telemetry-service';

describe('PMS telemetry · evaluateTelemetryAlerts', () => {
  const thresholds = {
    temperature: { max: 80 },
    pressure: { min: 10, max: 100 },
    voltage: { min: 220 },
  };

  it('超上限 → above_max', () => {
    const alerts = evaluateTelemetryAlerts({ temperature: 95 }, thresholds);
    expect(alerts).toEqual([{ metric: 'temperature', value: 95, type: 'above_max', threshold: 80 }]);
  });

  it('低于下限 → below_min', () => {
    const alerts = evaluateTelemetryAlerts({ voltage: 200 }, thresholds);
    expect(alerts).toEqual([{ metric: 'voltage', value: 200, type: 'below_min', threshold: 220 }]);
  });

  it('区间内 → 无告警', () => {
    expect(evaluateTelemetryAlerts({ pressure: 50, temperature: 70, voltage: 230 }, thresholds)).toEqual([]);
  });

  it('多指标越界 → 多告警', () => {
    const alerts = evaluateTelemetryAlerts({ temperature: 90, pressure: 5 }, thresholds);
    expect(alerts).toHaveLength(2);
  });

  it('忽略非数值/缺失指标', () => {
    // @ts-expect-error 测试非法值
    expect(evaluateTelemetryAlerts({ temperature: 'hot' }, thresholds)).toEqual([]);
    expect(evaluateTelemetryAlerts({}, thresholds)).toEqual([]);
  });
});
