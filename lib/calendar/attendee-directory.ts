export interface CalendarAttendeeSearchUser {
  id: string;
  email: string;
  name?: string | null;
  disabled?: boolean | null;
  departmentName?: string | null;
  jobTitle?: string | null;
  employeeId?: string | null;
}

export function matchesCalendarAttendeeQuery(user: CalendarAttendeeSearchUser, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const compactQuery = compactSearchText(query);
  const fields = [
    user.name,
    user.email,
    user.email?.split('@')[0],
    user.departmentName,
    user.jobTitle,
    user.employeeId,
  ];
  return fields.some((field) => {
    const normalizedField = normalizeSearchText(field);
    return normalizedField.includes(normalizedQuery) || compactSearchText(field).includes(compactQuery);
  });
}

export function shouldSearchCalendarAttendeesInline(query: string): boolean {
  const value = query.trim();
  if (!value) return false;
  return value.length >= 2 || /[^\x00-\x7F]/.test(value);
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function compactSearchText(value: string | null | undefined): string {
  return normalizeSearchText(value).replace(/\s+/g, '');
}
