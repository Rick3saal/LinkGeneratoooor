import { cabinForClass } from './classes';
import { CABIN_META } from './classes';
import { isoDate } from './time';
import type { Issue, Segment } from './types';

/** Field-level checks on the (possibly hand-edited) segments. */
export function segmentChecks(segments: Segment[], now: Date = new Date()): Issue[] {
  const issues: Issue[] = [];
  const today = isoDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());

  segments.forEach((s, index) => {
    const label = `${s.carrier || '??'} ${s.flightNumber || '—'}`.trim();

    if (!s.carrier || !s.flightNumber) {
      issues.push({
        level: 'error',
        code: 'missing-flight',
        message: `Segment ${index + 1} has no carrier or flight number.`,
        segmentId: s.id,
      });
    }
    if (!s.origin || !s.destination) {
      issues.push({
        level: 'error',
        code: 'missing-airports',
        message: `Segment ${index + 1} is missing an airport.`,
        detail: 'Every segment needs two 3-letter codes.',
        segmentId: s.id,
      });
    }
    if (!s.depDate || !s.depTime) {
      issues.push({
        level: 'error',
        code: 'missing-time',
        message: `${label} has no departure date/time.`,
        detail: 'AA needs the local departure time to place the flight.',
        segmentId: s.id,
      });
    }
    if (!s.bookingClass) {
      issues.push({
        level: 'error',
        code: 'missing-class',
        message: `${label} has no booking class.`,
        detail: 'The class decides which cabin AA sells — it is the one field AA cannot guess.',
        segmentId: s.id,
      });
    }

    if (s.classConflict) {
      issues.push({
        level: 'info',
        code: 'class-conflict',
        message: `${label}: two classes on the source line (${s.bookingClass} and ${s.classConflict}).`,
        detail: 'Kept the one attached to the flight number. Switch it in the class column if needed.',
        segmentId: s.id,
      });
    }

    const fromClass = cabinForClass(s.bookingClass);
    if (fromClass && s.cabin && fromClass !== s.cabin) {
      issues.push({
        level: 'info',
        code: 'cabin-class-mismatch',
        message: `${label}: class ${s.bookingClass} maps to ${CABIN_META[fromClass].label.toLowerCase()}, not ${CABIN_META[s.cabin].label.toLowerCase()}.`,
        detail: 'AA re-reads the cabin from the class, so the link will keep the class.',
        segmentId: s.id,
      });
    }

    if (s.depDate && s.depDate < today) {
      issues.push({
        level: 'warning',
        code: 'past-date',
        message: `${label} departs on a past date (${s.depDate}).`,
        detail: 'aa.com will not price a departure in the past.',
        segmentId: s.id,
      });
    }
  });

  const carriers = [...new Set(segments.map((s) => s.carrier).filter(Boolean))].sort();
  if (carriers.length && !carriers.includes('AA')) {
    issues.push({
      level: 'warning',
      code: 'no-aa-marketing',
      message: `None of these flights is marketed by AA (${carriers.join(', ')}).`,
      detail:
        'The aa.com hand-off only quotes AA-marketed flights. Use the AA codeshare numbers when the flights are sold by AA.',
    });
  } else if (carriers.filter((c) => c !== 'AA').length) {
    const others = carriers.filter((c) => c !== 'AA');
    issues.push({
      level: 'warning',
      code: 'mixed-carriers',
      message: `Mixed marketing carriers: ${carriers.join(', ')}.`,
      detail: `aa.com prices AA-marketed flights — the ${others.join(', ')} segments may not appear. Prefer the AA codeshare number.`,
    });
  }

  const cabins = [...new Set(segments.filter((s) => s.cabin).map((s) => s.cabin))];
  if (cabins.length > 1) {
    const summary = cabins
      .map((cabin) => {
        const n = segments.filter((s) => s.cabin === cabin).length;
        return `${n} × ${CABIN_META[cabin].label}`;
      })
      .join(' + ');
    issues.push({
      level: 'info',
      code: 'mixed-cabin',
      message: `Mixed cabin itinerary — ${summary}.`,
      detail:
        'That is the point of this tool: the link carries a class per segment, so aa.com opens the whole trip even when its own search would not build it.',
    });
  }

  return issues;
}
