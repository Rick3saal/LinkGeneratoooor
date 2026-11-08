import { analyze } from './analyze';
import { summarizeAlternative, type LinkAlternativeDraft } from './alternatives';
import { oneSlicePerSegment } from './slices';
import type { AirportLookup, BuildOptions, Segment } from './types';

/** User-supplied examples, NOT a live schedule database or a codeshare mapping.
 * Restrict to the exact dated source flights; never extrapolate to other dates.
 */
const REFERENCE_OPTIONS = [
  { flights: ['178', '398'], departure: '07:50', arrival: '19:45', overnight: 0, onward: '18:20', onwardArrival: '01:15', onwardOvernight: 1 },
  { flights: ['1511', '396'], departure: '18:20', arrival: '06:25', overnight: 1, onward: '09:05', onwardArrival: '15:15', onwardOvernight: 0 },
  { flights: ['112', '396'], departure: '18:30', arrival: '06:40', overnight: 1, onward: '09:05', onwardArrival: '15:15', onwardOvernight: 0 },
] as const;

export function referenceAlternatives(
  segments: Segment[], options: BuildOptions, lookup: AirportLookup,
): LinkAlternativeDraft[] {
  // These examples only describe the supplied four-flight itinerary in April 2027.
  const expected = [
    ['AA', '7048', 'JTR', 'LHR', '2027-04-05', '14:45', 'J', 'BUSINESS'],
    ['AA', '6996', 'LHR', 'SFO', '2027-04-06', '10:45', 'I', 'BUSINESS'],
    ['IB', '3564', 'JFK', 'LHR', '2027-04-28', '07:50', 'O', 'ECONOMY'],
    ['IB', '3844', 'LHR', 'CAI', '2027-04-28', '21:15', 'O', 'ECONOMY'],
  ];
  if (segments.length !== expected.length || segments.some((s, i) =>
    [s.carrier, s.flightNumber, s.origin, s.destination, s.depDate, s.depTime, s.bookingClass, s.cabin]
      .some((value, j) => value !== expected[i][j]) || s.sendAs === 'operating' || s.tzOverride,
  )) return [];

  return REFERENCE_OPTIONS.flatMap((option) => {
    const replacements = segments.map((segment, index): Segment => {
      if (index < 2) return { ...segment };
      const first = index === 2;
      return {
        ...segment,
        carrier: 'BA', flightNumber: option.flights[first ? 0 : 1],
        bookingClass: 'L', cabin: 'ECONOMY',
        depDate: first ? '2027-04-28' : '2027-04-29',
        depTime: first ? option.departure : option.onward,
        arrTime: first ? option.arrival : option.onwardArrival,
        arrDayOffset: first ? option.overnight : option.onwardOvernight,
        operatedBy: first && option.flights[0] === '1511' ? 'AMERICAN' : undefined,
        operatingCarrier: first && option.flights[0] === '1511' ? 'AA' : undefined,
        operatingFlight: undefined, sendAs: 'marketing',
        raw: undefined, classConflict: undefined,
      };
    });
    // The supplied reference URLs explicitly use four independent city pairs,
    // even for the short LHR connections. Do not change the primary itinerary.
    const result = analyze(oneSlicePerSegment(replacements), options, {
      lookup, thresholdHours: 4,
    });
    if (!result.canBuild) return [];
    return [{
      label: `BA ${option.flights[0]} + BA ${option.flights[1]}`,
      summary: summarizeAlternative(result.plan.items),
      url: result.link.url,
    }];
  });
}
