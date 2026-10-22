import { cabinForClass } from './classes';
import { CABIN_META } from './classes';
import { isAaSellable, labelCarrier, looksLikeCodeshareNumber } from './carriers';
import { formatShortDate, isoDate } from './time';
import type { Issue, PassengerCounts, Segment } from './types';

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

  // ---- Codeshares -------------------------------------------------
  // A GDS row carries the *marketing* carrier; the footnote carries the metal.
  // aa.com resolves a hand-off by carrier + flight number, and it only knows
  // the numbers its own shelf sells: AA, AA codeshares, and partner prime
  // flights. A partner's codeshare of another partner's metal is the case that
  // comes back "we couldn't find that flight".
  for (const s of segments) {
    if (!s.operatingCarrier || !s.carrier) continue;
    if (s.operatingCarrier.toUpperCase() === s.carrier.toUpperCase()) continue;

    const opLabel = labelCarrier(s.operatingCarrier);
    const markLabel = labelCarrier(s.carrier);
    const sendingOperating = s.sendAs === 'operating';

    // An AA codeshare of a partner's metal is the happy path: aa.com sells it
    // under the AA number, which is what the envelope already carries.
    if (s.carrier.toUpperCase() === 'AA') {
      if (!sendingOperating) {
        issues.push({
          level: 'info',
          code: 'aa-codeshare',
          message: `${s.carrier} ${s.flightNumber} is operated by ${opLabel}.`,
          detail:
            'An AA codeshare is exactly what the hand-off wants — keep the AA number. Switch the row to the operating flight only if aa.com comes back empty.',
          segmentId: s.id,
        });
        continue;
      }
    }

    if (sendingOperating && s.operatingFlight) {
      issues.push({
        level: 'info',
        code: 'codeshare-operating-sent',
        message: `${s.carrier} ${s.flightNumber} is handed off as ${s.operatingCarrier} ${s.operatingFlight}.`,
        detail: `The link carries the operating flight (${opLabel}) instead of the marketed one (${markLabel}).`,
        segmentId: s.id,
      });
      continue;
    }

    issues.push({
      level: 'warning',
      code: 'codeshare',
      message: `${s.carrier} ${s.flightNumber} is operated by ${opLabel} — aa.com may not carry that number.`,
      detail: s.operatingFlight
        ? `The note gave the operating flight (${s.operatingCarrier} ${s.operatingFlight}): open the row and switch “Send the operating flight” on to hand it off as ${s.operatingCarrier} ${s.operatingFlight}.`
        : `A partner codeshare is usually invisible to aa.com's schedule. Find the operating (prime) number or the AA codeshare, type it into the row's “Operating flight”, and switch it on.`,
      segmentId: s.id,
    });
  }

  for (const s of segments) {
    if (s.operatingCarrier) continue;
    if (!s.carrier || !s.flightNumber) continue;
    if (!looksLikeCodeshareNumber(s.carrier, s.flightNumber)) continue;
    issues.push({
      level: 'info',
      code: 'likely-codeshare',
      message: `${s.carrier} ${s.flightNumber} is in the codeshare number range.`,
      detail:
        'Four-digit numbers from 5000 up are almost always a codeshare. If aa.com cannot find it, send the operating carrier’s own flight number instead.',
      segmentId: s.id,
    });
  }

  // ---- Marketing carriers -----------------------------------------
  const carriers = [...new Set(segments.map((s) => s.carrier).filter(Boolean))].sort();
  const unsellable = carriers.filter((c) => !isAaSellable(c));
  const partners = carriers.filter((c) => c !== 'AA' && isAaSellable(c));

  if (unsellable.length) {
    issues.push({
      level: 'warning',
      code: 'carrier-not-priced',
      message: `aa.com does not price ${unsellable.map(labelCarrier).join(', ')}-marketed flights.`,
      detail:
        'The hand-off resolves flights by carrier + flight number. Re-book these under an AA codeshare (or send the operating carrier’s number from the row below) — aa.com will not find them as they stand.',
    });
  }

  if (carriers.length && !carriers.includes('AA') && !unsellable.length) {
    issues.push({
      level: 'info',
      code: 'no-aa-marketing',
      message: `No AA flight number in this itinerary (${partners.map(labelCarrier).join(', ')}).`,
      detail:
        'aa.com sells oneworld and partner prime flights directly, so this can work — but only if aa.com carries each number as marketed. Codeshares between two partners usually fail; switch those rows to the operating flight.',
    });
  } else if (partners.length && !unsellable.length) {
    issues.push({
      level: 'info',
      code: 'mixed-carriers',
      message: `Mixed marketing carriers: ${carriers.map(labelCarrier).join(', ')}.`,
      detail: `aa.com prices AA and partner prime flights. Any ${partners.join(', ')} codeshare of another carrier's metal has to be sent under its operating number.`,
    });
  }

  // ---- Year inference ---------------------------------------------
  // A bare `19JAN` becomes the *next* 19 January from today. Get that wrong and
  // every timestamp in the envelope is a year out — the classic "aa.com says it
  // cannot find that flight" with no other visible symptom.
  const inferredYears = [
    ...new Set(
      segments.filter((s) => s.yearInferred && s.depDate).map((s) => s.depDate.slice(0, 4)),
    ),
  ].sort();
  if (inferredYears.length) {
    const samples = segments
      .filter((s) => s.yearInferred && s.depDate)
      .slice(0, 3)
      .map((s) => formatShortDate(s.depDate))
      .join(', ');
    issues.push({
      level: 'info',
      code: 'inferred-year',
      message: `Dates without a year were read as ${inferredYears.join(', ')} (${samples}).`,
      detail:
        'A bare date gets its next occurrence from today. Pin the year in the paste panel if that is not the one you meant — a year out and the hand-off finds nothing.',
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

/**
 * Passenger-mix sanity checks. The counts themselves travel in ITEN field 5
 * (`A2S0C0I0Y0L0`); these are the rules aa.com enforces at the passenger step.
 */
export function passengerChecks(passengers: PassengerCounts): Issue[] {
  const issues: Issue[] = [];
  const { adults, seniors, children, infants, youth, lap } = passengers;
  const total = adults + seniors + children + infants + youth + lap;
  const grownUps = adults + seniors;
  const babies = infants + lap;
  if (total === 0) return issues;

  if (babies > grownUps) {
    issues.push({
      level: 'warning',
      code: 'infant-per-adult',
      message: `${babies} infant${babies === 1 ? '' : 's'} for ${grownUps} adult${grownUps === 1 ? '' : 's'}.`,
      detail:
        'aa.com allows one infant (lap or seated) per adult or senior. It will drop the rest at the passenger step.',
    });
  }
  if (!grownUps && (children || youth)) {
    issues.push({
      level: 'warning',
      code: 'unaccompanied-minor',
      message: 'Children or youth travelling with no adult on the booking.',
      detail:
        'aa.com only sells that through its unaccompanied-minor desk, not through the metasearch hand-off.',
    });
  }
  return issues;
}
