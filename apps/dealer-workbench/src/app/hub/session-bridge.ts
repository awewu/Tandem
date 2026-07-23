export type HubMe = {
  role?: string;
  name?: string;
  userId?: string;
};

export type HubSessionDecision =
  | {
      status: 'authenticated';
      role: string | null;
      name: string;
    }
  | {
      status: 'redirect';
      location: string;
      reason: 'missing_session';
    };

export function hubLoginFallback(returnUrl = '/brand', reason: 'missing_session' = 'missing_session'): string {
  const safeReturnUrl = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/brand';
  return `/?returnUrl=${encodeURIComponent(safeReturnUrl)}&ssoError=${encodeURIComponent(reason)}`;
}

export function cachedUserName(cachedUserJson: string | null | undefined): string {
  if (!cachedUserJson) return '';
  try {
    const parsed = JSON.parse(cachedUserJson) as { name?: unknown };
    return typeof parsed.name === 'string' ? parsed.name : '';
  } catch {
    return '';
  }
}

export async function resolveHubSession(
  fetchMe: () => Promise<HubMe>,
  cachedUserJson?: string | null,
): Promise<HubSessionDecision> {
  try {
    const me = await fetchMe();
    return {
      status: 'authenticated',
      role: me.role || null,
      name: cachedUserName(cachedUserJson) || me.name || '',
    };
  } catch {
    return {
      status: 'redirect',
      location: hubLoginFallback('/brand', 'missing_session'),
      reason: 'missing_session',
    };
  }
}
