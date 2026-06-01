/**
 * 外部联系人智能档案 Store
 *
 * 从邮件、会议等渠道自动提取联系人信息并建立档案
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ContactProfile {
  id: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  tags?: string[];
  lastContactedAt?: number;
  notes?: string;
  // 智能提取的上下文
  knownFrom?: 'email' | 'meeting' | 'manual';
  interactionCount: number;
}

interface ContactStore {
  contacts: ContactProfile[];
  upsertContact: (email: string, patch: Partial<ContactProfile>) => ContactProfile;
  getContactByEmail: (email: string) => ContactProfile | undefined;
  incrementInteraction: (email: string) => void;
}

export const useContactStore = create<ContactStore>()(
  persist(
    (set, get) => ({
      contacts: [],

      upsertContact: (email, patch) => {
        const existing = get().contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          const updated = {
            ...existing,
            ...patch,
            interactionCount: patch.interactionCount ?? existing.interactionCount,
            lastContactedAt: Date.now(),
          };
          set((s) => ({
            contacts: s.contacts.map((c) => (c.id === existing.id ? updated : c)),
          }));
          return updated;
        }
        const created: ContactProfile = {
          id: crypto.randomUUID(),
          email,
          name: patch.name || email.split('@')[0],
          interactionCount: 1,
          lastContactedAt: Date.now(),
          knownFrom: patch.knownFrom || 'manual',
          ...patch,
        };
        set((s) => ({ contacts: [...s.contacts, created] }));
        return created;
      },

      getContactByEmail: (email) => {
        return get().contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());
      },

      incrementInteraction: (email) => {
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.email.toLowerCase() === email.toLowerCase()
              ? { ...c, interactionCount: c.interactionCount + 1, lastContactedAt: Date.now() }
              : c
          ),
        }));
      },
    }),
    {
      name: 'tandem-contact-store',
      version: 1,
    }
  )
);
