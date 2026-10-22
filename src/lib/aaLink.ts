import type { SliceItem } from './slices';
import type { BuildOptions, Issue } from './types';

export const AA_METASEARCH_BASE = 'https://www.aa.com/goto/metasearch?ITEN=';

/**
 * The ITEN envelope, as reverse engineered from working aa.com hand-offs.
 *
 *   DIRECT,0,US,multi,4,A1S0C0I0Y0L0,0,JFK,0,LHR,0,0,0,0,0,0,0,0.00,1,
 *   #JFK|LHR|0|0|1794323400000#LHR|JFK|0|0|1797409200000,
 *   #AA|142|I|JFK|LHR|1794323400000|0#AA|6930|I|LHR|JFK|1797409200000|1
 */
export const ITEN_FIELD_DOCS: {
  index: number;
  key: string;
  label: string;
  status: 'known' | 'constant' | 'unknown';
  note: string;
}[] = [
  { index: 0, key: 'source', label: 'Source', status: 'known', note: 'Hand-off vendor. DIRECT in AA’s own links, GOOGLE when the click came from Google Flights.' },
  { index: 1, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0 in every recorded link.' },
  { index: 2, key: 'pos', label: 'Point of sale', status: 'known', note: 'Country whose AA storefront prices the itinerary (US).' },
  { index: 3, key: 'tripType', label: 'Trip type', status: 'known', note: 'multi for multi-city, oneWay for a single slice.' },
  { index: 4, key: 'four', label: 'Search constant', status: 'constant', note: 'Always 4 — including one-way links. Not the number of slices.' },
  { index: 5, key: 'pax', label: 'Passengers', status: 'known', note: 'A adults, S seniors, C children, I infants, Y youth, L lap infants.' },
  { index: 6, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 7, key: 'origin', label: 'First origin', status: 'known', note: 'Departure airport of the whole trip.' },
  { index: 8, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 9, key: 'destination', label: 'First slice destination', status: 'known', note: 'Where the first slice ends.' },
  { index: 10, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 11, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 12, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 13, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 14, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 15, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 16, key: 'zero', label: 'Reserved', status: 'constant', note: 'Always 0.' },
  { index: 17, key: 'price', label: 'Price', status: 'known', note: 'Fare figure carried for display. AA re-prices everything; 0.00 is safe.' },
  { index: 18, key: 'tail', label: 'Constant tail', status: 'constant', note: 'Always 1 in every recorded link.' },
  { index: 19, key: 'slices', label: 'Slices', status: 'known', note: '#FROM|TO|0|0|DEP_UTC_MS — one per direction, concatenated without separator.' },
  { index: 20, key: 'segments', label: 'Segments', status: 'known', note: '#CARRIER|FLIGHT|CLASS|FROM|TO|DEP_UTC_MS|SLICE_INDEX — the whole itinerary, concatenated.' },
];

export interface BuildInput {
  items: SliceItem[];
  slices: SliceItem[][];
  options: BuildOptions;
}

export interface BuiltLink {
  ok: boolean;
  url: string;
  iten: string;
  fields: string[];
  errors: Issue[];
}

export function passengerCode(options: BuildOptions): string {
  const p = options.passengers;
  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  return `A${clamp(p.adults)}S${clamp(p.seniors)}C${clamp(p.children)}I${clamp(p.infants)}Y${clamp(p.youth)}L${clamp(p.lap)}`;
}

export function normalizePrice(price: string): string {
  const n = Number(String(price).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n) || n < 0) return '0.00';
  return n.toFixed(2);
}

/**
 * Build the aa.com metasearch deep link.
 *
 * Every timestamp is the *UTC* instant of the local departure time at the
 * departure airport — that single detail is what makes the hand-off land on
 * the exact flights, mixed cabins included.
 */
export function buildAaLink(input: BuildInput): BuiltLink {
  const { items, slices, options } = input;
  const errors: Issue[] = [];

  if (!items.length) {
    return {
      ok: false,
      url: '',
      iten: '',
      fields: [],
      errors: [
        {
          level: 'error',
          code: 'empty',
          message: 'Nothing to build yet — add at least one segment.',
        },
      ],
    };
  }

  items.forEach((item) => {
    const s = item.segment;
    if (!s.carrier || !s.flightNumber) {
      errors.push({
        level: 'error',
        code: 'missing-flight',
        message: `Segment ${item.index + 1} has no carrier or flight number.`,
        segmentId: s.id,
      });
    }
    if (!s.origin || !s.destination) {
      errors.push({
        level: 'error',
        code: 'missing-airports',
        message: `Segment ${item.index + 1} has no origin/destination.`,
        segmentId: s.id,
      });
    }
    if (!s.bookingClass || !/^[A-Z]$/.test(s.bookingClass)) {
      errors.push({
        level: 'error',
        code: 'missing-class',
        message: `Segment ${item.index + 1} needs a one-letter booking class.`,
        detail: 'AA derives the cabin it sells from this letter.',
        segmentId: s.id,
      });
    }
    if (!item.tz) {
      errors.push({
        level: 'error',
        code: 'no-timezone',
        message: `No timezone for ${s.origin || 'the departure airport'} on segment ${item.index + 1}.`,
        segmentId: s.id,
      });
    } else if (Number.isNaN(item.depUtc)) {
      errors.push({
        level: 'error',
        code: 'no-departure',
        message: `Segment ${item.index + 1} needs a valid departure date and time.`,
        segmentId: s.id,
      });
    }
  });

  const paxTotal =
    options.passengers.adults +
    options.passengers.seniors +
    options.passengers.children +
    options.passengers.infants +
    options.passengers.youth +
    options.passengers.lap;
  if (paxTotal > 9) {
    errors.push({
      level: 'error',
      code: 'too-many-pax',
      message: 'aa.com cannot price more than 9 passengers in one search.',
    });
  }
  if (slices.length > 5) {
    errors.push({
      level: 'error',
      code: 'too-many-slices',
      message: `${slices.length} slices — aa.com multi-city stops at 5.`,
    });
  }

  if (errors.length) {
    return { ok: false, url: '', iten: '', fields: [], errors };
  }

  const parts: string[] = [];
  const flights: string[] = [];

  slices.forEach((slice, sliceIndex) => {
    const first = slice[0];
    const last = slice[slice.length - 1];
    parts.push(`#${first.segment.origin}|${last.segment.destination}|0|0|${first.depUtc}`);
    for (const item of slice) {
      const s = item.segment;
      flights.push(
        `#${s.carrier}|${s.flightNumber}|${s.bookingClass}|${s.origin}|${s.destination}|${item.depUtc}|${sliceIndex}`,
      );
    }
  });

  const firstSlice = slices[0];
  const fields: string[] = [
    options.source || 'DIRECT',
    '0',
    options.posCountry || 'US',
    options.tripType || 'multi',
    '4',
    passengerCode(options),
    '0',
    firstSlice[0].segment.origin,
    '0',
    firstSlice[firstSlice.length - 1].segment.destination,
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    normalizePrice(options.price),
    options.tail || '1',
    parts.join(''),
    flights.join(''),
  ];

  const iten = fields.join(',');
  return {
    ok: true,
    url: AA_METASEARCH_BASE + encodeURIComponent(iten),
    iten,
    fields,
    errors: [],
  };
}

/* ------------------------------------------------------------------ */
/* Decoder — used by the "inside the link" panel                       */
/* ------------------------------------------------------------------ */

export interface DecodedSlice {
  from: string;
  to: string;
  departureUtc: number | null;
}

export interface DecodedSegment {
  carrier: string;
  flight: string;
  cls: string;
  from: string;
  to: string;
  departureUtc: number | null;
  sliceIndex: number;
}

export interface DecodedLink {
  iten: string;
  fields: string[];
  docs: typeof ITEN_FIELD_DOCS;
  slices: DecodedSlice[];
  segments: DecodedSegment[];
  error?: string;
}

export function extractIten(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const value = url.searchParams.get('ITEN') ?? url.searchParams.get('iten');
    if (value) return value;
  } catch {
    /* not a URL — fall through */
  }
  const match = /[?&]ITEN=([^&]+)/i.exec(text);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  if (text.includes(',') && text.includes('#')) {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }
  return null;
}

function toNumberOrNull(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function decodeIten(iten: string): DecodedLink {
  const fields = iten.split(',');
  const slices: DecodedSlice[] = [];
  const segments: DecodedSegment[] = [];

  const sliceField = fields[19] ?? '';
  for (const chunk of sliceField.split('#').filter(Boolean)) {
    const p = chunk.split('|');
    if (p.length >= 5) {
      slices.push({ from: p[0], to: p[1], departureUtc: toNumberOrNull(p[4]) });
    }
  }

  const segmentField = fields[20] ?? '';
  for (const chunk of segmentField.split('#').filter(Boolean)) {
    const p = chunk.split('|');
    if (p.length >= 7) {
      segments.push({
        carrier: p[0],
        flight: p[1],
        cls: p[2],
        from: p[3],
        to: p[4],
        departureUtc: toNumberOrNull(p[5]),
        sliceIndex: Number(p[6]) || 0,
      });
    }
  }

  const error = fields.length < 21 ? `Expected 21 fields, found ${fields.length}.` : undefined;
  return { iten, fields, docs: ITEN_FIELD_DOCS, slices, segments, error };
}

export function formatUtc(timestampMs: number | null): string {
  if (!timestampMs) return '—';
  const d = new Date(timestampMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}Z`;
}
