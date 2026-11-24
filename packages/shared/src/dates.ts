/*
 * Dates are stored as plain "YYYY-MM-DD" strings (no time, no timezone) so a due
 * date or payment date never shifts by a day for users in different zones.
 */

/** Today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayISO(timezone = 'UTC', now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "2026-11-24" → "2026-11" */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** "2026-01" → "2025-12" */
export function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Whole days from a to b (both YYYY-MM-DD or ISO timestamps). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10));
  return Math.round(ms / 86_400_000);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing the given date (YYYY-MM-DD). */
export function weekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return addDays(isoDate, -dow);
}

/** "2026-11-24" → "Tuesday, November 24" */
export function formatLongDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "2026-11-24" → "Nov 24" (adds year if not current year) */
export function formatShortDate(isoDate: string, currentYear?: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const sameYear = currentYear == null || d.getUTCFullYear() === currentYear;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}
