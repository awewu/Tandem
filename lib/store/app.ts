/**
 * lib/store/app.ts · App theme / UI prefs (region 5)
 *
 * 从 lib/store.ts 机械拆分 (B8, 2026-05-31). 行为/persist key 不变.
 * persist key: 铁山-app-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// #region 5 · App (theme / UI prefs) ─────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system';

interface AppStore {
  darkMode: ThemeMode;
  setDarkMode: (m: ThemeMode) => void;
  apiBaseUrl: string;
  setApiBaseUrl: (u: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      darkMode: 'system',
      setDarkMode: (m) => set({ darkMode: m }),
      apiBaseUrl: process.env.NEXT_PUBLIC_HERMES_API_URL || 'http://localhost:8000',
      setApiBaseUrl: (u) => set({ apiBaseUrl: u }),
    }),
    { name: '铁山-app-store' }
  )
);
// #endregion
