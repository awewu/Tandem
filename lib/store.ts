/**
 * lib/store.ts · 客户端 Zustand 全局状态层 (UI Layer Only) — Barrel
 *
 * 架构定位
 * ─────────────────────────────────────────────────────────────
 * 本文件 = **UI / 浏览器内** 的 zustand persist store 的统一出口 (barrel).
 * 2026-05-31 (B8) 起按 region 拆到 lib/store/<name>.ts, 此处仅 re-export 保持
 * `import { useXStore } from '@/lib/store'` 向后兼容 (38 个 importer 不变).
 * persist key 完全不变 (铁山-chat/agent/task/knowledge/okr/app-store).
 *
 * 关键 cross-reference
 * ─────────────────────────────────────────────────────────────
 *   OKR 域:      ↔ lib/types/okr-tti.ts (服务端版, 含 TTI / 9-Box)
 *   Memory 域:   ↔ lib/types/memory.ts (服务端版, 4 层 ownershipLevel)
 *   1on1 域:     ↔ lib/types/one-on-one.ts (服务端版)
 *   Review360:   ↔ lib/types/review-360.ts (服务端版)
 *   Org 域:      ↔ lib/types/org.ts (服务端版, 多租户)
 *
 * 8 个 Store 域 (拆分到 lib/store/):
 *   1. chat.ts        Chat / Agent / Task + PROVIDER_PRESETS / PRESET_AGENTS
 *   2. knowledge.ts   KNode 知识库节点
 *   3. org.ts         三省六部 Org/Gov (UI fixture + 后端 hydrate)
 *   4. okr.ts         Cycle / Objective / KR / CheckIn / Initiative ...
 *   5. app.ts         ThemeMode (UI 偏好)
 *   6. memory-ui.ts   UI 简化版 Memory (不参与签批治理)
 *   7. one-on-one.ts  1on1 会议 + Action items
 *   8. review-360.ts  360 review cycles / submissions
 *
 * @see docs/STORE-SLICE-PLAN-2026-05-31.md
 */

export * from './store/chat';
export * from './store/knowledge';
export * from './store/org';
export * from './store/okr';
export * from './store/app';
export * from './store/memory-ui';
export * from './store/one-on-one';
export * from './store/review-360';
