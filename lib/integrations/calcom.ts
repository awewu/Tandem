/**
 * Cal.com 集成 · 日历 / 议事室排期
 *
 * Cal.com 是 AGPL 项目, V1 启用前需法务 review.
 *
 * 启用步骤:
 *   1. fork cal.com OR 用 cal.com SaaS API
 *   2. 配 CALCOM_API_KEY / CALCOM_BASE_URL
 *   3. 议事室触发排期 → Cal.com 创建 booking
 */

const CAL_BASE = process.env.CALCOM_BASE_URL ?? 'https://api.cal.com/v2';
const CAL_KEY = process.env.CALCOM_API_KEY ?? '';

export interface BookingDraft {
  title: string;
  participantEmails: string[];
  startAt: string;       // ISO
  durationMinutes: number;
  description?: string;
  /** 关联议事室 / 决议卡 */
  metadata?: { cardId?: string; type?: string };
}

export interface Booking {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  meetingUrl?: string;
  status: 'confirmed' | 'cancelled' | 'rescheduled';
}

async function calFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CAL_KEY}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Cal.com API ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function createBooking(draft: BookingDraft): Promise<Booking> {
  if (!CAL_KEY) {
    return {
      id: `stub_${Date.now()}`,
      title: draft.title,
      startAt: draft.startAt,
      endAt: new Date(new Date(draft.startAt).getTime() + draft.durationMinutes * 60_000).toISOString(),
      status: 'confirmed',
    };
  }
  return calFetch<Booking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(draft),
  });
}

export async function cancelBooking(id: string, reason?: string): Promise<void> {
  if (!CAL_KEY) return;
  await calFetch(`/bookings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function listBookings(params: {
  userId?: string;
  startAfter?: string;
  startBefore?: string;
}): Promise<Booking[]> {
  if (!CAL_KEY) return [];
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  const data = await calFetch<{ bookings: Booking[] }>(`/bookings?${qs}`);
  return data.bookings;
}
