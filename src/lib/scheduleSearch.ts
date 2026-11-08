import { carrierName } from './carriers';
import type { Segment } from './types';

/**
 * Build a Google Flights search hand-off for checking live operating-carrier
 * alternatives. This deliberately opens the provider's page instead of trying
 * to scrape flight inventory: the app has no schedule API or credentials, and
 * search results are not reliably available cross-origin.
 */
export function googleFlightsSearchUrl(
  segment: Pick<Segment, 'origin' | 'destination' | 'depDate' | 'carrier' | 'operatingCarrier'>,
): string | null {
  const { origin, destination, depDate } = segment;
  if (!origin || !destination || !depDate) return null;

  const carrier = segment.operatingCarrier || segment.carrier;
  const airline = carrier ? carrierName(carrier) : '';
  const query = [
    'Flights',
    `from ${origin.toUpperCase()}`,
    `to ${destination.toUpperCase()}`,
    `on ${depDate}`,
    airline ? `operated by ${airline}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const url = new URL('https://www.google.com/travel/flights');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en');
  return url.toString();
}
