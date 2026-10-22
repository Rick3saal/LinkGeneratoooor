import { describe, expect, it } from 'vitest';
import { buildAaLink, decodeIten, passengerCode } from '../lib/aaLink';
import { analyze } from '../lib/analyze';
import { parseItinerary } from '../lib/parse';
import { planSlices } from '../lib/slices';
import { passengerChecks } from '../lib/checks';
import { EX2, EX2_TWO_ADULTS_URL, lookup, NOW } from './fixtures';
import { DEFAULT_BUILD_OPTIONS, type BuildOptions } from '../lib/types';

function build(text: string, options: BuildOptions = DEFAULT_BUILD_OPTIONS) {
  const parsed = parseItinerary(text, { now: NOW });
  const plan = planSlices(parsed.segments, { lookup });
  const link = buildAaLink({ items: plan.items, slices: plan.slices, options });
  return { parsed, plan, link };
}

const withPax = (patch: Partial<BuildOptions['passengers']>): BuildOptions => ({
  ...DEFAULT_BUILD_OPTIONS,
  passengers: { ...DEFAULT_BUILD_OPTIONS.passengers, ...patch },
});

describe('passenger mix (ITEN field 5)', () => {
  it('writes A1S0C0I0Y0L0 for a single adult', () => {
    expect(passengerCode(DEFAULT_BUILD_OPTIONS)).toBe('A1S0C0I0Y0L0');
  });

  it('writes A2S0C0I0Y0L0 for two adults', () => {
    expect(passengerCode(withPax({ adults: 2 }))).toBe('A2S0C0I0Y0L0');
  });

  it('writes every bucket in A/S/C/I/Y/L order', () => {
    expect(passengerCode(withPax({ adults: 2, seniors: 1, children: 2, infants: 1, youth: 1, lap: 1 }))).toBe(
      'A2S1C2I1Y1L1',
    );
  });

  it('floors and clamps junk input', () => {
    expect(passengerCode(withPax({ adults: 2.7, children: -3, youth: Number.NaN }))).toBe(
      'A2S0C0I0Y0L0',
    );
  });

  it('reproduces the recorded two-adult link byte for byte', () => {
    const { link } = build(EX2.text, withPax({ adults: 2 }));
    expect(link.ok).toBe(true);
    expect(link.fields[5]).toBe('A2S0C0I0Y0L0');
    expect(link.url).toBe(EX2_TWO_ADULTS_URL);
  });

  it('changes field 5 and nothing else', () => {
    const one = build(EX2.text).link;
    const two = build(EX2.text, withPax({ adults: 2 })).link;
    const differing = one.fields.map((field, i) => (field === two.fields[i] ? null : i)).filter((i) => i !== null);
    expect(differing).toEqual([5]);
  });

  it('refuses to build with no passengers at all', () => {
    const { link } = build(EX2.text, withPax({ adults: 0 }));
    expect(link.ok).toBe(false);
    expect(link.errors.map((e) => e.code)).toContain('no-passengers');
  });

  it('refuses more than nine seats', () => {
    const { link } = build(EX2.text, withPax({ adults: 6, children: 4 }));
    expect(link.ok).toBe(false);
    expect(link.errors.map((e) => e.code)).toContain('too-many-pax');
  });

  it('warns when infants outnumber adults', () => {
    const issues = passengerChecks({ adults: 1, seniors: 0, children: 0, infants: 1, youth: 0, lap: 1 });
    expect(issues.map((i) => i.code)).toContain('infant-per-adult');
  });

  it('survives the whole analysis pass with a six-way mix', () => {
    const parsed = parseItinerary(EX2.text, { now: NOW });
    const analysis = analyze(parsed.segments, withPax({ adults: 2, children: 1, lap: 1 }), {
      lookup,
      thresholdHours: 24,
      parseIssues: parsed.issues,
      now: NOW,
    });
    expect(analysis.canBuild).toBe(true);
    expect(decodeIten(analysis.link.iten).fields[5]).toBe('A2S0C1I0Y0L1');
  });
});
