import { cabinForClass } from './classes';
import { operatingCarrierCode } from './carriers';
import { inferYear, isoDate } from './time';
import type { Cabin, Issue, Segment } from './types';

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** Tokens that look like airport codes but never are. */
const NOT_AIRPORTS = new Set([
  'THE', 'AND', 'FOR', 'SSR', 'ALL', 'ANY', 'NEW', 'CAB', 'ADT', 'CNN', 'INF',
  'USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED', 'DAY', 'NON', 'STP',
]);

export interface DateToken {
  year?: number;
  month: number;
  day: number;
  raw: string;
}

export interface TimeToken {
  hour: number;
  minute: number;
  dayOffset: number;
  raw: string;
}

export interface ParseOptions {
  now?: Date;
  /** Force a travel year instead of inferring it from today. */
  yearOverride?: number | null;
}

export interface ParseStats {
  lines: number;
  segments: number;
  additionalEntries: number;
  skipped: number;
}

export interface ParseResult {
  segments: Segment[];
  issues: Issue[];
  stats: ParseStats;
  /** Segments as they appeared in the "additional" block, keyed by line number. */
  additional: AdditionalEntry[];
}

export interface AdditionalEntry {
  line: number;
  carrier: string;
  flightNumber: string;
  bookingClass: string;
  date: string;
  raw: string;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `sg_${seq.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeSegment(partial: Partial<Segment> = {}): Segment {
  return {
    id: nextId(),
    carrier: '',
    flightNumber: '',
    bookingClass: '',
    cabin: 'ECONOMY',
    origin: '',
    destination: '',
    depDate: '',
    depTime: '',
    arrTime: '',
    arrDayOffset: 0,
    newSliceOverride: null,
    ...partial,
  };
}

/* ------------------------------------------------------------------ */
/* Token level parsing                                                 */
/* ------------------------------------------------------------------ */

export function parseDateToken(token: string): DateToken | null {
  const clean = token.replace(/[.,;]+$/, '');
  let m = /^(\d{1,2})([A-Z]{3})(\d{2}|\d{4})?$/i.exec(clean);
  if (m) {
    const month = MONTHS[m[2].toUpperCase()];
    if (!month) return null;
    const day = Number(m[1]);
    if (day < 1 || day > 31) return null;
    let year: number | undefined;
    if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return { year, month, day, raw: token };
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (m) {
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year: Number(m[1]), month, day, raw: token };
  }
  return null;
}

/**
 * Understands `1010A`, `745P`, `820A`, `12A`, `1900`, `19:00`, `630A+1`,
 * `850A1` (the stray-character variant GDS pastes sometimes produce).
 */
export function parseTimeToken(token: string): TimeToken | null {
  const clean = token.replace(/[,;]+$/, '');

  let m = /^(\d{3,4})([AP])(?:\+?(\d))?$/i.exec(clean);
  if (m) {
    const digits = m[1];
    const minute = Number(digits.slice(-2));
    let hour = Number(digits.slice(0, -2));
    const mer = m[2].toUpperCase();
    if (minute > 59 || hour > 12 || hour < 1) return null;
    if (mer === 'P' && hour < 12) hour += 12;
    if (mer === 'A' && hour === 12) hour = 0;
    return { hour, minute, dayOffset: m[3] ? Number(m[3]) : 0, raw: token };
  }

  m = /^(\d{1,2}):(\d{2})([AP])?(?:\+?(\d))?$/i.exec(clean);
  if (m) {
    let hour = Number(m[1]);
    const minute = Number(m[2]);
    const mer = m[3]?.toUpperCase();
    if (minute > 59 || hour > 23 || hour < 0) return null;
    if (mer === 'P' && hour < 12) hour += 12;
    if (mer === 'A' && hour === 12) hour = 0;
    return { hour, minute, dayOffset: m[4] ? Number(m[4]) : 0, raw: token };
  }

  m = /^(\d{1,2})([AP])(?:\+?(\d))?$/i.exec(clean);
  if (m) {
    let hour = Number(m[1]);
    const mer = m[2].toUpperCase();
    if (hour > 12 || hour < 1) return null;
    if (mer === 'P' && hour < 12) hour += 12;
    if (mer === 'A' && hour === 12) hour = 0;
    return { hour, minute: 0, dayOffset: m[3] ? Number(m[3]) : 0, raw: token };
  }

  // Bare 24h clock: four digits, optionally with an explicit +N day marker.
  m = /^(\d{2})(\d{2})(?:\+(\d))?$/.exec(clean);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute, dayOffset: m[3] ? Number(m[3]) : 0, raw: token };
  }

  return null;
}

function isAirportToken(token: string): boolean {
  return /^[A-Z]{3}$/.test(token) && !MONTHS[token] && !NOT_AIRPORTS.has(token);
}

export function cleanLineForTokens(raw: string): string[] {
  let s = raw.replace(/\u00a0/g, ' ');
  // Stray characters seen in GDS pastes (e.g. "850A¥1" for "+1").
  s = s.replace(/[¥¤†‡°•]/g, '');
  // Drop parenthetical annotations such as (S) or (1).
  s = s.replace(/\([^)]*\)/g, ' ');
  // Sabre sell counters: *SS2 / SS2.
  s = s.replace(/\*SS\d+/gi, ' ');
  s = s.replace(/(^|\s)SS\d+(?=\s|$)/gi, ' ');
  // Slash codes: /DCAA, /E, /-.
  s = s.replace(/(^|\s)\/[A-Z0-9-]*(?=\s|$)/gi, ' ');
  // Trailing asterisks.
  s = s.replace(/\*/g, ' ');
  return s.trim().split(/\s+/).filter(Boolean);
}

interface CarrierHit {
  carrier: string;
  flightNumber: string;
  gluedClass: string;
  at: number;
}

function findCarrier(tokens: string[], before: number): CarrierHit | null {
  for (let i = 0; i < before; i += 1) {
    const t = tokens[i];
    const glued = /^([A-Z0-9]{2})(\d{1,4})([A-Z])?$/.exec(t);
    if (glued) {
      return { carrier: glued[1], flightNumber: glued[2], gluedClass: glued[3] ?? '', at: i };
    }
    if (/^[A-Z0-9]{2}$/.test(t) && i + 1 < before) {
      const next = /^(\d{1,4})([A-Z])?$/.exec(tokens[i + 1]);
      if (next) {
        return {
          carrier: t,
          flightNumber: next[1],
          gluedClass: next[2] ?? '',
          at: i,
        };
      }
    }
  }
  return null;
}

function parseCabinWord(token: string): Cabin | null {
  const m = /^(?:CABIN[-_ ]?)?(FIRST|BUSINESS|ECONOMY|PREMIUM(?:\s*ECONOMY)?)$/i.exec(token);
  if (!m) return null;
  const word = m[1].toUpperCase();
  if (word.startsWith('FIRST')) return 'FIRST';
  if (word.startsWith('BUSINESS')) return 'BUSINESS';
  if (word.startsWith('PREMIUM')) return 'PREMIUM';
  if (word.startsWith('ECONOMY')) return 'ECONOMY';
  return null;
}

interface ParsedLine {
  segment: Segment;
  explicitBreak: boolean;
}

/**
 * Parse one itinerary line. Handles the common GDS/availability shapes:
 *
 *   1 AA 142 10NOV JFK LHR 1010A 1010P 777 7.00 0 N  CABIN-BUSINESS
 *   1 AA 142I 10NOV JFK LHR 1010A 1010P
 *   1 AA 763I 31DEC Q MUCCLT*SS2 1020A 245P /DCAA /E
 *   AA 100 J 01DEC JFK LHR 1900 0700+1
 */
export function parseSegmentLine(
  raw: string,
  opts: ParseOptions = {},
): ParsedLine | null {
  let line = raw.trim();
  if (!line) return null;

  let lineNumber: number | null = null;
  const idxMatch = /^(\d{1,2})[.)]?\s+(?=\S)/.exec(line);
  if (idxMatch) {
    lineNumber = Number(idxMatch[1]);
    line = line.slice(idxMatch[0].length);
  }

  let explicitBreak = false;
  if (/^[-=]{3,}$/.test(line) || /new\s+(dir|direction|slice)/i.test(line)) {
    explicitBreak = true;
    line = line.replace(/new\s+(dir|direction|slice)/gi, '');
    if (!line.replace(/[-=\s]/g, '')) return null;
  }

  const tokens = cleanLineForTokens(line);
  if (tokens.length < 3) return null;

  // 1. date
  let dateIdx = -1;
  let date: DateToken | null = null;
  for (let i = 0; i < tokens.length; i += 1) {
    const parsed = parseDateToken(tokens[i]);
    if (parsed) {
      dateIdx = i;
      date = parsed;
      break;
    }
  }
  if (!date || dateIdx < 0) return null;

  // 2. carrier + flight number before the date
  const carrierHit = findCarrier(tokens, dateIdx);
  if (!carrierHit) return null;

  // 3. booking class: glued to flight number > just before the date > just after
  let bookingClass = carrierHit.gluedClass;
  let classConflict: string | null = null;

  const beforeDate = tokens[dateIdx - 1];
  if (beforeDate && /^[A-Z]$/.test(beforeDate) && dateIdx - 1 > carrierHit.at) {
    if (bookingClass && bookingClass !== beforeDate) classConflict = beforeDate;
    else if (!bookingClass) bookingClass = beforeDate;
  }

  let cursor = dateIdx + 1;
  if (tokens[cursor] && /^[A-Z]$/.test(tokens[cursor])) {
    const after = tokens[cursor];
    if (bookingClass && bookingClass !== after) classConflict = classConflict ?? after;
    else if (!bookingClass) bookingClass = after;
    cursor += 1;
  }

  // 4. origin / destination
  let origin = '';
  let destination = '';
  let pairEnd = cursor;
  for (let i = cursor; i < tokens.length; i += 1) {
    const t = tokens[i];
    const gluedPair = /^([A-Z]{3})([A-Z]{3})$/.exec(t);
    if (gluedPair && isAirportToken(gluedPair[1]) && isAirportToken(gluedPair[2])) {
      origin = gluedPair[1];
      destination = gluedPair[2];
      pairEnd = i + 1;
      break;
    }
    const dashed = /^([A-Z]{3})-([A-Z]{3})$/.exec(t);
    if (dashed && isAirportToken(dashed[1]) && isAirportToken(dashed[2])) {
      origin = dashed[1];
      destination = dashed[2];
      pairEnd = i + 1;
      break;
    }
    if (isAirportToken(t) && tokens[i + 1] && isAirportToken(tokens[i + 1])) {
      origin = t;
      destination = tokens[i + 1];
      pairEnd = i + 2;
      break;
    }
  }

  // 5. times after the city pair
  let dep: TimeToken | null = null;
  let arr: TimeToken | null = null;
  let arrDateToken: DateToken | null = null;
  for (let i = pairEnd; i < tokens.length; i += 1) {
    const time = parseTimeToken(tokens[i]);
    if (time) {
      if (!dep) dep = time;
      else if (!arr) {
        arr = time;
        cursor = i + 1;
        break;
      }
    }
  }
  if (arr) {
    for (let i = cursor; i < tokens.length; i += 1) {
      const d = parseDateToken(tokens[i]);
      if (d) {
        arrDateToken = d;
        break;
      }
    }
  }

  // 6. cabin word anywhere in the line
  let cabin: Cabin | null = null;
  for (const t of tokens) {
    const c = parseCabinWord(t);
    if (c) {
      cabin = c;
      break;
    }
  }

  const derivedCabin = cabin ?? cabinForClass(bookingClass) ?? 'ECONOMY';

  // 7. arrival day offset
  let arrDayOffset = arr?.dayOffset ?? 0;
  if (arrDateToken && date) {
    const depYear = date.year ?? opts.yearOverride ?? inferYear(date.month, date.day, opts.now);
    const arrYear = arrDateToken.year ?? depYear;
    const depUtc = Date.UTC(depYear, date.month - 1, date.day);
    const arrUtc = Date.UTC(arrYear, arrDateToken.month - 1, arrDateToken.day);
    const diff = Math.round((arrUtc - depUtc) / 86_400_000);
    if (diff >= 0 && diff < 4) arrDayOffset = diff;
  }

  const year = date.year ?? opts.yearOverride ?? inferYear(date.month, date.day, opts.now);
  const yearInferred = !date.year && opts.yearOverride == null;
  const segment = makeSegment({
    carrier: carrierHit.carrier,
    flightNumber: carrierHit.flightNumber,
    bookingClass,
    cabin: derivedCabin,
    origin,
    destination,
    depDate: isoDate(year, date.month, date.day),
    yearInferred,
    depTime: dep ? `${String(dep.hour).padStart(2, '0')}:${String(dep.minute).padStart(2, '0')}` : '',
    arrTime: arr ? `${String(arr.hour).padStart(2, '0')}:${String(arr.minute).padStart(2, '0')}` : '',
    arrDayOffset,
    raw,
    classConflict: classConflict ?? undefined,
  });

  if (lineNumber !== null) {
    segment.lineNumber = lineNumber;
  }

  return { segment, explicitBreak };
}

/* ------------------------------------------------------------------ */
/* Operating carrier ("OPERATED BY …")                                  */
/* ------------------------------------------------------------------ */

export interface OperatedBy {
  /** Free-text operating carrier as written in the source, e.g. "BRITISH AIRWAYS". */
  name: string;
  /** Two-letter operating carrier code when it could be resolved, e.g. "BA". */
  code?: string;
  /** The operating carrier's own flight number, when the note carried one. */
  flight?: string;
}

/**
 * Reads an operating-carrier footnote into a code.
 *
 * Understands the shapes a GDS actually writes, including the ones that used
 * to slip straight through:
 *
 *   *LHR-JFK OPERATED BY BRITISH AIRWAYS
 *   *JFK-LHR OPERATED BY /BA CABIN-BUSINESS
 *   *LHR-JFK OPERATED BY BA 178
 *   OPERATED BY: BRITISH AIRWAYS.
 *   *OP BY BRITISH AIRWAYS
 */
export function parseOperatedByLine(line: string): OperatedBy | null {
  const match = /(?:operated|op)\s*by\s*:?\s*(.+)$/i.exec(line.replace(/^[*\s]+/, '').trim());
  if (!match) return null;

  let value = match[1]
    .trim()
    // Drop whatever follows the cabin note: "… /BA CABIN-BUSINESS".
    .replace(/\bcabin\b[\s\S]*$/i, '')
    .replace(/[.,;:]+$/, '')
    .trim();
  if (!value) return null;

  // "/BA 178" → carrier BA, flight 178.
  const withFlight = /^\/?\*?([A-Z0-9]{2})\s+(\d{1,4})$/i.exec(value);
  let flight: string | undefined;
  if (withFlight) {
    value = withFlight[1];
    flight = withFlight[2];
  }

  // The slash form the GDS writes: "/BA", "*BA", "-BA".
  value = value.replace(/^[/\\*.\-]+/, '').trim();
  if (!value) return null;

  return { name: value.toUpperCase(), code: operatingCarrierCode(value), flight };
}

/** Attach an operating-carrier footnote to the segment it belongs to. */
export function applyOperatedBy(segment: Segment, op: OperatedBy): void {
  segment.operatedBy = op.name;
  if (op.code) segment.operatingCarrier = op.code;
  if (op.flight) segment.operatingFlight = op.flight;
}

/** True when the line carries a date token, i.e. it looks like a flight row. */
function hasDateToken(line: string): boolean {
  return cleanLineForTokens(line).some((token) => parseDateToken(token) !== null);
}

/* ------------------------------------------------------------------ */
/* Additional block                                                    */
/* ------------------------------------------------------------------ */

const ADDITIONAL_MARKER = /^[<\-\s]*additional[>\-\s:]*$/i;

export function parseAdditionalLine(raw: string, opts: ParseOptions = {}): AdditionalEntry | null {
  const line = raw.trim().replace(/^(\d{1,2})[.)]?\s+/, (m) => m);
  const m = /^(\d{1,2})[.)]?\s+([A-Z0-9]{2})\s*(\d{1,4})\s*([A-Z])?\s+(\d{1,2}[A-Z]{3}\d{0,4})\b/i.exec(
    line,
  );
  if (!m) return null;
  const dateTok = parseDateToken(m[5]);
  if (!dateTok) return null;
  const year = dateTok.year ?? opts.yearOverride ?? inferYear(dateTok.month, dateTok.day, opts.now);
  return {
    line: Number(m[1]),
    carrier: m[2].toUpperCase(),
    flightNumber: m[3],
    bookingClass: (m[4] ?? '').toUpperCase(),
    date: isoDate(year, dateTok.month, dateTok.day),
    raw,
  };
}

/* ------------------------------------------------------------------ */
/* Whole document                                                      */
/* ------------------------------------------------------------------ */

export function parseItinerary(text: string, opts: ParseOptions = {}): ParseResult {
  const issues: Issue[] = [];
  const segments: Segment[] = [];
  const additional: AdditionalEntry[] = [];
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');

  let mode: 'main' | 'additional' = 'main';
  let pendingBreak = false;
  let skipped = 0;

  rawLines.forEach((rawLine) => {
    // Pastes from mail/chat often carry HTML entities around the section marker.
    const line = rawLine
      .trim()
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&');
    if (!line) return;

    if (ADDITIONAL_MARKER.test(line)) {
      mode = 'additional';
      return;
    }

    if (/^(additional|add-?on)\b/i.test(line)) {
      mode = 'additional';
      return;
    }

    let inlineOperatedBy: OperatedBy | null = null;

    // Operating-carrier footnote, e.g. "*JFK-LHR OPERATED BY /BA CABIN-BUSINESS".
    if (line.startsWith('*')) {
      const op = parseOperatedByLine(line);
      if (op && segments.length) applyOperatedBy(segments[segments.length - 1], op);
      return;
    }

    // Same note without its leading asterisk (mailed/chatted pastes lose it):
    // it belongs to the previous segment unless the line is a flight row too.
    if (/operated\s+by/i.test(line)) {
      const op = parseOperatedByLine(line);
      if (op) {
        if (!hasDateToken(line)) {
          if (segments.length) applyOperatedBy(segments[segments.length - 1], op);
          return;
        }
        inlineOperatedBy = op;
      }
    }

    if (/^(\/\/|#|--\s)/.test(line) && !parseDateToken(line)) {
      if (/new\s+(dir|direction|slice)/i.test(line)) pendingBreak = true;
      return;
    }

    if (/^[-=]{3,}$/.test(line)) {
      pendingBreak = true;
      return;
    }

    if (mode === 'additional') {
      const entry = parseAdditionalLine(line, opts);
      if (entry) additional.push(entry);
      else skipped += 1;
      return;
    }

    const parsed = parseSegmentLine(line, opts);
    if (!parsed) {
      skipped += 1;
      issues.push({
        level: 'info',
        code: 'line-skipped',
        message: 'Skipped a line that does not look like a flight segment.',
        detail: line.slice(0, 120),
      });
      return;
    }
    if (pendingBreak) {
      parsed.segment.newSliceOverride = true;
      pendingBreak = false;
    }
    if (inlineOperatedBy) applyOperatedBy(parsed.segment, inlineOperatedBy);
    segments.push(parsed.segment);
  });

  // Merge the additional block: it is the authoritative source for booking class.
  if (additional.length) {
    additional.forEach((entry) => {
      const byLine = segments.find(
        (s) => s.lineNumber === entry.line && s.flightNumber === entry.flightNumber,
      );
      const byFlight = segments.find(
        (s) => s.carrier === entry.carrier && s.flightNumber === entry.flightNumber,
      );
      const target = byLine ?? byFlight;
      if (!target) {
        issues.push({
          level: 'warning',
          code: 'additional-unmatched',
          message: `Additional entry ${entry.line} (${entry.carrier} ${entry.flightNumber}) has no matching segment.`,
        });
        return;
      }
      if (
        target.bookingClass &&
        entry.bookingClass &&
        target.bookingClass !== entry.bookingClass
      ) {
        issues.push({
          level: 'info',
          code: 'additional-overrides-class',
          message: `Additional block overrides class ${target.bookingClass} → ${entry.bookingClass} on ${target.carrier} ${target.flightNumber}.`,
          segmentId: target.id,
        });
      }
      if (entry.bookingClass) target.bookingClass = entry.bookingClass;
      if (!target.carrier) target.carrier = entry.carrier;
      const fromClass = cabinForClass(target.bookingClass);
      if (fromClass && !target.cabin) target.cabin = fromClass;
    });
  }

  if (!segments.length) {
    issues.push({
      level: 'error',
      code: 'no-segments',
      message: 'No flight segments found.',
      detail: 'Paste lines that include a date, two airport codes and a departure time.',
    });
  }

  return {
    segments,
    issues,
    stats: {
      lines: rawLines.filter((l) => l.trim()).length,
      segments: segments.length,
      additionalEntries: additional.length,
      skipped,
    },
    additional,
  };
}
