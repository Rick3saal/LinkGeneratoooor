import { describe, expect, it } from 'vitest';
import { decodeIten, extractIten, passengerCode } from '../lib/aaLink';
import { analyze } from '../lib/analyze';
import { parseItinerary } from '../lib/parse';
import { oneSlicePerSegment } from '../lib/slices';
import { DEFAULT_BUILD_OPTIONS, type BuildOptions } from '../lib/types';
import { lookup, NOW } from './fixtures';

/** Itinerary A: AA-marketed flights, two BA codeshare legs, business + economy. */
const ITINERARY_A = `1 AA 7048 3APR JTR LHR 355P 605P 320 4.10 0 N  CABIN-BUSINESS

*JTR-LHR OPERATED BY BRITISH AIRWAYS

2 AA 6996 4APR LHR SFO 1045A 150P 380 11.05 0 N  CABIN-BUSINESS

*LHR-SFO OPERATED BY BRITISH AIRWAYS

3 AA 2650 5APR DFW CUN 533P 816P 73H 2.43 0 N  CABIN-BUSINESS

4 BA 178 28APR JFK LHR 750A 745P 777 6.55 0 N  CABIN-ECONOMY

5 BA 398 29APR LHR CAI 620P 115A¥1 32N 4.55 0 N  CABIN-ECONOMY

<--additional-->

1 AA 7048D 3APR

2 AA 6996I 4APR

3 AA 2650I 5APR

4 BA 178L 28APR

5 BA 398L 29APR`;

/** Itinerary B: economy, with IB codeshares operated by BA. */
const ITINERARY_B = `1 AA 7048 5APR JTR LHR 245P 455P 320 4.10 0 N  CABIN-ECONOMY
*JTR-LHR OPERATED BY BRITISH AIRWAYS
2 AA 6996 6APR LHR SFO 1045A 150P 380 11.05 0 N  CABIN-ECONOMY
*LHR-SFO OPERATED BY BRITISH AIRWAYS
3 AA 1507 7APR DFW CUN 215P 459P 73H 2.44 0 N  CABIN-ECONOMY
4 IB 3564 30APR JFK LHR 750A 745P 777 6.55 0 N  CABIN-ECONOMY
*JFK-LHR OPERATED BY BRITISH AIRWAYS
5 IB 3844 30APR LHR CAI 915P 410A¥1 32N 4.55 0 N  CABIN-ECONOMY
*LHR-CAI OPERATED BY BRITISH AIRWAYS

<--additional-->
1 AA 7048S 5APR
2 AA 6996S 6APR
3 AA 1507S 7APR
4 IB 3564O 30APR
5 IB 3844O 30APR`;

/** The user's four-flight example: the final short connection must be splittable. */
const FOUR_FLIGHT_ITINERARY = `1 AA 7048 5APR JTR LHR 245P 455P 320 4.10 0 N  CABIN-BUSINESS
*JTR-LHR OPERATED BY BRITISH AIRWAYS
2 AA 6996 6APR LHR SFO 1045A 150P 380 11.05 0 N  CABIN-BUSINESS
*LHR-SFO OPERATED BY BRITISH AIRWAYS
3 IB 3564 28APR JFK LHR 750A 745P 777 6.55 0 N  CABIN-ECONOMY
*JFK-LHR OPERATED BY BRITISH AIRWAYS
4 IB 3844 28APR LHR CAI 915P 310A¥1 32N 4.55 0 N  CABIN-ECONOMY
*LHR-CAI OPERATED BY BRITISH AIRWAYS

&lt;--additional--&gt;
1 AA 7048J 5APR
2 AA 6996I 6APR
3 IB 3564O 28APR
4 IB 3844O 28APR`;

const FOUR_FLIGHT_SPLIT_URL =
  'https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA1S0C0I0Y0L0%2C0%2CJTR%2C0%2CLHR%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0.00%2C1%2C%23JTR%7CLHR%7C0%7C0%7C1806925500000%23LHR%7CSFO%7C0%7C0%7C1807004700000%23JFK%7CLHR%7C0%7C0%7C1808913000000%23LHR%7CCAI%7C0%7C0%7C1808943300000%2C%23AA%7C7048%7CJ%7CJTR%7CLHR%7C1806925500000%7C0%23AA%7C6996%7CI%7CLHR%7CSFO%7C1807004700000%7C1%23IB%7C3564%7CO%7CJFK%7CLHR%7C1808913000000%7C2%23IB%7C3844%7CO%7CLHR%7CCAI%7C1808943300000%7C3';

/** The 2-adult link the user confirmed as correct for itinerary A. */
const CONFIRMED_TWO_ADULTS =
  'https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA2S0C0I0Y0L0%2C0%2CJTR%2C0%2CLHR%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0.00%2C1%2C%23JTR%7CLHR%7C0%7C0%7C1806756900000%23LHR%7CSFO%7C0%7C0%7C1806831900000%23DFW%7CCUN%7C0%7C0%7C1806964380000%23JFK%7CLHR%7C0%7C0%7C1808913000000%23LHR%7CCAI%7C0%7C0%7C1809019200000%2C%23AA%7C7048%7CD%7CJTR%7CLHR%7C1806756900000%7C0%23AA%7C6996%7CI%7CLHR%7CSFO%7C1806831900000%7C1%23AA%7C2650%7CI%7CDFW%7CCUN%7C1806964380000%7C2%23BA%7C178%7CL%7CJFK%7CLHR%7C1808913000000%7C3%23BA%7C398%7CL%7CLHR%7CCAI%7C1809019200000%7C4';

function build(text: string, passengers: Partial<BuildOptions['passengers']> = {}) {
  const parsed = parseItinerary(text, { now: NOW });
  const options: BuildOptions = {
    ...DEFAULT_BUILD_OPTIONS,
    passengers: { ...DEFAULT_BUILD_OPTIONS.passengers, ...passengers },
  };
  const analysis = analyze(parsed.segments, options, {
    lookup,
    thresholdHours: 4,
    parseIssues: parsed.issues,
    now: NOW,
  });
  return { parsed, analysis, link: analysis.link };
}

describe('confirmed itinerary A', () => {
  it('builds the 2-adult link the user confirmed, byte for byte', () => {
    const { link } = build(ITINERARY_A, { adults: 2 });
    expect(link.ok).toBe(true);
    expect(link.url).toBe(CONFIRMED_TWO_ADULTS);
    expect(extractIten(CONFIRMED_TWO_ADULTS)).toBe(link.iten);
  });

  it('changes only field 5 for one adult', () => {
    const two = build(ITINERARY_A, { adults: 2 }).link;
    const one = build(ITINERARY_A, { adults: 1 }).link;
    const diff = one.fields
      .map((f, i) => (f === two.fields[i] ? null : i))
      .filter((i) => i !== null);
    expect(diff).toEqual([5]);
    expect(one.fields[5]).toBe('A1S0C0I0Y0L0');
    expect(two.fields[5]).toBe('A2S0C0I0Y0L0');
  });

  it('splits a 16-hour London layover into its own slice', () => {
    const { link } = build(ITINERARY_A, { adults: 2 });
    const decoded = decodeIten(link.iten);
    expect(decoded.slices.map((s) => `${s.from}${s.to}`)).toEqual([
      'JTRLHR',
      'LHRSFO',
      'DFWCUN',
      'JFKLHR',
      'LHRCAI',
    ]);
  });
});

describe('one AA city pair per flight', () => {
  it('builds the requested four-slice link instead of merging a short connection', () => {
    const parsed = parseItinerary(FOUR_FLIGHT_ITINERARY, { now: NOW });
    const automatic = analyze(parsed.segments, DEFAULT_BUILD_OPTIONS, {
      lookup,
      thresholdHours: 4,
      parseIssues: parsed.issues,
      now: NOW,
    });

    // Auto mode correctly sees the final 90-minute LHR connection as one route.
    expect(automatic.plan.slices).toHaveLength(3);

    // The explicit per-flight mode matches the user's requested AA envelope.
    const split = analyze(oneSlicePerSegment(parsed.segments), DEFAULT_BUILD_OPTIONS, {
      lookup,
      thresholdHours: 4,
      parseIssues: parsed.issues,
      now: NOW,
    });
    expect(split.plan.slices).toHaveLength(4);
    expect(split.link.url).toBe(FOUR_FLIGHT_SPLIT_URL);
    expect(decodeIten(split.link.iten).segments.map((segment) => segment.sliceIndex)).toEqual([
      0, 1, 2, 3,
    ]);
  });
});

describe('passenger mix', () => {
  it('writes adults, children, lap infants and seated infants as separate letters', () => {
    const opts = (p: Partial<BuildOptions['passengers']>) => ({
      ...DEFAULT_BUILD_OPTIONS,
      passengers: { ...DEFAULT_BUILD_OPTIONS.passengers, ...p },
    });
    expect(passengerCode(opts({ adults: 3, children: 2 }))).toBe('A3S0C2I0Y0L0');
    expect(passengerCode(opts({ adults: 3, children: 2, lap: 1 }))).toBe('A3S0C2I0Y0L1');
    expect(passengerCode(opts({ adults: 3, children: 2, lap: 2 }))).toBe('A3S0C2I0Y0L2');
    expect(passengerCode(opts({ adults: 3, children: 2, infants: 1 }))).toBe('A3S0C2I1Y0L0');
  });

  it('keeps a lap infant out of the adult and child counts', () => {
    const { link } = build(ITINERARY_A, { adults: 3, children: 2, lap: 1 });
    expect(link.ok).toBe(true);
    expect(link.fields[5]).toBe('A3S0C2I0Y0L1');
  });

  it('refuses more than nine travellers', () => {
    const { link } = build(ITINERARY_A, { adults: 5, children: 3, lap: 2 });
    expect(link.ok).toBe(false);
    expect(link.errors.map((e) => e.code)).toContain('too-many-pax');
  });
});

describe('partner codeshare swap (IB operated by BA)', () => {
  it('hands off the operating BA flight when the footnote names it', () => {
    const text = ITINERARY_B.replace(
      '*JFK-LHR OPERATED BY BRITISH AIRWAYS',
      '*JFK-LHR OPERATED BY BA 178',
    );
    const { parsed, link } = build(text, { adults: 2 });
    expect(parsed.segments[3].sendAs).toBe('operating');
    expect(link.ok).toBe(true);
    const seg = decodeIten(link.iten).segments;
    expect(seg[3]).toMatchObject({ carrier: 'BA', flight: '178', cls: 'O', from: 'JFK', to: 'LHR' });
    // The IB leg without a known operating number keeps the IB number.
    expect(seg[4]).toMatchObject({ carrier: 'IB', flight: '3844' });
  });

  it('keeps the AA number for AA-marketed codeshares', () => {
    const text = ITINERARY_A.replace('*JTR-LHR OPERATED BY BRITISH AIRWAYS', '*JTR-LHR OPERATED BY BA 178');
    const { parsed, link } = build(text, { adults: 2 });
    expect(parsed.segments[0].sendAs).toBeUndefined();
    expect(decodeIten(link.iten).segments[0]).toMatchObject({ carrier: 'AA', flight: '7048' });
  });

  it('does not swap when the footnote gives no flight number', () => {
    const { parsed } = build(ITINERARY_B, { adults: 2 });
    expect(parsed.segments[3].sendAs).toBeUndefined();
  });
});

describe('Sabre *IA layouts', () => {
  it('reads glued flight+class and the class column on each row', () => {
    const text = ` 1 AA7048S 03APR J JTRLHR UC1   355P  605P /DCAA /E
 2 AA6996S 04APR S LHRSFO UC1  1045A  150P /DCAA /E
 3 AA1507S 05APR M DFWCUN SS1   155P  438P /DCAA /E
 4 BA 178L 28APR W JFKLHR UC1   750A  745P /DCBA
 5 BA 398L 29APR Q LHRCAI UC1   915P  410A  30APR F /DCBA`;
    const parsed = parseItinerary(text, { now: NOW });
    expect(parsed.segments.map((s) => `${s.carrier}${s.flightNumber}:${s.bookingClass}`)).toEqual([
      'AA7048:S',
      'AA6996:S',
      'AA1507:S',
      'BA178:L',
      'BA398:L',
    ]);
    expect(parsed.segments[4].arrDayOffset).toBe(1);
  });
});
