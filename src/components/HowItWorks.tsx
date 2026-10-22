import { Braces, Clock3, Link2, PlaneTakeoff, TriangleAlert } from 'lucide-react';
import { ITEN_FIELD_DOCS } from '../lib/aaLink';
import { Card } from './ui';

const STEPS = [
  {
    icon: PlaneTakeoff,
    title: 'Paste the GDS lines',
    body:
      'Availability, a sell dump, or the “additional” block with the booking classes. Carrier, flight, class, airports and local times are pulled out line by line — anything it cannot read stays editable.',
  },
  {
    icon: Clock3,
    title: 'Local time → UTC',
    body:
      'Every departure is converted with that airport’s own IANA zone, DST included. This millisecond timestamp is the only thing AA uses to pin a flight, so getting it right is the whole trick.',
  },
  {
    icon: Link2,
    title: 'One ITEN envelope',
    body:
      'Slices, then every segment with its own class, then percent-encoding. Passengers ride along in field 5 (A2S0C0I0Y0L0 for a couple), nine seats at most. aa.com reads it as a completed search — no form filling, no “choose your cabin” filter to fight.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mt-10 scroll-mt-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-400/80">
            How it works
          </p>
          <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-ink">
            The link is just a search that already knows the answer
          </h2>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <Card key={step.title} className="p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-gold-400/20 bg-gold-400/[0.08]">
                <step.icon className="h-3.5 w-3.5 text-gold-300" />
              </span>
              <span className="font-mono text-[10px] text-faint">0{i + 1}</span>
            </div>
            <h3 className="text-[12.5px] font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{step.body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-[12.5px] font-semibold text-ink">Why a mixed cabin survives</h3>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            AA's own multi-city form prices a trip from one cabin filter. The metasearch hand-off
            does not: it carries a{' '}
            <span className="font-mono text-[10.5px] text-gold-300">class</span> per segment, so a
            J out and a Y back can travel in the same envelope. Change any letter in the itinerary
            above and the link follows — that is the whole reason this tool exists.
          </p>
          <div className="mt-3 rounded-lg border border-line bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-faint">
            <div>
              <span className="text-faint/60">#</span>AA|142|<span className="text-gold-300">I</span>
              |JFK|LHR|1794323400000|<span className="text-sky-300">0</span>
            </div>
            <div>
              <span className="text-faint/60">#</span>AA|6930|<span className="text-gold-300">I</span>
              |LHR|JFK|1797409200000|<span className="text-sky-300">1</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-3.5 w-3.5 text-amber-400" />
            <h3 className="text-[12.5px] font-semibold text-ink">What it does not do</h3>
          </div>
          <ul className="mt-1.5 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>
              <span className="text-ink/80">It is a hand-off, not a hold.</span> aa.com re-prices
              the itinerary on arrival and can still refuse a combination at the fare step.
            </li>
            <li>
              <span className="text-ink/80">It can only send numbers aa.com carries.</span> AA
              codeshares and partner prime flights resolve; a partner's codeshare of another
              partner's metal (EI 8812 on BA aircraft) usually does not — the tool flags those
              rows, and you can hand off the operating flight instead.
            </li>
            <li>
              <span className="text-ink/80">Availability still rules.</span> The class must be open
              for sale on the date; the link cannot invent inventory.
            </li>
          </ul>
        </Card>
      </div>

      <Card className="mt-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[12px] font-medium text-muted transition-colors hover:text-ink">
            <Braces className="h-3.5 w-3.5 text-gold-300" />
            The envelope, field by field
            <span className="ml-auto text-[10px] text-faint group-open:hidden">open</span>
            <span className="ml-auto hidden text-[10px] text-faint group-open:inline">close</span>
          </summary>
          <div className="border-t border-line/70 px-4 py-3">
            <p className="mb-2 text-[10.5px] leading-relaxed text-faint">
              Twenty-one comma-separated fields. Everything the booking engine needs is in the last
              two — the rest is context and constants. Values marked{' '}
              <span className="text-faint/70">constant</span> have been identical in every working
              link we have seen.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <tbody>
                  {ITEN_FIELD_DOCS.map((doc) => (
                    <tr key={doc.index} className="border-b border-line/50 last:border-0">
                      <td className="w-6 py-1 font-mono text-[9.5px] text-faint/70">
                        {String(doc.index).padStart(2, '0')}
                      </td>
                      <td className="w-[130px] py-1 pr-2 text-[10.5px] text-ink/85">{doc.label}</td>
                      <td className="py-1 text-[10.5px] leading-snug text-faint">{doc.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </Card>
    </section>
  );
}
