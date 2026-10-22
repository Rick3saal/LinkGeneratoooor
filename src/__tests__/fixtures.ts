import { readFileSync } from 'node:fs';
import type { AirportLookup, AirportInfo } from '../lib/types';
import { DEFAULT_BUILD_OPTIONS, type BuildOptions } from '../lib/types';

interface Table {
  tz: string[];
  cc: string[];
  a: Record<string, [string, string, number, number]>;
}

const table = JSON.parse(
  readFileSync(new URL('../../public/airports.json', import.meta.url), 'utf8'),
) as Table;

export const lookup: AirportLookup = (code: string): AirportInfo | undefined => {
  const row = table.a[code.toUpperCase()];
  if (!row) return undefined;
  return {
    code: code.toUpperCase(),
    name: row[0],
    city: row[1],
    country: table.cc[row[2]] ?? '',
    tz: table.tz[row[3]] ?? '',
  };
};

export const NOW = new Date('2026-10-22T09:00:00Z');

export const options: BuildOptions = { ...DEFAULT_BUILD_OPTIONS };

import { EXAMPLES } from '../lib/samples';

const [sample1, sample2, sample3] = EXAMPLES;

/** Example 1 — round trip, one leg each way, business. */
export const EX1 = {
  text: sample1.text,
  url: 'https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA1S0C0I0Y0L0%2C0%2CJFK%2C0%2CLHR%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0.00%2C1%2C%23JFK%7CLHR%7C0%7C0%7C1794323400000%23LHR%7CJFK%7C0%7C0%7C1797409200000%2C%23AA%7C142%7CI%7CJFK%7CLHR%7C1794323400000%7C0%23AA%7C6930%7CI%7CLHR%7CJFK%7C1797409200000%7C1',
};

/** Example 2 — outbound with a connection the next day, return three weeks later. */
export const EX2 = {
  text: sample2.text,
  url: 'https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA1S0C0I0Y0L0%2C0%2CJFK%2C0%2CBCN%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0.00%2C1%2C%23JFK%7CBCN%7C0%7C0%7C1794444300000%23BCN%7CJFK%7C0%7C0%7C1797420300000%2C%23AA%7C94%7CI%7CJFK%7CMAD%7C1794444300000%7C0%23AA%7C8727%7CI%7CMAD%7CBCN%7C1794475500000%7C0%23AA%7C67%7CI%7CBCN%7CJFK%7C1797420300000%7C1',
};

/** Example 3 — four segments, all codeshares, two slices. */
export const EX3 = {
  text: sample3.text,
  url: 'https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA1S0C0I0Y0L0%2C0%2CEWR%2C0%2CFRA%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0.00%2C1%2C%23EWR%7CFRA%7C0%7C0%7C1794353400000%23FRA%7CJFK%7C0%7C0%7C1797402000000%2C%23AA%7C6943%7CR%7CEWR%7CLHR%7C1794353400000%7C0%23AA%7C7123%7CJ%7CLHR%7CFRA%7C1794383100000%7C0%23AA%7C6842%7CI%7CFRA%7CLHR%7C1797402000000%7C1%23AA%7C6936%7CI%7CLHR%7CJFK%7C1797413700000%7C1',
};

export const SAMPLES = EXAMPLES;
