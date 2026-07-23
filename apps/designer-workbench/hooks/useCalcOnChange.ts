import { useEffect, useRef } from 'react';

export interface CalcInput {
  projectId: string;
  area?: number;
  city?: string;
  buildingType?: string;
  systems?: string[];
  floorPlan?: any;
  hvac?: any;
  devices?: any[];
}

export interface CalcOnChangeOptions {
  delayMs?: number;
  onResult?: (result: any) => void;
  onError?: (error: any) => void;
}

/**
 * 3.6 · 边画边算：监听设计数据变化，防抖后调用精算引擎。
 *
 * 后端已发布 `design.changed` 事件，触发 quote 重算与 stale 标记。
 * 前端钩子负责把最新户型/系统/设备快照推送到 `/api/design/calc`。
 */
export default function useCalcOnChange(input: CalcInput, options: CalcOnChangeOptions = {}) {
  const { delayMs = 1500, onResult, onError } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHashRef = useRef<string>('');

  useEffect(() => {
    const payload = JSON.stringify(input);
    const hash = btoa(unescape(encodeURIComponent(payload))).slice(0, 16);
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/v2/design/calc', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area: input.area ?? 100,
            city: input.city ?? '上海',
            buildingType: input.buildingType ?? 'residential',
            systems: input.systems ?? ['freshAir', 'heating'],
            projectId: input.projectId,
            floorPlan: input.floorPlan,
            hvac: input.hvac,
            devices: input.devices,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        onResult?.(result);
      } catch (err) {
        onError?.(err);
      }
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [input, delayMs, onResult, onError]);
}
