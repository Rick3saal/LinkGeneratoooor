import { localToUtcMs } from './time';
import type { AirportLookup, Issue, Segment } from './types';

export interface SliceItem {
  segment: Segment;
  index: number;
  /** IANA zone used for the departure. */
  tz: string | null;
  /** UTC epoch ms of the local departure. NaN when it cannot be computed. */
  depUtc: number;
  /** UTC epoch ms of arrival (estimated when the source had no arrival time). */
  arrUtc: number;
  arrEstimated: boolean;
  /** Layover from the previous segment, in minutes (negative = overlap). */
  gapMinutes: number | null;
  /** Effective slice break (manual override wins). */
  newSlice: boolean;
  /** What the automatic rule decided. */
  autoNewSlice: boolean;
  sliceIndex: number;
}

export interface SlicePlan {
  items: SliceItem[];
  slices: SliceItem[][];
  issues: Issue[];
  mixedCabin: boolean;
}

export interface SliceOptions {
  lookup: AirportLookup;
  /** A stay longer than this starts a new slice. */
  thresholdHours?: number;
}

const FALLBACK_FLIGHT_MINUTES = 180;

export function resolveTimezone(segment: Segment, lookup: AirportLookup): string | null {
  if (segment.tzOverride) return segment.tzOverride;
  const info = lookup(segment.origin);
  return info?.tz ?? null;
}

/**
 * Convert segments to absolute times and group them into slices ("directions").
 *
 * A new slice starts when:
 *  - the next segment departs from somewhere other than where the previous landed, or
 *  - the stay is longer than `thresholdHours` (default 24 h), or
 *  - the itinerary returns to the airport where the current slice began
 *    (same-day turnarounds), or
 *  - the user flipped the direction switch by hand.
 */
export function planSlices(segments: Segment[], opts: SliceOptions): SlicePlan {
  const { lookup, thresholdHours = 24 } = opts;
  const issues: Issue[] = [];
  const items: SliceItem[] = [];

  let currentSliceStart: SliceItem | null = null;

  segments.forEach((segment, index) => {
    const tz = resolveTimezone(segment, lookup);
    const destTz = segment.tzOverride ?? lookup(segment.destination)?.tz ?? tz;

    let depUtc = NaN;
    if (tz && segment.depDate && segment.depTime) {
      depUtc = localToUtcMs(tz, segment.depDate, segment.depTime);
    }
    if (!lookup(segment.destination) && segment.destination) {
      issues.push({
        level: 'warning',
        code: 'unknown-destination',
        message: `${segment.destination} is not in the airport database — check the code.`,
        detail: 'Only the departure airport needs a timezone, so the link still builds.',
        segmentId: segment.id,
      });
    }


    let arrUtc = NaN;
    let arrEstimated = true;
    if (destTz && segment.arrTime && segment.depDate) {
      arrUtc = localToUtcMs(destTz, segment.depDate, segment.arrTime, segment.arrDayOffset || 0);
      if (arrUtc < depUtc) {
        // Arrival "before" departure almost always means the day rolled over.
        arrUtc = localToUtcMs(destTz, segment.depDate, segment.arrTime, (segment.arrDayOffset || 0) + 1);
      }
      arrEstimated = false;
    }
    if (Number.isNaN(arrUtc)) {
      arrUtc = Number.isNaN(depUtc) ? NaN : depUtc + FALLBACK_FLIGHT_MINUTES * 60_000;
    }

    let gapMinutes: number | null = null;
    let autoNewSlice = index === 0;
    if (index > 0) {
      const prev = items[index - 1];
      gapMinutes = (depUtc - prev.arrUtc) / 60_000;
      const disconnected = segment.origin !== prev.segment.destination;
      const longStay = gapMinutes > thresholdHours * 60;
      const backToStart =
        currentSliceStart !== null && segment.destination === currentSliceStart.segment.origin;
      autoNewSlice = disconnected || longStay || backToStart;
    }

    const manual = segment.newSliceOverride;
    const newSlice = manual === true ? true : manual === false ? index === 0 : autoNewSlice;

    const item: SliceItem = {
      segment,
      index,
      tz,
      depUtc,
      arrUtc,
      arrEstimated,
      gapMinutes,
      newSlice,
      autoNewSlice,
      sliceIndex: 0,
    };
    if (newSlice || index === 0) currentSliceStart = item;
    items.push(item);
  });

  // Assign slice indexes.
  let sliceIndex = -1;
  for (const item of items) {
    if (item.newSlice || sliceIndex < 0) sliceIndex += 1;
    item.sliceIndex = Math.max(sliceIndex, 0);
  }

  const slices: SliceItem[][] = [];
  for (const item of items) {
    if (!slices[item.sliceIndex]) slices[item.sliceIndex] = [];
    slices[item.sliceIndex].push(item);
  }

  // Connectivity / plausibility checks.
  for (let i = 1; i < items.length; i += 1) {
    const prev = items[i - 1];
    const cur = items[i];
    if (prev.segment.destination && cur.segment.origin && prev.segment.destination !== cur.segment.origin) {
      issues.push({
        level: 'warning',
        code: 'disconnected',
        message: `${prev.segment.destination} → ${cur.segment.origin} is not a connection — that starts a new slice.`,
        segmentId: cur.segment.id,
      });
    } else if (cur.gapMinutes !== null && cur.gapMinutes < 0) {
      issues.push({
        level: 'error',
        code: 'overlap',
        message: `${cur.segment.carrier} ${cur.segment.flightNumber} departs before the inbound flight lands.`,
        detail: 'Check the dates and times.',
        segmentId: cur.segment.id,
      });
    } else if (cur.gapMinutes !== null && cur.gapMinutes < 45 && cur.gapMinutes >= 0) {
      issues.push({
        level: 'info',
        code: 'tight-connection',
        message: `Only ${Math.round(cur.gapMinutes)} min to connect in ${cur.segment.origin}.`,
        segmentId: cur.segment.id,
      });
    }
  }

  const cabins = new Set(items.map((i) => i.segment.cabin));
  const mixedCabin = cabins.size > 1;

  return { items, slices, issues, mixedCabin };
}

export function sliceSummary(items: SliceItem[]): string {
  if (!items.length) return '—';
  const first = items[0].segment.origin;
  const last = items[items.length - 1].segment.destination;
  return `${first} → ${last}`;
}
