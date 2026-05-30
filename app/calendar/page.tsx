/**
 * /calendar — 旧 demo CRUD 已废弃 (95 行 hardcoded `demo-user`, 0 AI, 与 §CHARTER-FOUR-PILLARS 矛盾).
 *
 * 主入口现在统一指向 /okr/calendar (KR 截止 + 议事 + 1on1 + cycle 时间线一体化).
 *
 * 这是 charter §五 CAL-1 "OKR 时间线一体化" 的兑现:
 *   - 飞书日历 ↔ OKR 是两个独立产品
 *   - Tandem 拒绝独立日历 — 所有事件必须挂 KR 锚点
 *
 * 未来 (CAL-2 ~ CAL-7) 在 /okr/calendar 内迭代:
 *   AI 议事时间建议 / Persona 代约 / 会议自动准备 / 会议自动复盘 / 空闲保护 / KR 偏差自动插议事
 */

import { redirect } from 'next/navigation';

export default function CalendarRedirect(): never {
  redirect('/okr/calendar');
}
