import { ExternalLink, Settings2, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { useState } from 'react';
import { AA_METASEARCH_BASE, passengerCode } from '../lib/aaLink';
import type { Analysis } from '../lib/analyze';
import { cn } from '../lib/cn';
import type { BuildOptions, PassengerCounts } from '../lib/types';
import { Badge, Button, Card, CardHead, CopyButton, IconButton } from './ui';

interface Props {
  analysis: Analysis;
  options: BuildOptions;
  onOptionsChange: (patch: Partial<BuildOptions>) => void;
}

/** The six passenger buckets AA's envelope carries, in the order it carries them. */
const PAX_FIELDS: { key: keyof PassengerCounts; label: string; hint: string }[] = [
  { key: 'adults', label: 'Adults', hint: '12 and over' },
  { key: 'seniors', label: 'Seniors', hint: '65 and over' },
  { key: 'children', label: 'Children', hint: '2–11' },
  { key: 'youth', label: 'Youth', hint: '12–17' },
  { key: 'infants', label: 'Infants', hint: 'In a seat — one per adult' },
  { key: 'lap', label: 'Lap infants', hint: 'Under 2 on a lap' },
];

function Counter({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div
      title={hint}
      className="flex items-center justify-between gap-1 rounded-md border border-line bg-panel-2 px-1.5 py-1"
    >
      <span className="truncate text-[10px] text-muted">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          className="grid h-4 w-4 place-items-center rounded border border-line-2 text-[10px] text-muted transition-colors hover:bg-panel-3 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          −
        </button>
        <span
          className={cn(
            'w-3.5 text-center font-mono text-[11px]',
            value > 0 ? 'text-ink' : 'text-faint/60',
          )}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(9, value + 1))}
          className="grid h-4 w-4 place-items-center rounded border border-line-2 text-[10px] text-muted transition-colors hover:bg-panel-3 hover:text-ink"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function LinkPanel({ analysis, options, onOptionsChange }: Props) {
  const [showOptions, setShowOptions] = useState(false);
  const { link, counts, canBuild } = analysis;
  const pax = options.passengers;

  const setPax = (key: keyof PassengerCounts, value: number) =>
    onOptionsChange({ passengers: { ...pax, [key]: value } });

  const totalPax = Object.values(pax).reduce((a, b) => a + b, 0);

  const open = () => {
    if (!link.url) return;
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <CardHead
        step="03"
        title="The aa.com link"
        subtitle="A single hand-off that opens all flights, class by class."
        right={
          <IconButton
            label="Link options"
            onClick={() => setShowOptions((v) => !v)}
            className={cn(showOptions && 'border-line-2 bg-panel-3 text-ink')}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </IconButton>
        }
      />

      <div className="space-y-3 p-3">
        {canBuild ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-emerald-200">Ready to hand off</p>
              <p className="text-[10.5px] leading-snug text-emerald-200/60">
                {analysis.plan.slices.length} slice{analysis.plan.slices.length === 1 ? '' : 's'} ·{' '}
                {analysis.plan.items.length} segment
                {analysis.plan.items.length === 1 ? '' : 's'} · {totalPax} passenger
                {totalPax === 1 ? '' : 's'}
                {analysis.plan.mixedCabin ? ' · mixed cabin' : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-2.5 py-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-red-200">
                {counts.error} blocker{counts.error === 1 ? '' : 's'} to clear
              </p>
              <p className="text-[10.5px] leading-snug text-red-200/60">
                Fix the red items below — AA needs every flight, class and local time.
              </p>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-line bg-black/40">
          <div className="flex items-center gap-1.5 border-b border-line/70 px-2 py-1">
            <span className="font-mono text-[9.5px] text-faint">GET</span>
            <span className="truncate font-mono text-[9.5px] text-faint">
              aa.com/goto/metasearch?ITEN=…
            </span>
            <span className="ml-auto font-mono text-[9.5px] text-faint/70">
              {link.url.length.toLocaleString()} chars
            </span>
          </div>
          <div className="max-h-[168px] overflow-auto p-2">
            {link.url ? (
              <code className="block break-all font-mono text-[10px] leading-relaxed text-muted">
                <span className="text-faint/70">{AA_METASEARCH_BASE}</span>
                <span className="text-ink/85">
                  {link.url.slice(AA_METASEARCH_BASE.length)}
                </span>
              </code>
            ) : (
              <span className="text-[11px] text-faint">The link appears here once it validates.</span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel-2/50 p-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Users className="h-3 w-3 text-faint" />
            <span className="text-[9.5px] uppercase tracking-[0.14em] text-faint">
              Passengers
            </span>
            <span className="ml-auto font-mono text-[9.5px] text-faint">
              <span className={cn(totalPax > 9 && 'text-red-300')}>{totalPax}</span>/9 ·{' '}
              <span className="text-muted">{passengerCode(options)}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {PAX_FIELDS.map((field) => (
              <Counter
                key={field.key}
                label={field.label}
                hint={field.hint}
                value={pax[field.key]}
                onChange={(value) => setPax(field.key, value)}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[9.5px] leading-snug text-faint">
            Field 5 of the envelope — {passengerCode(options)}. aa.com caps one search at nine
            travellers.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="primary" className="flex-1" onClick={open} disabled={!canBuild}>
            <ExternalLink className="h-3.5 w-3.5" /> Open on aa.com
          </Button>
          <CopyButton value={link.url} disabled={!canBuild} className="shrink-0" />
        </div>

        {showOptions && (
          <div className="space-y-2 rounded-lg border border-line bg-panel-2/60 p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block">
                <span className="mb-1 block text-[9.5px] uppercase tracking-wider text-faint">
                  Source
                </span>
                <select
                  value={options.source}
                  onChange={(event) => onOptionsChange({ source: event.target.value })}
                  className="h-7 w-full rounded-md border border-line bg-panel-3 px-1.5 text-[11px] text-ink [color-scheme:dark]"
                >
                  <option value="DIRECT">DIRECT</option>
                  <option value="GOOGLE">GOOGLE</option>
                  <option value="KAYAK">KAYAK</option>
                  <option value="SKYSCANNER">SKYSCANNER</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[9.5px] uppercase tracking-wider text-faint">
                  Point of sale
                </span>
                <select
                  value={options.posCountry}
                  onChange={(event) => onOptionsChange({ posCountry: event.target.value })}
                  className="h-7 w-full rounded-md border border-line bg-panel-3 px-1.5 text-[11px] text-ink [color-scheme:dark]"
                >
                  {['US', 'GB', 'CA', 'EG', 'AE', 'SA', 'FR', 'DE', 'ES', 'IT', 'QA', 'JO'].map(
                    (country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-panel-2 px-2 py-1">
              <div>
                <p className="text-[10.5px] text-muted">Carried price</p>
                <p className="text-[9.5px] text-faint">Display only — AA re-prices.</p>
              </div>
              <input
                value={options.price}
                onChange={(event) => onOptionsChange({ price: event.target.value })}
                className="h-6 w-[70px] rounded border border-line bg-panel-3 px-1.5 text-right font-mono text-[11px] text-ink focus:border-gold-400/50 focus:outline-none"
              />
            </div>
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-faint">
          This opens aa.com's booking flow with the exact flights and classes above. AA re-prices
          everything on arrival — the link is a hand-off, not a held fare.
        </p>

        {analysis.plan.mixedCabin && (
          <div className="flex items-center gap-1.5">
            <Badge tone="violet">mixed cabin</Badge>
            <span className="text-[10px] text-faint">
              one link, {new Set(analysis.plan.items.map((i) => i.segment.cabin)).size} cabins
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
