/** Date helpers (Italian locale). */

export function nowIso(): string {
  return new Date().toISOString();
}

/** Returns the greeting for the given hour: Buongiorno / Buon pomeriggio / Buonasera. */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 13) return 'Buongiorno';
  if (hour >= 13 && hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/** Local calendar day key "YYYY-MM-DD" for an ISO timestamp. */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Number of consecutive days with reading activity, ending today or yesterday
 * (a streak is not lost until the end of the current day).
 */
export function computeStreak(activityDates: readonly Date[], today: Date = new Date()): number {
  const days = new Set(activityDates.map(toDayKey));
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(toDayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** "3 h 25 min", "12 min", "< 1 min" */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 1) return totalSeconds > 0 ? '< 1 min' : '0 min';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Human friendly relative date: "oggi", "ieri", "3 giorni fa", "12 mar 2026". */
export function formatRelativeDate(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Mai';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays <= 0) return 'Oggi';
  if (diffDays === 1) return 'Ieri';
  if (diffDays < 7) return `${diffDays} giorni fa`;
  return formatDate(iso);
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
