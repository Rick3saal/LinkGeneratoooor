/**
 * Carrier directory.
 *
 * Three questions this file answers for the rest of the app:
 *
 *   1. What is this two-letter code?                → `carrierName`
 *   2. Will aa.com price a flight it markets?       → `isAaSellable`
 *   3. "OPERATED BY BRITISH AIRWAYS" → "BA"?        → `operatingCarrierCode`
 *
 * (3) is what makes codeshares visible: a GDS line writes the *marketing*
 * carrier on the flight row and the *operating* carrier in a footnote, and the
 * aa.com hand-off only ever carries one carrier + flight number. Knowing both
 * is the difference between "why can't AA find this flight" and a link that
 * opens.
 */

/** Names for the carriers that come up in AA itineraries. Unknown codes fall back to the code. */
export const CARRIER_NAMES: Record<string, string> = {
  AA: 'American Airlines',
  AC: 'Air Canada',
  AF: 'Air France',
  AM: 'Aeromexico',
  AS: 'Alaska Airlines',
  AT: 'Royal Air Maroc',
  AV: 'Avianca',
  AY: 'Finnair',
  A3: 'Aegean',
  B6: 'JetBlue',
  BA: 'British Airways',
  BR: 'EVA Air',
  CA: 'Air China',
  CI: 'China Airlines',
  CM: 'Copa Airlines',
  CX: 'Cathay Pacific',
  CZ: 'China Southern',
  DE: 'Condor',
  DL: 'Delta',
  EI: 'Aer Lingus',
  EK: 'Emirates',
  ET: 'Ethiopian Airlines',
  EY: 'Etihad Airways',
  FJ: 'Fiji Airways',
  GF: 'Gulf Air',
  G3: 'Gol',
  HA: 'Hawaiian Airlines',
  HU: 'Hainan Airlines',
  IB: 'Iberia',
  JL: 'Japan Airlines',
  KE: 'Korean Air',
  KL: 'KLM',
  KQ: 'Kenya Airways',
  LA: 'LATAM',
  LH: 'Lufthansa',
  LO: 'LOT',
  LX: 'Swiss',
  LY: 'El Al',
  MH: 'Malaysia Airlines',
  MS: 'EgyptAir',
  MU: 'China Eastern',
  NH: 'ANA',
  NZ: 'Air New Zealand',
  OA: 'Olympic Air',
  OS: 'Austrian Airlines',
  OU: 'Croatia Airlines',
  OZ: 'Asiana',
  PG: 'Bangkok Airways',
  PR: 'Philippine Airlines',
  QF: 'Qantas',
  QR: 'Qatar Airways',
  RJ: 'Royal Jordanian',
  SA: 'South African Airways',
  SK: 'SAS',
  SN: 'Brussels Airlines',
  SQ: 'Singapore Airlines',
  SV: 'Saudia',
  TG: 'Thai Airways',
  TK: 'Turkish Airlines',
  TN: 'Air Tahiti Nui',
  TP: 'TAP Air Portugal',
  UA: 'United',
  UL: 'SriLankan Airlines',
  UX: 'Air Europa',
  VS: 'Virgin Atlantic',
  VY: 'Vueling',
  WN: 'Southwest',
  WS: 'WestJet',
  WY: 'Oman Air',
};

/**
 * Carriers aa.com prices when *they* market the flight — oneworld, plus the
 * partners AA tickets directly. A flight marketed by one of these resolves on
 * its own number. Anything else has to be sent as its AA codeshare (or as the
 * operating carrier's prime number) or aa.com will not find it.
 */
export const AA_SELLABLE_CARRIERS = new Set([
  'AA', // American Airlines
  'AS', // Alaska Airlines
  'AY', // Finnair
  'BA', // British Airways
  'B6', // JetBlue
  'CX', // Cathay Pacific
  'CZ', // China Southern
  'EI', // Aer Lingus
  'FJ', // Fiji Airways
  'GF', // Gulf Air
  'G3', // Gol
  'HA', // Hawaiian Airlines
  'IB', // Iberia
  'JL', // Japan Airlines
  'LA', // LATAM
  'MH', // Malaysia Airlines
  'NZ', // Air New Zealand
  'QF', // Qantas
  'QR', // Qatar Airways
  'RJ', // Royal Jordanian
  'TN', // Air Tahiti Nui
  'UL', // SriLankan Airlines
  'WS', // WestJet
]);

/** Names of operating carriers as they appear in "OPERATED BY …" footnotes. */
export const OPERATING_CARRIER_CODES: Record<string, string> = {
  'AMERICAN AIRLINES': 'AA',
  'AMERICAN EAGLE': 'AA',
  'AMERICAN': 'AA',
  'ALASKA AIRLINES': 'AS',
  'ALASKA': 'AS',
  'AER LINGUS': 'EI',
  'AERLINGUS': 'EI',
  'AIR EUROPA': 'UX',
  'AIR TAHITI NUI': 'TN',
  'AIR NEW ZEALAND': 'NZ',
  'AIR CANADA': 'AC',
  'BRITISH AIRWAYS': 'BA',
  'CATHAY PACIFIC': 'CX',
  'CATHAY': 'CX',
  'CHINA SOUTHERN': 'CZ',
  'FINNAIR': 'AY',
  'FJ': 'FJ',
  'GOL': 'G3',
  'GULF AIR': 'GF',
  'HAWAIIAN AIRLINES': 'HA',
  'IBERIA REGIONAL': 'IB',
  'IBERIA': 'IB',
  'JAPAN AIRLINES': 'JL',
  'JAL': 'JL',
  'JETBLUE': 'B6',
  'LATAM': 'LA',
  'LEVEL': 'LV',
  'MALAYSIA AIRLINES': 'MH',
  'NORWEGIAN': 'DY',
  'QANTAS': 'QF',
  'QATAR AIRWAYS': 'QR',
  'ROYAL JORDANIAN': 'RJ',
  'SRI LANKAN AIRLINES': 'UL',
  'SRI LANKAN': 'UL',
  'VUELING': 'VY',
  'WESTJET': 'WS',
};

export function carrierName(code: string): string {
  return CARRIER_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

/** `EI` → `EI (Aer Lingus)`; unknown codes render as just the code. */
export function labelCarrier(code: string): string {
  const key = code.toUpperCase();
  const name = CARRIER_NAMES[key];
  return name ? `${key} (${name})` : key;
}

export function isAaSellable(code: string): boolean {
  return AA_SELLABLE_CARRIERS.has(code.toUpperCase());
}

/**
 * Resolve the free text after "OPERATED BY" to a two-letter code.
 *
 * Understands a bare code (`BA`), the slash form the GDS writes (`/BA`),
 * a full name (`BRITISH AIRWAYS`) and either of those with a flight number
 * tacked on (`/BA 178`).
 */
export function operatingCarrierCode(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  let key = String(value)
    .toUpperCase()
    .replace(/[/\\*.\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!key) return undefined;
  if (/^[A-Z0-9]{2}$/.test(key)) return key;
  if (OPERATING_CARRIER_CODES[key]) return OPERATING_CARRIER_CODES[key];
  for (const [name, code] of Object.entries(OPERATING_CARRIER_CODES)) {
    if (key.startsWith(name)) return code;
  }
  return undefined;
}

/**
 * Flight numbers from 5000 up are codeshare territory on almost every carrier
 * that aa.com prices (AA's own high numbers included). Used for a gentle hint
 * only — never to rewrite a segment.
 */
export function looksLikeCodeshareNumber(carrier: string, flightNumber: string): boolean {
  if (carrier.toUpperCase() === 'AA') return false;
  const n = Number(flightNumber);
  return Number.isFinite(n) && n >= 5000;
}
