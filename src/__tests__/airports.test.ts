import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAirportTable, lookupAirport, searchAirports } from '../lib/airports';

beforeAll(() => {
  const payload = readFileSync(new URL('../../public/airports.json', import.meta.url), 'utf8');
  // Minimal browser stubs: the module only needs baseURI + fetch.
  (globalThis as unknown as { document: unknown }).document = { baseURI: 'http://localhost/' };
  (globalThis as unknown as { fetch: unknown }).fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => JSON.parse(payload),
  });
});

describe('airport table', () => {
  it('loads and resolves airports with IANA zones', async () => {
    await loadAirportTable();
    expect(lookupAirport('JFK')).toMatchObject({
      code: 'JFK',
      city: 'New York City',
      country: 'US',
      tz: 'America/New_York',
    });
    expect(lookupAirport('CAI')?.tz).toBe('Africa/Cairo');
    expect(lookupAirport('LHR')?.tz).toBe('Europe/London');
    expect(lookupAirport('QQQ')).toBeUndefined();
  });

  it('searches by code and city', async () => {
    await loadAirportTable();
    expect(searchAirports('JF')[0].code).toBe('JFK');
    const cairo = searchAirports('cairo').map((hit) => hit.code);
    expect(cairo).toContain('CAI');
  });

  it('is a no-op when called twice', async () => {
    await loadAirportTable();
    await loadAirportTable();
    expect(lookupAirport('MAD')?.tz).toBe('Europe/Madrid');
  });
});
