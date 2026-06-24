/**
 * haptic · 轻量触觉反馈 (原生 App 的"咔哒"确认感)
 *
 * 基于 navigator.vibrate. 注意平台差异:
 *   - Android Chrome / 多数安卓浏览器: 支持, 真实震动
 *   - iOS Safari: 不支持 navigator.vibrate (静默 no-op) —— iOS 真振动需原生壳, Web 暂无
 * 因此本工具是"能用则用"的渐进增强, 不支持的环境安全跳过, 不报错.
 *
 * 用法:
 *   import { haptic } from '@/lib/haptics';
 *   haptic('selection');  // 切 tab / 选项
 *   haptic('success');    // 提交日报 / 议事收敛成功
 *   haptic('warning');    // 撤回 / 删除确认
 */

export type HapticPattern =
  | 'selection' // 极轻, 切换/选择
  | 'light' // 轻, 普通点击
  | 'medium' // 中, 主动作触发
  | 'success' // 成功 (双段)
  | 'warning' // 警示
  | 'error'; // 失败 (多段)

const PATTERNS: Record<HapticPattern, number | number[]> = {
  selection: 8,
  light: 10,
  medium: 18,
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [30, 50, 30, 50, 30],
};

export function haptic(pattern: HapticPattern = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* 某些浏览器在非用户手势上下文会抛错, 忽略 */
  }
}
