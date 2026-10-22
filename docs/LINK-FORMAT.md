# The aa.com metasearch hand-off, field by field

This is the note that explains why the tool works. It was derived from public, working
`aa.com/goto/metasearch?ITEN=…` links (three of them are reproduced at the bottom and pinned as
golden tests) and cross-checked against community implementations. No private API is involved — the
whole thing is a URL.

---

## 1. Shape

```
https://www.aa.com/goto/metasearch?ITEN=<url-encoded envelope>
```

The envelope is 21 comma-separated fields, joined with `,` and encoded with
`encodeURIComponent()`. That produces exactly the encoding AA emits:

| character | encoded |
| --- | --- |
| `,` | `%2C` |
| `#` | `%23` |
| `\|` | `%7C` |

Letters, digits, `.` and `-` are left alone. `#` is the record separator *inside* a field, which is
why the `#` shows up as `%23` rather than starting a URL fragment.

## 2. Fields

| # | Meaning | Status | Notes |
| --- | --- | --- | --- |
| 0 | Source / vendor | known | `DIRECT` in AA's own links; `GOOGLE` when the click came from Google Flights. |
| 1 | — | constant | `0` in every recorded link. |
| 2 | Point of sale | known | Country whose AA storefront prices the trip (`US`). |
| 3 | Trip type | known | `multi` (or `oneWay`). |
| 4 | Search constant | constant | Always `4`, even for one-way links. Not the number of slices. |
| 5 | Passenger mix | known | `A{a}S{s}C{c}I{i}Y{y}L{l}` — adults, seniors, children, infants, youth, lap. |
| 6 | — | constant | `0`. |
| 7 | First origin | known | Departure airport of the whole trip. |
| 8 | — | constant | `0`. |
| 9 | First-slice destination | known | Where the first slice ends, not the end of the trip. |
| 10–16 | — | constant | `0` in every recorded link. |
| 17 | Price | known | Fare figure carried for display (`0.00` is accepted). AA re-prices. |
| 18 | Constant tail | constant | Always `1`. |
| 19 | Slices | known | See below. |
| 20 | Segments | known | See below. |

Fields 1, 6, 8, 10–16 and 18 never varied in any link examined. They are treated as constants and
exposed nowhere in the UI.

## 3. Slices (field 19)

One record per direction, concatenated with no separator:

```
#FROM|TO|0|0|DEP_UTC_MS
```

`FROM` is the origin of the slice's first segment, `TO` the destination of its last, and
`DEP_UTC_MS` the **departure instant of the first segment**. The two zeroes were `0` in every link
seen.

## 4. Segments (field 20)

Every physical flight, concatenated with no separator:

```
#CARRIER|FLIGHT|CLASS|FROM|TO|DEP_UTC_MS|SLICE_INDEX
```

* `CARRIER` — the **marketing** carrier (2 characters). An AA codeshare stays `AA` even when the
  operating carrier is BA.
* `CLASS` — a single booking letter. This is the field that makes mixed cabins possible.
* `SLICE_INDEX` — 0-based index into field 19.

## 5. The timestamp rule

`DEP_UTC_MS` is the epoch milliseconds of the **local departure time at the departure airport**,
converted to UTC. That is the whole trick, and the only thing AA uses to pin a flight.

Example, from the EWR–FRA itinerary:

| local departure | airport zone | UTC instant | epoch ms |
| --- | --- | --- | --- |
| 10 Nov 2026, 18:30 | `America/New_York` (EST, UTC−5) | 10 Nov 23:30Z | `1794353400000` |
| 11 Nov 2026, 07:45 | `Europe/London` (GMT, UTC+0) | 11 Nov 07:45Z | `1794383100000` |
| 16 Dec 2026, 07:20 | `Europe/Berlin` (CET, UTC+1) | 16 Dec 06:20Z | `1797402000000` |
| 16 Dec 2026, 09:35 | `Europe/London` (GMT, UTC+0) | 16 Dec 09:35Z | `1797413700000` |

Get this wrong by even one hour of DST and the hand-off lands on a neighbouring flight or on
nothing at all. The app computes it with `Intl.DateTimeFormat` in the browser, so the platform's
IANA database (not a hard-coded offset table) decides the DST rules.

> Airports in the same country can differ: `America/Phoenix` has no DST, `Europe/London` and
> `Europe/Dublin` are not on the same dates as the rest of Europe, and `Africa/Cairo` reintroduced
> DST in 2023. All of that is handled for free by using IANA names.

## 6. Worked example

Input (two slices, four segments, all AA codeshares operated by BA):

```
1 AA 6943 10NOV EWR LHR 630P 630A¥1 777 7.00 0 N  CABIN-BUSINESS
2 AA 7123 11NOV LHR FRA 745A 1025A 320 1.40 0 N  CABIN-BUSINESS
3 AA 6842 16DEC FRA LHR 720A 820A 319 2.00 0 N  CABIN-BUSINESS
4 AA 6936 16DEC LHR JFK 935A 1235P 777 8.00 0 N  CABIN-BUSINESS

<--additional-->
1 AA 6943R 10NOV
2 AA 7123J 11NOV
3 AA 6842I 16DEC
4 AA 6936I 16DEC
```

Decoded envelope:

```
field 0  DIRECT
field 2  US
field 3  multi
field 5  A1S0C0I0Y0L0
field 7  EWR
field 9  FRA
field 17 0.00
field 19 #EWR|FRA|0|0|1794353400000 #FRA|JFK|0|0|1797402000000
field 20 #AA|6943|R|EWR|LHR|1794353400000|0
         #AA|7123|J|LHR|FRA|1794383100000|0
         #AA|6842|I|FRA|LHR|1797402000000|1
         #AA|6936|I|LHR|JFK|1797413700000|1
```

Note the classes: `R`, `J`, `I`, `I` — four different business fares in one envelope. That is the
mixed-cabin hand-off in practice.

## 7. Reference links (golden)

These three are asserted byte-for-byte in `src/__tests__/aaLink.test.ts`.

**1 — JFK/LHR round trip**

```
https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA1S0C0I0Y0L0%2C0%2CJFK%2C0%2CLHR%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0.00%2C1%2C%23JFK%7CLHR%7C0%7C0%7C1794323400000%23LHR%7CJFK%7C0%7C0%7C1797409200000%2C%23AA%7C142%7CI%7CJFK%7CLHR%7C1794323400000%7C0%23AA%7C6930%7CI%7CLHR%7CJFK%7C1797409200000%7C1
```

**2 — JFK–MAD–BCN outbound, BCN–JFK back**

```
https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA1S0C0I0Y0L0%2C0%2CJFK%2C0%2CBCN%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0.00%2C1%2C%23JFK%7CBCN%7C0%7C0%7C1794444300000%23BCN%7CJFK%7C0%7C0%7C1797420300000%2C%23AA%7C94%7CI%7CJFK%7CMAD%7C1794444300000%7C0%23AA%7C8727%7CI%7CMAD%7CBCN%7C1794475500000%7C0%23AA%7C67%7CI%7CBCN%7CJFK%7C1797420300000%7C1
```

**3 — EWR–LHR–FRA outbound, FRA–LHR–JFK back**

```
https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti%2C4%2CA1S0C0I0Y0L0%2C0%2CEWR%2C0%2CFRA%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0.00%2C1%2C%23EWR%7CFRA%7C0%7C0%7C1794353400000%23FRA%7CJFK%7C0%7C0%7C1797402000000%2C%23AA%7C6943%7CR%7CEWR%7CLHR%7C1794353400000%7C0%23AA%7C7123%7CJ%7CLHR%7CFRA%7C1794383100000%7C0%23AA%7C6842%7CI%7CFRA%7CLHR%7C1797402000000%7C1%23AA%7C6936%7CI%7CLHR%7CJFK%7C1797413700000%7C1
```

## 8. Still unknown

* What fields 1, 6, 8, 10–16 and 18 control. They have been `0` (and `1` for 18) in every recorded
  link, including one-ways and five-slice itineraries. Treating them as constants has not broken
  any link produced by this tool.
* Whether `DIRECT` and `GOOGLE` change attribution only, or also which storefront is used. Both
  open the same itinerary; the tool defaults to `DIRECT` because that is what the reference links
  use.
* The maximum number of slices. The AA form exposes five; the builder refuses more.
* Whether the carried price (field 17) influences anything beyond display. `0.00` works.

If you learn more, the field table lives in `src/lib/aaLink.ts` (`ITEN_FIELD_DOCS`) and the docs
panel in the app reads straight from it.
