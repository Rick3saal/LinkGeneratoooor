/**
 * Timezone helpers built on `Intl` only — no runtime dependency, and DST-correct
 * for any historical/future date because it uses the host's IANA database.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` at the given instant, in milliseconds (east positive). */
export function zoneOffsetMs(timeZone: string, instant: number): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - instant;
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC epoch (ms).
 * Handles DST by solving the offset twice (the standard "guess and fix" trick).
 */
export function wallClockToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const first = zoneOffsetMs(timeZone, guess);
  let instant = guess - first;
  const second = zoneOffsetMs(timeZone, instant);
  if (second !== first) instant = guess - second;
  return instant;
}

/** Local wall-clock components of an instant in a given zone. */
export function utcToWallClock(
  timeZone: string,
  instant: number,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

export function pad2(n: number): string {
  return String(Math.abs(n)).padStart(2, '0');
}

/** ISO date (yyyy-mm-dd) from parts. */
export function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** `HH:mm` from parts. */
export function hhmm(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parseHhmm(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Convert a local date + time at an airport to a UTC epoch in milliseconds.
 * Returns NaN when the input cannot be interpreted.
 */
export function localToUtcMs(
  timeZone: string,
  date: string,
  time: string,
  dayOffset = 0,
): number {
  const d = parseIsoDate(date);
  const t = parseHhmm(time);
  if (!d || !t) return NaN;
  const base = Date.UTC(d.year, d.month - 1, d.day + dayOffset, t.hour, t.minute, 0, 0);
  const shifted = new Date(base);
  return wallClockToUtc(
    timeZone,
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    t.hour,
    t.minute,
  );
}

/**
 * Pick the travel year for a bare `DDMMM` token: the next occurrence of that
 * date, allowing a one-day grace so a "today" departure does not jump a year.
 */
export function inferYear(
  month: number,
  day: number,
  now: Date = new Date(),
  graceDays = 1,
): number {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const candidate = Date.UTC(now.getUTCFullYear(), month - 1, day);
  if (candidate < todayUtc - graceDays * 86_400_000) return now.getUTCFullYear() + 1;
  return now.getUTCFullYear();
}

/** Add days to an ISO date without timezone drift. */
export function addDaysIso(date: string, days: number): string {
  const d = parseIsoDate(date);
  if (!d) return date;
  const shifted = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return isoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Whole-day difference between two ISO dates (b - a). */
export function daysBetweenIso(a: string, b: string): number {
  const da = parseIsoDate(a);
  const db = parseIsoDate(b);
  if (!da || !db) return 0;
  const ta = Date.UTC(da.year, da.month - 1, da.day);
  const tb = Date.UTC(db.year, db.month - 1, db.day);
  return Math.round((tb - ta) / 86_400_000);
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatShortDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return `${String(d.day).padStart(2, '0')} ${MONTH_LABELS[d.month - 1]}`;
}

export function formatLongDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return `${String(d.day).padStart(2, '0')} ${MONTH_LABELS[d.month - 1]} ${d.year}`;
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${pad2(m)}m`;
}

/** Compact offset label such as `UTC+5:30` or `UTC−5`. */
export function formatTimezoneLabel(timeZone: string, instant: number): string {
  const offsetMinutes = zoneOffsetMs(timeZone, instant) / 60_000;
  const sign = offsetMinutes >= 0 ? '+' : '−';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}
