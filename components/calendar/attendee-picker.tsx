'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Contact, Loader2, Mail, Search, UserPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { shouldSearchCalendarAttendeesInline } from '@/lib/calendar/attendee-directory';

interface AttendeePickerProps {
  value: string[];
  onChange: (emails: string[]) => void;
  showLabel?: boolean;
}

interface AttendeeOption {
  id: string;
  name: string;
  email: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AttendeePicker({ value, onChange, showLabel = true }: AttendeePickerProps) {
  const selectedEmails = useMemo(() => normalizeEmails(value), [value]);
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const [draftEmails, setDraftEmails] = useState<string[]>(selectedEmails);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<AttendeeOption[]>([]);
  const [totalOptions, setTotalOptions] = useState(0);
  const [knownOptions, setKnownOptions] = useState<AttendeeOption[]>([]);
  const [inlineOptions, setInlineOptions] = useState<AttendeeOption[]>([]);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineFocused, setInlineFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraftEmails(selectedEmails);
    setSearch('');
    setError('');
  }, [open, selectedEmails]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('limit', '500');
        const keyword = search.trim();
        if (keyword) params.set('q', keyword);
        const res = await fetch(`/api/calendar/attendees${params.size ? `?${params}` : ''}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error?.message ?? data.error ?? '联系人加载失败');
        const users = Array.isArray(data.users) ? data.users : [];
        setOptions(users);
        setKnownOptions((current) => mergeOptions(current, users));
        setTotalOptions(typeof data.total === 'number' ? data.total : users.length);
      } catch (err) {
        if (controller.signal.aborted) return;
        setOptions([]);
        setTotalOptions(0);
        setError(err instanceof Error ? err.message : '联系人加载失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, search]);

  useEffect(() => {
    const keyword = inputValue.trim();
    if (!inlineFocused || !shouldSearchCalendarAttendeesInline(keyword)) {
      setInlineOptions([]);
      setInlineLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setInlineLoading(true);
      try {
        const params = new URLSearchParams({ limit: '8', q: keyword });
        const res = await fetch(`/api/calendar/attendees?${params}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error?.message ?? data.error ?? '联系人查询失败');
        const users = Array.isArray(data.users) ? data.users : [];
        setInlineOptions(users);
        setKnownOptions((current) => mergeOptions(current, users));
      } catch {
        if (!controller.signal.aborted) setInlineOptions([]);
      } finally {
        if (!controller.signal.aborted) setInlineLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [inlineFocused, inputValue]);

  const optionByEmail = useMemo(() => {
    const map = new Map<string, AttendeeOption>();
    knownOptions.forEach((option) => map.set(normalizeEmail(option.email), option));
    options.forEach((option) => map.set(normalizeEmail(option.email), option));
    inlineOptions.forEach((option) => map.set(normalizeEmail(option.email), option));
    return map;
  }, [inlineOptions, knownOptions, options]);

  const inlinePlaceholder = selectedEmails.length > 0 ? '继续添加成员邮箱' : '请输入成员名称或邮箱';
  const canAddInlineEmail = EMAIL_PATTERN.test(normalizeEmail(inputValue));
  const canAddSearchEmail = EMAIL_PATTERN.test(normalizeEmail(search));

  function applyEmails(next: string[]) {
    onChange(normalizeEmails(next));
  }

  function addInlineOption(option: AttendeeOption) {
    setKnownOptions((current) => mergeOptions(current, [option]));
    applyEmails([...selectedEmails, option.email]);
    setInputValue('');
    setInlineOptions([]);
  }

  function addInlineEmail() {
    const email = normalizeEmail(inputValue);
    if (!EMAIL_PATTERN.test(email)) return;
    applyEmails([...selectedEmails, email]);
    setInputValue('');
    setInlineOptions([]);
  }

  function removeEmail(email: string) {
    applyEmails(selectedEmails.filter((item) => item !== normalizeEmail(email)));
  }

  function toggleDraftEmail(email: string) {
    const normalized = normalizeEmail(email);
    setDraftEmails((current) => current.includes(normalized)
      ? current.filter((item) => item !== normalized)
      : [...current, normalized]);
  }

  function addSearchEmailToDraft() {
    const email = normalizeEmail(search);
    if (!EMAIL_PATTERN.test(email)) return;
    setDraftEmails((current) => normalizeEmails([...current, email]));
    setSearch('');
  }

  function confirmDraft() {
    applyEmails(draftEmails);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <div className={showLabel ? 'flex items-center gap-3' : 'block'}>
        {showLabel && <div className="w-10 shrink-0 text-body font-medium text-ink-primary">成员</div>}
        <div className="relative min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-brand-300/40">
          <div className="flex min-h-8 flex-wrap items-center gap-1.5">
            {selectedEmails.length > 0 && (
              <div className="contents">
                {selectedEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-[11px] text-brand-700 sm:max-w-[220px]"
                  >
                    <span className="truncate">{displayName(email, optionByEmail)}</span>
                    <button
                      type="button"
                      className="rounded-full hover:bg-brand-100"
                      onClick={() => removeEmail(email)}
                      aria-label={`移除 ${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onFocus={() => setInlineFocused(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  const firstOption = inlineOptions.find((option) => !selectedEmails.includes(normalizeEmail(option.email)));
                  if (firstOption) {
                    addInlineOption(firstOption);
                    return;
                  }
                  addInlineEmail();
                } else if (event.key === 'Escape') {
                  setInlineOptions([]);
                }
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  setInlineFocused(false);
                  setInlineOptions([]);
                  addInlineEmail();
                }, 120);
              }}
              placeholder={inlinePlaceholder}
              className="min-w-[150px] flex-[1_0_160px] border-0 bg-transparent px-1 text-caption outline-none placeholder:text-muted-foreground"
            />
            {inputValue.trim() && !canAddInlineEmail && (
              <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">输入姓名或邮箱查询</span>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 rounded text-brand-600 hover:bg-brand-50 hover:text-brand-700"
              onClick={() => setOpen(true)}
              aria-label="打开通讯录选择成员"
              title="打开通讯录"
            >
              <Contact className="h-4 w-4" />
            </Button>
          </div>
          {inlineFocused && shouldSearchCalendarAttendeesInline(inputValue) && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border bg-background shadow-soft-lg">
              {inlineLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-caption text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  正在查询人员...
                </div>
              ) : inlineOptions.length > 0 ? (
                <div className="max-h-56 overflow-y-auto p-1">
                  {inlineOptions.map((option) => {
                    const email = normalizeEmail(option.email);
                    const selected = selectedEmails.includes(email);
                    return (
                      <button
                        key={option.id || email}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
                          selected ? 'cursor-default bg-muted text-muted-foreground' : 'hover:bg-brand-50 hover:text-brand-700',
                        )}
                        disabled={selected}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => addInlineOption(option)}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-medium text-brand-700">
                          {initials(option.name || option.email)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-caption font-medium">{option.name || option.email}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{option.email}</span>
                        </span>
                        {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ) : canAddInlineEmail ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-caption text-brand-700 hover:bg-brand-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={addInlineEmail}
                >
                  <UserPlus className="h-4 w-4" />
                  添加外部联系人：{normalizeEmail(inputValue)}
                </button>
              ) : (
                <div className="px-3 py-2 text-caption text-muted-foreground">未找到匹配人员</div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedEmails.length > 0 && (
        <div className={cn('text-[11px] text-muted-foreground', showLabel && 'ml-[52px]')}>已选择 {selectedEmails.length} 人</div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[820px] gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>选择成员</DialogTitle>
          </DialogHeader>
          <div className="flex h-[620px] max-h-[82vh] flex-col">
            <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.1fr] overflow-hidden">
              <div className="flex min-w-0 flex-col overflow-hidden border-r bg-surface-2 p-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索"
                    className="h-11 rounded-lg border-0 bg-background pl-9 shadow-soft-sm focus-visible:ring-brand-300"
                  />
                </div>
                <div className="mt-5 flex items-center justify-between text-body">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    我的联系人
                  </div>
                  <span className="text-caption text-muted-foreground">{options.length < totalOptions ? `${options.length}/${totalOptions}` : totalOptions}</span>
                </div>

                <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable]">
                  <div className="space-y-1">
                    {loading && (
                      <div className="flex items-center justify-center gap-2 py-10 text-caption text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在加载联系人...
                      </div>
                    )}
                    {!loading && error && (
                      <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger">
                        {error}
                      </div>
                    )}
                    {!loading && !error && options.length === 0 && (
                      <div className="py-10 text-center text-caption text-muted-foreground">
                        暂无联系人
                      </div>
                    )}
                    {!loading && !error && options.map((option) => {
                      const email = normalizeEmail(option.email);
                      const selected = draftEmails.includes(email);
                      return (
                        <button
                          key={option.id || email}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                            selected ? 'bg-brand-50 text-brand-700' : 'hover:bg-background'
                          )}
                          onClick={() => toggleDraftEmail(email)}
                        >
                          <span className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-medium',
                            selected ? 'bg-brand-600 text-white' : 'bg-background text-ink-secondary'                          )}>
                            {initials(option.name || option.email)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-caption font-medium">{option.name || option.email}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{option.email}</span>
                          </span>
                          <span className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                            selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-background'                          )}>
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                    {!loading && !error && search.trim() && canAddSearchEmail && !draftEmails.includes(normalizeEmail(search)) && (
                      <button
                        type="button"
                        className="mt-2 flex w-full items-center gap-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/70 px-3 py-2.5 text-left text-brand-700 hover:bg-brand-50"
                        onClick={addSearchEmailToDraft}
                      >
                        <UserPlus className="h-4 w-4" />
                        <span className="min-w-0 flex-1 truncate text-caption">添加外部联系人：{normalizeEmail(search)}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-col overflow-hidden bg-background p-6">
                <div className="text-headline font-medium">
                  {draftEmails.length > 0 ? `已选择 ${draftEmails.length} 人` : '请选择联系人'}
                </div>
                <ScrollArea className="mt-5 min-h-0 flex-1 pr-2">
                  {draftEmails.length === 0 ? (
                    <div className="flex h-[420px] flex-col items-center justify-center text-center text-muted-foreground">
                      <Mail className="mb-3 h-10 w-10 text-ink-tertiary" />
                      <div className="text-caption">从左侧联系人列表选择成员</div>
                      <div className="mt-1 text-[11px]">也可以在搜索框输入完整邮箱添加外部联系人</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {draftEmails.map((email) => {
                        const option = optionByEmail.get(email);
                        return (
                          <div key={email} className="flex items-center gap-3 rounded-lg border bg-surface-2/70 px-3 py-2.5">                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-caption font-medium text-brand-700">
                              {initials(option?.name || email)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-caption font-medium">{option ? formatPerson(option.name, email) : email}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{email}</span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-danger"
                              onClick={() => toggleDraftEmail(email)}
                              aria-label={`移除 ${email}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            <div className="relative z-10 flex shrink-0 items-center justify-end gap-3 border-t bg-background px-8 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)]">
              <Button type="button" variant="outline" className="min-w-28" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="button" className="min-w-28 bg-brand-500 text-white hover:bg-brand-600" onClick={confirmDraft}>
                确定
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeEmail(email: string): string {
  return email.trim().replace(/,$/, '').toLowerCase();
}

function normalizeEmails(emails: string[]): string[] {
  return Array.from(new Set(emails.map(normalizeEmail).filter(Boolean)));
}

function mergeOptions(current: AttendeeOption[], incoming: AttendeeOption[]): AttendeeOption[] {
  const byEmail = new Map<string, AttendeeOption>();
  current.forEach((option) => byEmail.set(normalizeEmail(option.email), option));
  incoming.forEach((option) => byEmail.set(normalizeEmail(option.email), option));
  return Array.from(byEmail.values());
}

function displayName(email: string, optionByEmail: Map<string, AttendeeOption>): string {
  const option = optionByEmail.get(email);
  return option ? formatPerson(option.name, email) : email;
}

function formatPerson(name: string | undefined, email: string): string {
  const trimmedName = name?.trim();
  return trimmedName && trimmedName !== email ? `${trimmedName} (${email})` : email;
}

function initials(value: string): string {
  const text = value.trim();
  if (!text) return '?';
  const chinese = text.match(/[\u4e00-\u9fa5]/g);
  if (chinese?.length) return chinese.slice(-2).join('');
  return text.slice(0, 2).toUpperCase();
}
