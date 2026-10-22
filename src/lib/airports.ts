import type { AirportInfo, AirportLookup } from './types';

interface AirportTable {
  tz: string[];
  cc: string[];
  /** code → [name, city, countryIndex, tzIndex] */
  a: Record<string, [string, string, number, number]>;
}

let table: AirportTable | null = null;
let loading: Promise<void> | null = null;

/** Load the airport/timezone table (≈9k airports, ~145 kB gzipped). */
export async function loadAirportTable(): Promise<void> {
  if (table) return;
  if (!loading) {
    loading = (async () => {
      const url = new URL('airports.json', document.baseURI).toString();
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`Airport database failed to load (${res.status})`);
      table = (await res.json()) as AirportTable;
    })();
  }
  return loading;
}

export function airportInfo(code: string): AirportInfo | undefined {
  if (!table) return undefined;
  const key = code.toUpperCase();
  const row = table.a[key];
  if (!row) return undefined;
  return {
    code: key,
    name: row[0],
    city: row[1],
    country: table.cc[row[2]] ?? '',
    tz: table.tz[row[3]] ?? '',
  };
}

export const lookupAirport: AirportLookup = airportInfo;

export interface AirportSearchHit extends AirportInfo {
  score: number;
}

/**
 * Ranked search over the airport table: exact code, code prefix, then
 * city/name substring. Used by the origin/destination combobox.
 */
export function searchAirports(query: string, limit = 8): AirportSearchHit[] {
  const q = query.trim().toUpperCase();
  if (!q || !table) return [];
  const hits: AirportSearchHit[] = [];
  for (const [code, row] of Object.entries(table.a)) {
    const name = row[0].toUpperCase();
    const city = row[1].toUpperCase();
    let score = 0;
    if (code === q) score = 1000;
    else if (code.startsWith(q)) score = 800 - code.length;
    else if (city === q) score = 700;
    else if (city.startsWith(q)) score = 600 - city.length;
    else if (name.startsWith(q)) score = 500 - name.length;
    else if (city.includes(q)) score = 300 - city.indexOf(q);
    else if (name.includes(q)) score = 200 - name.indexOf(q);
    if (score > 0) {
      hits.push({
        code,
        name: row[0],
        city: row[1],
        country: table.cc[row[2]] ?? '',
        tz: table.tz[row[3]] ?? '',
        score,
      });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return hits.slice(0, limit);
}

/** Common IANA zones offered when an airport is unknown and must be set by hand. */
export const COMMON_TIMEZONES = [
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Anchorage',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Bangkok',
  'Asia/Beirut',
  'Asia/Colombo',
  'Asia/Delhi',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Dublin',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Honolulu',
  'UTC',
];
