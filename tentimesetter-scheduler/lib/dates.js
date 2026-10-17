// All dates in the app are plain "YYYY-MM-DD" strings handled at UTC-noon,
// so charts never shift a day because of timezones.

export const DAY_MS = 86400000;

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function addDays(date, n) {
  return new Date(date.getTime() + n * DAY_MS);
}

/** Whole days from a -> b (positive when b is after a). */
export function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Today's date in the viewer's local timezone, as YYYY-MM-DD. */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime());
}

export function formatDateShort(iso) {
  return parseDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
