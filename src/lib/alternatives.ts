import { handoffFlight } from './aaLink';
import type { SliceItem } from './slices';

export interface LinkAlternativeDraft {
  label: string;
  summary: string;
  url: string;
}

export interface SavedLinkAlternative extends LinkAlternativeDraft {
  id: string;
}

/** A compact snapshot of the actual carrier/flight values sent in the link. */
export function summarizeAlternative(items: SliceItem[]): string {
  return items
    .map(({ segment }) => {
      const flight = handoffFlight(segment);
      const route = `${segment.origin || '???'}–${segment.destination || '???'}`;
      const date = segment.depDate ? ` ${segment.depDate}` : '';
      return `${flight.carrier} ${flight.flightNumber} ${route}${date}`;
    })
    .join(' · ');
}
