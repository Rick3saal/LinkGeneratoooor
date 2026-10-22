import { describe, expect, it } from 'vitest';
import { buildAaLink, decodeIten, handoffFlight } from '../lib/aaLink';
import { analyze } from '../lib/analyze';
import { parseItinerary, parseOperatedByLine } from '../lib/parse';
import { planSlices } from '../lib/slices';
import { operatingCarrierCode } from '../lib/carriers';
import { lookup, NOW } from './fixtures';
import { DEFAULT_BUILD_OPTIONS } from '../lib/types';

/** The itinerary that came back "we couldn't find that flight" from aa.com. */
const PARTNER_CODESHARE = `1 EI 8812 19JAN JFK LHR 610P 615A¥1 351 7.05 0 N  CABIN-BUSINESS
*JFK-LHR OPERATED BY /BA CABIN-BUSINESS

2 BA 482 20JAN LHR BCN 1125A 240P 32Q 2.15 0 N  CABIN-ECONOMY

3 BA 475 26FEB BCN LHR 1140A 105P 32Q 2.25 0 N  CABIN-ECONOMY

4 EI 8815 26FEB LHR JFK 215P 520P 77W 8.05 0 N  CABIN-BUSINESS
*LHR-JFK OPERATED BY /BA CABIN-BUSINESS

5 AS 1470 27FEB LAX SJD 130P 503P 73J 2.33 0 N  CABIN-ECONOMY

&lt;--additional--&gt;

1 EI 8812I 19JAN
2 BA 482Y 20JAN
3 BA 475Y 26FEB
4 EI 8815I 26FEB
5 AS 1470O 27FEB`;

describe('"OPERATED BY" footnotes', () => {
  it('reads the slash form the GDS writes', () => {
    expect(parseOperatedByLine('*JFK-LHR OPERATED BY /BA CABIN-BUSINESS')).toEqual({
      name: 'BA',
      code: 'BA',
      flight: undefined,
    });
  });

  it('reads a full airline name', () => {
    expect(parseOperatedByLine('*LHR-JFK OPERATED BY BRITISH AIRWAYS')).toMatchObject({
      name: 'BRITISH AIRWAYS',
      code: 'BA',
    });
    expect(parseOperatedByLine('OPERATED BY: British Airways.')).toMatchObject({ code: 'BA' });
  });

  it('reads a code with the operating flight number', () => {
    expect(parseOperatedByLine('*LHR-JFK OPERATED BY BA 178')).toEqual({
      name: 'BA',
      code: 'BA',
      flight: '178',
    });
  });

  it('reads the short "OP BY" form', () => {
    expect(parseOperatedByLine('*OP BY IBERIA')).toMatchObject({ code: 'IB' });
  });

  it('resolves names to codes', () => {
    expect(operatingCarrierCode('/BA')).toBe('BA');
    expect(operatingCarrierCode('BRITISH AIRWAYS')).toBe('BA');
    expect(operatingCarrierCode('AER LINGUS')).toBe('EI');
    expect(operatingCarrierCode('ALASKA AIRLINES')).toBe('AS');
    expect(operatingCarrierCode('WHO?')).toBeUndefined();
  });

  it('returns nothing for a line that is not a footnote', () => {
    expect(parseOperatedByLine('1 AA 142 10NOV JFK LHR 1010A 1010P')).toBeNull();
  });
});

describe('partner codeshare itinerary', () => {
  it('resolves the operating carrier instead of dropping the note', () => {
    const parsed = parseItinerary(PARTNER_CODESHARE, { now: NOW });
    expect(parsed.segments).toHaveLength(5);
    expect(parsed.segments[0]).toMatchObject({
      carrier: 'EI',
      flightNumber: '8812',
      bookingClass: 'I',
      operatingCarrier: 'BA',
    });
    expect(parsed.segments[3]).toMatchObject({
      carrier: 'EI',
      flightNumber: '8815',
      operatingCarrier: 'BA',
    });
  });

  it('warns about each codeshare without blocking the build', () => {
    const parsed = parseItinerary(PARTNER_CODESHARE, { now: NOW });
    const analysis = analyze(parsed.segments, DEFAULT_BUILD_OPTIONS, {
      lookup,
      thresholdHours: 24,
      parseIssues: parsed.issues,
      now: NOW,
    });
    const codeshare = analysis.issues.filter((i) => i.code === 'codeshare');
    expect(codeshare).toHaveLength(2);
    expect(codeshare[0].message).toContain('EI 8812 is operated by BA (British Airways)');
    expect(analysis.counts.error).toBe(0);
    expect(analysis.canBuild).toBe(true);
  });

  it('still hands off the marketed number by default', () => {
    const parsed = parseItinerary(PARTNER_CODESHARE, { now: NOW });
    const decoded = decodeIten(
      buildAaLink({
        items: planSlices(parsed.segments, { lookup }).items,
        slices: planSlices(parsed.segments, { lookup }).slices,
        options: DEFAULT_BUILD_OPTIONS,
      }).iten,
    );
    expect(decoded.segments.map((s) => `${s.carrier}${s.flight}`)).toEqual([
      'EI8812',
      'BA482',
      'BA475',
      'EI8815',
      'AS1470',
    ]);
  });

  it('swaps in the operating flight when the row says so', () => {
    const parsed = parseItinerary(PARTNER_CODESHARE, { now: NOW });
    parsed.segments[0].operatingCarrier = 'BA';
    parsed.segments[0].operatingFlight = '178';
    parsed.segments[0].sendAs = 'operating';
    const plan = planSlices(parsed.segments, { lookup });
    const link = buildAaLink({ items: plan.items, slices: plan.slices, options: DEFAULT_BUILD_OPTIONS });

    expect(link.ok).toBe(true);
    expect(decodeIten(link.iten).segments[0]).toMatchObject({ carrier: 'BA', flight: '178', cls: 'I' });
    // Nothing else moves: the airports, time and slice index stay put.
    expect(decodeIten(link.iten).segments[0]).toMatchObject({
      from: 'JFK',
      to: 'LHR',
      departureUtc: 1800400200000,
      sliceIndex: 0,
    });
  });

  it('blocks the build when the operating flight number is missing', () => {
    const parsed = parseItinerary(PARTNER_CODESHARE, { now: NOW });
    parsed.segments[0].sendAs = 'operating';
    const plan = planSlices(parsed.segments, { lookup });
    const link = buildAaLink({ items: plan.items, slices: plan.slices, options: DEFAULT_BUILD_OPTIONS });
    expect(link.ok).toBe(false);
    expect(link.errors.map((e) => e.code)).toContain('operating-flight-incomplete');
  });

  it('reports the itinerary’s inferred year', () => {
    const parsed = parseItinerary(PARTNER_CODESHARE, { now: NOW });
    const analysis = analyze(parsed.segments, DEFAULT_BUILD_OPTIONS, {
      lookup,
      thresholdHours: 24,
      parseIssues: parsed.issues,
      now: NOW,
    });
    const issue = analysis.issues.find((i) => i.code === 'inferred-year');
    expect(issue?.level).toBe('info');
    expect(issue?.message).toContain('2027');
  });
});

describe('handoffFlight', () => {
  it('keeps the marketing carrier unless the row opts out', () => {
    const segment = { carrier: 'EI', flightNumber: '8812', operatingCarrier: 'BA', operatingFlight: '178' };
    expect(handoffFlight(segment as never)).toEqual({ carrier: 'EI', flightNumber: '8812' });
    expect(handoffFlight({ ...segment, sendAs: 'operating' } as never)).toEqual({
      carrier: 'BA',
      flightNumber: '178',
    });
  });

  it('falls back to the marketed flight when the operating number is unknown', () => {
    expect(
      handoffFlight({ carrier: 'EI', flightNumber: '8812', operatingCarrier: 'BA', sendAs: 'operating' } as never),
    ).toEqual({ carrier: 'EI', flightNumber: '8812' });
  });
});

describe('carrier checks', () => {
  it('stays quiet about AA codeshares of partner metal', () => {
    const parsed = parseItinerary(
      `1 AA 6943 10NOV EWR LHR 630P 630A¥1 777 7.00 0 N  CABIN-BUSINESS\n*EWR-LHR OPERATED BY BRITISH AIRWAYS\n\n<--additional-->\n1 AA 6943R 10NOV`,
      { now: NOW },
    );
    const analysis = analyze(parsed.segments, DEFAULT_BUILD_OPTIONS, {
      lookup,
      thresholdHours: 24,
      parseIssues: parsed.issues,
      now: NOW,
    });
    expect(analysis.issues.map((i) => i.code)).not.toContain('codeshare');
    expect(analysis.issues.map((i) => i.code)).toContain('aa-codeshare');
  });

  it('flags carriers aa.com does not price', () => {
    const parsed = parseItinerary(
      `1 LH 400 J 10NOV JFK FRA 630P 630A¥1 747 7.00\n\n<--additional-->\n1 LH 400J 10NOV`,
      { now: NOW },
    );
    const analysis = analyze(parsed.segments, DEFAULT_BUILD_OPTIONS, {
      lookup,
      thresholdHours: 24,
      parseIssues: parsed.issues,
      now: NOW,
    });
    const issue = analysis.issues.find((i) => i.code === 'carrier-not-priced');
    expect(issue?.level).toBe('warning');
    expect(issue?.message).toContain('Lufthansa');
  });
});
