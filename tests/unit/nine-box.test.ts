import { describe, it, expect } from 'vitest';
import { classifyNineBox } from '@/lib/types/okr-tti';

describe('classifyNineBox · CHARTER §4.1 thresholds', () => {
  it('high KPI + high TTI → star', () => {
    expect(classifyNineBox(0.95, 0.85)).toBe('star');
    expect(classifyNineBox(0.9, 0.7)).toBe('star');
  });

  it('high KPI + low TTI → risk_burnout (CHARTER 风险枯萎)', () => {
    expect(classifyNineBox(0.95, 0.3)).toBe('risk_burnout');
  });

  it('low KPI + high TTI → mismatch (人岗错位)', () => {
    expect(classifyNineBox(0.4, 0.85)).toBe('mismatch');
  });

  it('low KPI + low TTI → must_intervene (必须干预)', () => {
    expect(classifyNineBox(0.3, 0.2)).toBe('must_intervene');
  });

  it('boundary at 0.9 KPI / 0.7 TTI maps to high', () => {
    expect(classifyNineBox(0.9, 0.7)).toBe('star');
  });

  it('boundary at 0.7 KPI / 0.4 TTI maps to mid', () => {
    expect(classifyNineBox(0.7, 0.4)).toBe('core');
  });

  it('high KPI + mid TTI → high_performer', () => {
    expect(classifyNineBox(0.95, 0.5)).toBe('high_performer');
  });
});
