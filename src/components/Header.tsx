import { BookOpen, PlaneTakeoff, ScanSearch } from 'lucide-react';
import { Button } from './ui';

export function Header({ onInspect }: { onInspect: () => void }) {
  return (
    <header className="flex flex-wrap items-center gap-3 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 shadow-[0_10px_24px_-10px_rgba(247,201,72,0.7)]">
          <PlaneTakeoff
            className="h-[18px] w-[18px] -rotate-[12deg] text-[#1a1200]"
            strokeWidth={2.4}
          />
        </div>
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight text-ink">
            El 3asool Scoop
            <span className="rounded-full border border-line-2 bg-panel-2 px-1.5 py-[1px] font-mono text-[9px] font-normal tracking-normal text-faint">
              AA
            </span>
          </h1>
          <p className="truncate text-[10.5px] text-muted">
            GDS itineraries → aa.com metasearch deep links
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onInspect}>
          <ScanSearch className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Inspect a link</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            document.getElementById('how')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">How it works</span>
        </Button>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <div className="max-w-[640px] pb-5">
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[26px]">
        One link. <span className="text-gold-300">Any cabin mix.</span>
      </h2>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted sm:text-[12.5px]">
        Paste the itinerary from your GDS and get the aa.com hand-off that opens those exact
        flights — a class per segment, so the mixed-cabin itineraries AA's own form will not build
        still open in one click.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['8,700+ airports with timezones', 'DST-correct', 'class per segment', 'no server'].map(
          (item) => (
            <span
              key={item}
              className="rounded-full border border-line bg-panel-2/70 px-2.5 py-[3px] text-[10px] text-faint"
            >
              {item}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
