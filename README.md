# El 3asool Scoop · العسول سكوب

**GDS itinerary → aa.com metasearch deep link.** Paste the lines you already have in Sabre, get
the `aa.com/goto/metasearch?ITEN=…` hand-off that opens those exact flights — with **one booking
class per segment**, so mixed-cabin itineraries that aa.com's own multi-city form refuses to build
still open in one click.

```
1 AA 142 10NOV JFK LHR 1010A 1010P 777 7.00 0 N  CABIN-BUSINESS
2 AA 6930 16DEC LHR JFK 820A 1120A 777 8.00 0 N  CABIN-BUSINESS
*LHR-JFK OPERATED BY BRITISH AIRWAYS

<--additional-->
1 AA 142I 10NOV
2 AA 6930I 16DEC
```

…becomes

```
https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA1S0C0I0Y0L0%2C0%2CJFK…
```

No server, no API keys, no account. Everything runs in the browser.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 66 tests: golden links, parser, passengers, codeshares, render
npm run build      # static site in dist/
```

Deploy `dist/` anywhere that serves files (Vercel, Netlify, GitHub Pages, S3, nginx). `vite.config.ts`
uses `base: './'`, so a sub-path deployment works without changes.

---

## What it actually does

1. **Parses** the pasted lines: carrier, flight number, booking class, airports, date, local
   departure/arrival times, “operated by” notes — plus the `<--additional-->` block, which is where
   the real booking classes usually live.
2. **Pins every departure to UTC** using that airport's own IANA timezone (DST included). This one
   millisecond timestamp per segment is what makes aa.com land on the exact flight. Nothing else
   identifies it.
3. **Groups the segments into slices** (“directions”). A stay longer than 24 h, a different airport,
   or a return to where the slice began starts a new slice. Every break can be overridden by hand.
4. **Builds the envelope** — 21 comma-separated fields, percent-encoded — and hands you the link,
   a copy button, and a field-by-field decoder of what you are about to send.

Every field in the itinerary is editable, which is the point: change a class letter from `I` to `Y`
on the return and the link follows. That is how you assemble a cabin mix the airline's own search
will not offer.

---

## Input it understands

Anything containing a date token, two airport codes and a departure time. In practice:

| Shape | Example |
| --- | --- |
| Availability / itinerary dump | `1 AA 142 10NOV JFK LHR 1010A 1010P 777 7.00 0 N CABIN-BUSINESS` |
| Sabre sell line (glued city pair, `*SS2`, `/DCAA`) | `1 AA 763I 31DEC Q MUCCLT*SS2 1020A 245P /DCAA /E` |
| Class before the date, 24 h clock | `AA 100 J 01DEC JFK LHR 1900 0700+1` |
| Class glued to the flight number | `2 AA 6930I 16DEC LHR JFK 820A 1120A` |
| Additional block | `1 AA 142I 10NOV` |
| Operating carrier note | `*LHR-JFK OPERATED BY BRITISH AIRWAYS` · `*JFK-LHR OPERATED BY /BA CABIN-BUSINESS` · `*LHR-JFK OPERATED BY BA 178` |
| Slice break | a line of `---`, or `new direction` |

Handled gracefully: `¥1` / `+1` overnight markers, 3-digit times (`745P`), `12A`/`12P`, `NOV26`
and `2026-11-10` dates, `*SS2` sell counters, slash codes, parenthetical notes, blank lines, and the
`&lt;--additional--&gt;` variant you get when the itinerary was pasted through chat or email.

Dates and times in the editor are GDS notation — `10NOV`, `10NOV27`, `1945`, `745P` — rather than
native pickers, so a 24-hour time never turns into `10:10 PM` and `10NOV` never turns into `11/10`.

Anything the parser gets wrong you fix in the table — the parser is a convenience, not a gate.

---

## The link, in one paragraph

`https://www.aa.com/goto/metasearch?ITEN=` + `encodeURIComponent(envelope)`.

```
DIRECT,0,US,multi,4,A1S0C0I0Y0L0,0,JFK,0,LHR,0,0,0,0,0,0,0,0.00,1,
#JFK|LHR|0|0|1794323400000#LHR|JFK|0|0|1797409200000,
#AA|142|I|JFK|LHR|1794323400000|0#AA|6930|I|LHR|JFK|1797409200000|1
```

* `DIRECT` — hand-off vendor (`GOOGLE` when the click came from Google Flights).
* `US` — point of sale; `multi` — trip type; `4` — constant in every recorded link.
* `A1S0C0I0Y0L0` — adults / seniors / children / infants / youth / lap infants (see
  [Passengers](#passengers)).
* `JFK`, `LHR` — first origin and first-slice destination.
* `0.00` — carried price; AA re-prices regardless.
* `#FROM|TO|0|0|DEP_UTC_MS` — one per slice.
* `#CARRIER|FLIGHT|CLASS|FROM|TO|DEP_UTC_MS|SLICE_INDEX` — every segment, **class included**.

Full field table, the three verified reference links and the unknowns: **[docs/LINK-FORMAT.md](docs/LINK-FORMAT.md)**.
You can also decode any link inside the app — **Inspect a link** in the header.

---

---

## Passengers

The passenger mix travels in field 5 as `A{a}S{s}C{c}I{i}Y{y}L{l}` — adults, seniors (65+),
children (2–11), infants in a seat, youth (12–17) and lap infants (under 2). The counters sit in
the link panel, the code is shown as you change it, and it is the only field in the envelope that
passengers touch:

```
A1S0C0I0Y0L0   1 adult
A2S0C0I0Y0L0   2 adults
A2S0C1I0Y0L1   2 adults, 1 child, 1 lap infant
```

Nine travellers is the ceiling for one aa.com search, so the builder refuses ten, refuses zero,
and warns when infants outnumber adults (one per adult, the way aa.com counts them).

---

## Codeshares — “operated by”

A GDS row writes the **marketing** carrier (who sold the seat); the footnote writes the
**operating** carrier (whose aircraft it is). aa.com's hand-off carries one carrier + flight
number per segment, and it can only resolve the numbers on its own shelf:

| What the row says | Resolves on aa.com? | What the tool does |
| --- | --- | --- |
| `AA 6930` operated by BA | always | hands off `AA 6930` — an AA codeshare is exactly right |
| `BA 482`, `EI 105`, `AS 1342` — partner prime | usually | hands it off as marketed, notes the carriers |
| `EI 8812` operated by BA — partner codeshare of partner metal | rarely | **warns**, and lets you send the operating flight instead |
| `LH 400`, `AF 23` — no AA relationship | no | warns that aa.com does not price that carrier |

The footnote grammar is wider than it looks — all of these are read:

```
*LHR-JFK OPERATED BY BRITISH AIRWAYS
*JFK-LHR OPERATED BY /BA CABIN-BUSINESS
*LHR-JFK OPERATED BY BA 178
OPERATED BY: British Airways.
*OP BY IBERIA
```

When aa.com answers “we couldn't find that flight”, the fix is almost always the number, not the
link. Open the row → **Send the operating flight**, type the operating carrier and its prime
number (or the AA codeshare) and the envelope carries that instead — same timestamp, same class,
same slice, only field 20's carrier and flight change.

---

## Honest limits

* **This is a hand-off, not a hold.** aa.com re-prices on arrival and can still refuse a
  combination at the fare step. No inventory is created or reserved.
* **The number has to be one aa.com carries.** `AA 6930` (AA codeshare, BA metal) always works,
  and oneworld/partner prime numbers (`BA 176`, `EI 105`, `AS 1342`) usually do. What does **not**
  resolve is a partner's codeshare of another partner's metal — `EI 8812` on BA aircraft is
  invisible to aa.com's schedule. The tool flags those rows and lets you send the operating flight
  (or the AA codeshare) instead. See [Codeshares](#codeshares--operated-by).
* **Availability still rules.** The class must be open on that date.
* **Coverage.** 8,729 airports with IANA zones. An unknown code can still be used — set its
  timezone by hand in the segment's details.
* **Not affiliated with American Airlines.** Use it for itineraries you are entitled to sell.

---

## Project layout

```
src/
  lib/
    parse.ts      GDS line grammar → segments (+ additional-block merge)
    slices.ts     absolute times, slice detection, connection checks
    aaLink.ts     envelope builder + decoder + field documentation
    checks.ts     field-level and commercial checks
    analyze.ts    one pass: plan → validate → link
    carriers.ts   carrier directory: names, “will aa.com price it?”, OPERATED BY → code
    airports.ts   lazy airport/timezone table + ranked search
    time.ts       Intl-based IANA math (wall clock → UTC, DST safe)
  components/     UI (paste, itinerary editor, link panel, inspector…)
  __tests__/      golden links, parser cases, render smoke tests
public/
  airports.json   generated from OpenTravelData (see below)
scripts/
  build-airports.mjs
docs/
  LINK-FORMAT.md  the reverse-engineered envelope
```

### Airport data

`public/airports.json` is generated from
[OpenTravelData](https://github.com/opentraveldata/opentraveldata)'s `optd_por_public.csv`
(open data) — IATA code, name, city, country and IANA timezone for every airport with a scheduled
code. Regenerate with:

```bash
npm run data:airports                     # downloads the current CSV
npm run data:airports -- --file optd.csv  # or use a local copy
```

Timezones are applied with the browser's `Intl` database, so DST transitions are handled by the
platform rather than a hard-coded table.

---

## Tests

```
src/__tests__/aaLink.test.ts    three golden links, byte-exact, plus decoder + validation
src/__tests__/passengers.test.ts  passenger mix → field 5, incl. a recorded two-adult link
src/__tests__/codeshare.test.ts   OPERATED BY grammar, codeshare checks, operating-flight swap
src/__tests__/parse.test.ts     token grammar, additional block, year inference, slices, DST
src/__tests__/render.test.tsx   server-render smoke tests for every panel
```

The golden tests are the contract: the three reference itineraries in `src/lib/samples.ts` must
produce the exact URLs recorded in `src/__tests__/fixtures.ts`, character for character — and the
two-adult link (`EX2_TWO_ADULTS_URL`) must differ from the single-adult one in field 5 alone.
