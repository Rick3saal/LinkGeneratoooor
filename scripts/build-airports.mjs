#!/usr/bin/env node
/**
 * Regenerate public/airports.json from OpenTravelData.
 *
 *   npm run data:airports                     # downloads the current CSV
 *   npm run data:airports -- --file optd.csv  # uses a local copy
 *
 * Source: https://github.com/opentraveldata/opentraveldata
 * (optd_por_public.csv — open data, CC-BY).
 *
 * Output shape (compact on purpose, ~390 kB raw / ~145 kB gzipped):
 *   { "tz": ["America/New_York", …], "cc": ["US", …],
 *     "a": { "JFK": ["John F. Kennedy International", "New York City", 219, 144] } }
 * where the two numbers index into `cc` and `tz`.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE =
  'https://api.github.com/repos/opentraveldata/opentraveldata/contents/opentraveldata/optd_por_public.csv';
const DELIMITER = '^';

const args = process.argv.slice(2);
const fileFlag = args.indexOf('--file');
const localFile = fileFlag >= 0 ? args[fileFlag + 1] : null;

async function loadCsv() {
  if (localFile) {
    const { readFileSync } = await import('node:fs');
    return readFileSync(resolve(localFile), 'utf8');
  }
  console.log('Downloading optd_por_public.csv …');
  const response = await fetch(SOURCE, {
    headers: {
      Accept: 'application/vnd.github.raw',
      'User-Agent': 'el-3asool-scoop',
    },
  });
  if (!response.ok) {
    throw new Error(
      `Download failed (${response.status}). Pass a local copy with --file <path>.`,
    );
  }
  return response.text();
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(DELIMITER);
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  return { lines, index };
}

const csv = await loadCsv();
const { lines, index } = parseCsv(csv);

const pick = (cells, name) => (cells[index[name]] ?? '').trim();

const best = new Map();
for (let i = 1; i < lines.length; i += 1) {
  const cells = lines[i].split(DELIMITER);
  const code = pick(cells, 'iata_code');
  if (code.length !== 3 || !/^[A-Z]{3}$/.test(code)) continue;
  if (pick(cells, 'fcode') !== 'AIRP') continue;
  const tz = pick(cells, 'timezone');
  if (!tz) continue;

  const rank = Number(pick(cells, 'page_rank')) || 0;
  const current = best.get(code);
  if (!current || rank > current.rank) {
    const name = pick(cells, 'name').replace(/\s+Airport$/, '');
    const city = (pick(cells, 'city_name_list').split('|')[0] || '').trim();
    best.set(code, { rank, name, city, country: pick(cells, 'country_code'), tz });
  }
}

const timezones = [...new Set([...best.values()].map((a) => a.tz))].sort();
const countries = [...new Set([...best.values()].map((a) => a.country))].sort();
const tzIndex = new Map(timezones.map((tz, i) => [tz, i]));
const ccIndex = new Map(countries.map((cc, i) => [cc, i]));

const airports = {};
for (const [code, airport] of [...best.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  airports[code] = [
    airport.name,
    airport.city,
    ccIndex.get(airport.country),
    tzIndex.get(airport.tz),
  ];
}

const payload = { tz: timezones, cc: countries, a: airports };
const output = resolve('public/airports.json');
writeFileSync(output, JSON.stringify(payload));

console.log(
  `${Object.keys(airports).length} airports · ${timezones.length} timezones · ${countries.length} countries`,
);
console.log(`written to ${output}`);
