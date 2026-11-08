import { describe, expect, it } from 'vitest';
import { googleFlightsSearchUrl } from '../lib/scheduleSearch';

describe('Google Flights schedule search hand-off', () => {
  it('targets the operating carrier, route, and exact travel date', () => {
    const search = googleFlightsSearchUrl({
      carrier: 'IB',
      operatingCarrier: 'BA',
      origin: 'JFK',
      destination: 'LHR',
      depDate: '2027-04-28',
    });

    expect(search).not.toBeNull();
    const url = new URL(search!);
    expect(url.origin + url.pathname).toBe('https://www.google.com/travel/flights');
    expect(url.searchParams.get('q')).toBe(
      'Flights from JFK to LHR on 2027-04-28 operated by British Airways',
    );
  });

  it('falls back to the marketing carrier and skips incomplete routes', () => {
    const search = googleFlightsSearchUrl({
      carrier: 'IB',
      operatingCarrier: undefined,
      origin: 'JFK',
      destination: 'LHR',
      depDate: '2027-04-28',
    });

    expect(search).toContain('Iberia');
    expect(
      googleFlightsSearchUrl({
        carrier: 'IB',
        operatingCarrier: 'BA',
        origin: 'JFK',
        destination: '',
        depDate: '2027-04-28',
      }),
    ).toBeNull();
  });
});
