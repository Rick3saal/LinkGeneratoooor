import { describe, expect, it } from 'vitest';
import { buildAaLink, decodeIten, extractIten } from '../lib/aaLink';
import { parseItinerary } from '../lib/parse';
import { planSlices } from '../lib/slices';
import { EX1, EX2, EX3, NOW, lookup, options } from './fixtures';

function build(text: string) {
  const parsed = parseItinerary(text, { now: NOW });
  const plan = planSlices(parsed.segments, { lookup });
  const link = buildAaLink({ items: plan.items, slices: plan.slices, options });
  return { parsed, plan, link };
}

describe('golden links (byte-exact regression)', () => {
  it('example 1 — JFK/LHR round trip', () => {
    const { link } = build(EX1.text);
    expect(link.ok).toBe(true);
    expect(link.url).toBe(EX1.url);
  });

  it('example 2 — JFK/MAD/BCN with a connection', () => {
    const { link } = build(EX2.text);
    expect(link.ok).toBe(true);
    expect(link.url).toBe(EX2.url);
  });

  it('example 3 — EWR/LHR/FRA, four codeshare segments', () => {
    const { link } = build(EX3.text);
    expect(link.ok).toBe(true);
    expect(link.url).toBe(EX3.url);
  });
});

describe('envelope', () => {
  it('writes 21 fields', () => {
    const { link } = build(EX1.text);
    expect(link.fields).toHaveLength(21);
    expect(link.fields[5]).toBe('A1S0C0I0Y0L0');
    expect(link.fields[17]).toBe('0.00');
  });

  it('encodes commas, hashes and pipes', () => {
    const { link } = build(EX1.text);
    expect(link.url).toContain('%2C');
    expect(link.url).toContain('%23');
    expect(link.url).toContain('%7C');
    expect(link.url).not.toContain('#');
  });

  it('carries each segment class — mixed cabins survive', () => {
    const text = `1 AA 100 01DEC JFK LHR 0700 1900 CABIN-BUSINESS
2 AA 101 08DEC LHR JFK 1100 1400 CABIN-ECONOMY`;
    const parsed = parseItinerary(text, { now: NOW });
    parsed.segments[0].bookingClass = 'J';
    parsed.segments[1].bookingClass = 'Y';
    const plan = planSlices(parsed.segments, { lookup });
    const link = buildAaLink({ items: plan.items, slices: plan.slices, options });
    expect(link.ok).toBe(true);
    expect(decodeIten(link.iten).segments.map((s) => s.cls)).toEqual(['J', 'Y']);
    expect(plan.mixedCabin).toBe(true);
  });
});

describe('decoder', () => {
  it('round-trips the generated link', () => {
    const { link } = build(EX2.text);
    const decoded = decodeIten(extractIten(link.url) ?? '');
    expect(decoded.error).toBeUndefined();
    expect(decoded.segments).toHaveLength(3);
    expect(decoded.segments[1]).toMatchObject({
      carrier: 'AA',
      flight: '8727',
      cls: 'I',
      from: 'MAD',
      to: 'BCN',
      sliceIndex: 0,
    });
    expect(decoded.slices).toHaveLength(2);
    expect(decoded.slices[1]).toMatchObject({ from: 'BCN', to: 'JFK' });
  });

  it('extracts an ITEN from a full URL', () => {
    const value = extractIten(EX3.url);
    expect(value?.startsWith('DIRECT,0,US,multi,4,')).toBe(true);
  });
});

describe('validation', () => {
  it('refuses to build without a booking class', () => {
    const text = `1 AA 100 01DEC JFK LHR 0700 1900 CABIN-BUSINESS`;
    const { link } = build(text);
    expect(link.ok).toBe(false);
    expect(link.errors.map((e) => e.code)).toContain('missing-class');
  });

  it('refuses an unknown departure airport', () => {
    const text = `1 AA 100 01DEC QQQ LHR 0700 1900 CABIN-BUSINESS`;
    const { link } = build(text);
    expect(link.ok).toBe(false);
    expect(link.errors.map((e) => e.code)).toContain('no-timezone');
  });

  it('warns (but still builds) for an unknown destination', () => {
    const text = `1 AA 100 J 01DEC JFK QQQ 0700 1900 CABIN-BUSINESS`;
    const { link, plan } = build(text);
    expect(link.ok).toBe(true);
    expect(plan.issues.map((e) => e.code)).toContain('unknown-destination');
  });
});
