import { describe, expect, it } from 'vitest';
import {
  parseAdditionalLine,
  parseDateToken,
  parseItinerary,
  parseSegmentLine,
  parseTimeToken,
} from '../lib/parse';
import { segmentChecks } from '../lib/checks';
import { planSlices } from '../lib/slices';
import { localToUtcMs } from '../lib/time';
import { EX1, EX2, EX3, NOW, lookup } from './fixtures';

describe('token parsers', () => {
  it('reads GDS dates', () => {
    expect(parseDateToken('10NOV')).toMatchObject({ day: 10, month: 11, year: undefined });
    expect(parseDateToken('1JAN26')).toMatchObject({ day: 1, month: 1, year: 2026 });
    expect(parseDateToken('2026-12-16')).toMatchObject({ year: 2026, month: 12, day: 16 });
    expect(parseDateToken('ABC')).toBeNull();
  });

  it('reads GDS times', () => {
    expect(parseTimeToken('1010A')).toMatchObject({ hour: 10, minute: 10, dayOffset: 0 });
    expect(parseTimeToken('745P')).toMatchObject({ hour: 19, minute: 45 });
    expect(parseTimeToken('820A')).toMatchObject({ hour: 8, minute: 20 });
    expect(parseTimeToken('12A')).toMatchObject({ hour: 0, minute: 0 });
    expect(parseTimeToken('12P')).toMatchObject({ hour: 12, minute: 0 });
    expect(parseTimeToken('630A+1')).toMatchObject({ hour: 6, minute: 30, dayOffset: 1 });
    expect(parseTimeToken('1900')).toMatchObject({ hour: 19, minute: 0 });
    expect(parseTimeToken('777')).toBeNull();
    expect(parseTimeToken('7.00')).toBeNull();
  });
});

describe('line shapes', () => {
  it('parses the availability shape', () => {
    const parsed = parseSegmentLine(
      '1 AA 142 10NOV JFK LHR 1010A 1010P 777 7.00 0 N  CABIN-BUSINESS',
      { now: NOW },
    );
    expect(parsed?.segment).toMatchObject({
      carrier: 'AA',
      flightNumber: '142',
      origin: 'JFK',
      destination: 'LHR',
      depDate: '2026-11-10',
      depTime: '10:10',
      arrTime: '22:10',
      cabin: 'BUSINESS',
    });
  });

  it('parses the Sabre sell shape with a glued city pair', () => {
    const parsed = parseSegmentLine('1 AA 763I 31DEC Q MUCCLT*SS2 1020A 245P /DCAA /E', {
      now: NOW,
    });
    expect(parsed?.segment).toMatchObject({
      carrier: 'AA',
      flightNumber: '763',
      bookingClass: 'I',
      origin: 'MUC',
      destination: 'CLT',
      depTime: '10:20',
      arrTime: '14:45',
      depDate: '2026-12-31',
    });
  });

  it('parses a class before the date and a 24h clock', () => {
    const parsed = parseSegmentLine('AA 100 J 01DEC JFK LHR 1900 0700+1', { now: NOW });
    expect(parsed?.segment).toMatchObject({
      carrier: 'AA',
      flightNumber: '100',
      bookingClass: 'J',
      origin: 'JFK',
      destination: 'LHR',
      depTime: '19:00',
      arrTime: '07:00',
      arrDayOffset: 1,
    });
  });

  it('reads a class glued to the flight number', () => {
    const parsed = parseSegmentLine('2 AA 6930I 16DEC LHR JFK 820A 1120A', { now: NOW });
    expect(parsed?.segment).toMatchObject({ bookingClass: 'I', depTime: '08:20' });
  });

  it('parses the additional block entries', () => {
    expect(parseAdditionalLine('1 AA 142I 10NOV', { now: NOW })).toMatchObject({
      line: 1,
      carrier: 'AA',
      flightNumber: '142',
      bookingClass: 'I',
      date: '2026-11-10',
    });
    expect(parseAdditionalLine('2 AA 8727I 12NOV', { now: NOW })).toMatchObject({
      flightNumber: '8727',
      bookingClass: 'I',
    });
  });
});

describe('itinerary documents', () => {
  it('merges the additional block into the segments', () => {
    const parsed = parseItinerary(EX1.text, { now: NOW });
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.segments.map((s) => s.bookingClass)).toEqual(['I', 'I']);
    expect(parsed.stats.additionalEntries).toBe(2);
    expect(parsed.segments[1].operatedBy).toBe('BRITISH AIRWAYS');
  });

  it('keeps the stray ¥ day marker from the source data', () => {
    const parsed = parseItinerary(EX2.text, { now: NOW });
    expect(parsed.segments).toHaveLength(3);
    expect(parsed.segments[0].arrDayOffset).toBe(1);
  });

  it('infers the travel year from today', () => {
    const parsed = parseItinerary(EX3.text, { now: NOW });
    expect(parsed.segments[0].depDate).toBe('2026-11-10');
    const nextYear = parseItinerary(EX3.text, { now: new Date('2026-12-20T00:00:00Z') });
    expect(nextYear.segments[0].depDate).toBe('2027-11-10');
  });

  it('honours an explicit year override', () => {
    const parsed = parseItinerary(EX1.text, { now: NOW, yearOverride: 2028 });
    expect(parsed.segments[0].depDate).toBe('2028-11-10');
  });

  it('reports unknown marketing carriers', () => {
    const parsed = parseItinerary('1 BA 176 J 30JAN JFKLHR 705P 705A 31JAN', { now: NOW });
    expect(segmentChecks(parsed.segments, NOW).map((i) => i.code)).toContain('no-aa-marketing');
  });
});

describe('slices', () => {
  const plan = (text: string) => {
    const parsed = parseItinerary(text, { now: NOW });
    return planSlices(parsed.segments, { lookup });
  };

  it('groups a next-day connection into one slice', () => {
    expect(plan(EX2.text).slices).toHaveLength(2);
    expect(plan(EX2.text).slices[0]).toHaveLength(2);
  });

  it('splits a same-day turnaround', () => {
    const text = `1 AA 100 01DEC JFK LHR 0700 1900 CABIN-BUSINESS
2 AA 101 01DEC LHR JFK 2100 2355 CABIN-BUSINESS`;
    const result = plan(text);
    expect(result.slices).toHaveLength(2);
    expect(result.items[1].autoNewSlice).toBe(true);
  });

  it('respects a manual override', () => {
    const parsed = parseItinerary(EX2.text, { now: NOW });
    parsed.segments[1].newSliceOverride = true;
    const result = planSlices(parsed.segments, { lookup });
    expect(result.slices).toHaveLength(3);
  });

  it('flags an impossible connection', () => {
    const text = `1 AA 100 01DEC JFK LHR 0700 1900 CABIN-BUSINESS
2 AA 101 01DEC LHR JFK 1800 2100 CABIN-BUSINESS`;
    const result = plan(text);
    expect(result.issues.map((i) => i.code)).toContain('overlap');
  });
});

describe('timezones', () => {
  it('handles US daylight saving', () => {
    // 2026-11-01 is the US DST switch: 10 Nov is EST (UTC-5), 10 Sep is EDT (UTC-4).
    expect(localToUtcMs('America/New_York', '2026-11-10', '10:10')).toBe(1794323400000);
    expect(
      new Date(localToUtcMs('America/New_York', '2026-09-10', '10:10')).toISOString(),
    ).toBe('2026-09-10T14:10:00.000Z');
    expect(
      new Date(localToUtcMs('Europe/London', '2026-12-16', '08:20')).toISOString(),
    ).toBe('2026-12-16T08:20:00.000Z');
    expect(
      new Date(localToUtcMs('Europe/Madrid', '2026-11-12', '10:25')).toISOString(),
    ).toBe('2026-11-12T09:25:00.000Z');
  });

  it('handles Egypt (no DST since 2015, DST again from 2023)', () => {
    expect(new Date(localToUtcMs('Africa/Cairo', '2026-11-10', '10:10')).toISOString()).toBe(
      '2026-11-10T08:10:00.000Z',
    );
  });
});
