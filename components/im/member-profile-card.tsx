'use client';

import { Building2, Mail, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ImProfileUser {
  id: string;
  name: string;
  email?: string;
  departmentId?: string | null;
  roles?: string[];
  title?: string;
  phone?: string;
}

const PALETTE = [
  'from-warning/30 to-warning',
  'from-success/30 to-success',
  'from-info/30 to-info',
  'from-brand-400 to-brand-500',
  'from-brand-300 to-danger',
];

function avatarColor(id: string) {
  return PALETTE[(id.codePointAt(0) ?? 0) % PALETTE.length];
}

export function imAvatarColor(id: string) {
  return avatarColor(id);
}

function toTelHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return normalized ? `tel:${normalized}` : undefined;
}

export function MemberProfileCard({
  user,
  departmentName,
  onClose,
  onStartDm,
}: {
  user: ImProfileUser;
  departmentName?: string;
  onClose: () => void;
  onStartDm: (id: string) => void;
}) {
  const color = avatarColor(user.id);
  const orgLabel = departmentName ?? user.departmentId;
  const telHref = user.phone ? toTelHref(user.phone) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-80 overflow-hidden rounded-2xl bg-surface-2 shadow-soft-xl" onClick={(e) => e.stopPropagation()}>
        <div className={`h-20 bg-gradient-to-br ${color}`} />
        <div className="relative -mt-10 px-5">
          <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br ${color} text-[22px] font-bold text-white shadow-soft`}>
            {user.name.slice(0, 1)}
          </div>
        </div>
        <div className="px-5 pb-5 pt-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="truncate text-[16px] font-semibold text-ink-primary">{user.name}</div>
              {user.title && <div className="mt-0.5 truncate text-[12px] text-ink-secondary">{user.title}</div>}
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-surface-3">
              <X className="h-4 w-4 text-ink-tertiary" />
            </button>
          </div>
          <div className="mt-3 space-y-2 border-t border-hairline pt-3">
            {user.phone && telHref && (
              <a href={telHref} className="flex items-center gap-2.5 text-[12.5px] text-ink-secondary">
                <Phone className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
                <span>{user.phone}</span>
              </a>
            )}
            {user.email && (
              <div className="flex items-center gap-2.5 text-[12.5px] text-ink-secondary">
                <Mail className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
                <span className="truncate">{user.email}</span>
              </div>
            )}
            {orgLabel && (
              <div className="flex items-center gap-2.5 text-[12.5px] text-ink-secondary">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
                <span className="truncate">{orgLabel}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" className="flex-1 rounded-lg text-[12.5px]" onClick={() => { onStartDm(user.id); onClose(); }}>
              发消息
            </Button>
            {user.email && (
              <Button size="sm" variant="outline" className="flex-1 rounded-lg text-[12.5px]" onClick={() => { window.location.href = `mailto:${user.email}`; }}>
                写邮件
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
