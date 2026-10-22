import { ClipboardPaste, Eraser, FileText, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/cn';
import type { ParseStats } from '../lib/parse';
import { EXAMPLES, EXAMPLE_LABELS } from '../lib/samples';
import { Button, Card, CardHead } from './ui';

interface Props {
  text: string;
  onTextChange: (value: string) => void;
  stats: ParseStats | null;
  yearOverride: number | null;
  onYearOverride: (year: number | null) => void;
  threshold: number;
  onThreshold: (hours: number) => void;
  resetNotice?: boolean;
  onDismissResetNotice?: () => void;
}

const PLACEHOLDER = `1 AA 142 10NOV JFK LHR 1010A 1010P 777 7.00 0 N  CABIN-BUSINESS
2 AA 6930 16DEC LHR JFK 820A 1120A 777 8.00 0 N  CABIN-BUSINESS
*LHR-JFK OPERATED BY BRITISH AIRWAYS

<--additional-->
1 AA 142I 10NOV
2 AA 6930I 16DEC`;

export function PastePanel({
  text,
  onTextChange,
  stats,
  yearOverride,
  onYearOverride,
  threshold,
  onThreshold,
  resetNotice,
  onDismissResetNotice,
}: Props) {
  const [dragging, setDragging] = useState(false);

  const pasteFromClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (value) onTextChange(value);
    } catch {
      /* clipboard permission denied — the user can still Ctrl+V */
    }
  };

  const thisYear = new Date().getUTCFullYear();

  return (
    <Card className={cn(dragging && 'ring-1 ring-gold-400/50')}>
      <CardHead
        step="01"
        title="Paste the itinerary"
        subtitle="Sabre / Amadeus availability, an itinerary dump, or the “additional” block — all three at once is fine."
        right={
          <Button size="sm" variant="ghost" onClick={() => void pasteFromClipboard()}>
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Paste</span>
          </Button>
        }
      />

      <div className="p-3">
        <div
          className={cn(
            'relative rounded-xl border border-line bg-black/25 transition-colors',
            dragging ? 'border-gold-400/60' : 'focus-within:border-line-2',
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.getData('text/plain');
            if (dropped) onTextChange(dropped);
          }}
        >
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            className={cn(
              'block h-[190px] w-full resize-y rounded-xl bg-transparent px-3 py-2.5',
              'font-mono text-[11.5px] leading-[1.7] text-ink/90 caret-gold-400',
              'placeholder:text-faint/50 focus:outline-none',
            )}
          />
          {!text && (
            <span className="pointer-events-none absolute right-3 top-2.5 text-[10px] uppercase tracking-wider text-faint/60">
              drop a file or paste
            </span>
          )}
        </div>

        {resetNotice && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1.5">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
            <p className="flex-1 text-[10.5px] leading-snug text-amber-200/85">
              Re-read from the text you just edited — the changes you made in the table below were
              reset. Paste last, then adjust rows.
            </p>
            <button
              type="button"
              onClick={onDismissResetNotice}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 text-amber-300/60 transition-colors hover:text-amber-200"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-[0.14em] text-faint">Examples</span>
          {EXAMPLES.map((example, index) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onTextChange(example.text)}
              className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-gold-400/40 hover:text-gold-200"
            >
              <FileText className="h-3 w-3 text-faint group-hover:text-gold-300" />
              {index + 1}. {EXAMPLE_LABELS[index]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onTextChange('')}>
              <Eraser className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2">
          <p className="text-[10.5px] text-faint">
            {stats
              ? `${stats.segments} segment${stats.segments === 1 ? '' : 's'} · ${
                  stats.additionalEntries
                } additional ${stats.additionalEntries === 1 ? 'entry' : 'entries'}${
                  stats.skipped ? ` · ${stats.skipped} line(s) skipped` : ''
                }`
              : 'Waiting for input'}
          </p>
          <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-1.5 text-[10.5px] text-faint">
            New slice after
            <select
              value={threshold}
              onChange={(event) => onThreshold(Number(event.target.value))}
              className="h-6 rounded-md border border-line bg-panel-2 px-1 text-[10.5px] text-muted [color-scheme:dark] hover:border-line-2 focus:outline-none"
              title="A stay longer than this starts a new slice (a new 'direction' in AA's envelope)."
            >
              {[6, 12, 24, 48].map((hours) => (
                <option key={hours} value={hours}>
                  {hours}h
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[10.5px] text-faint">
            Year
            <select
              value={yearOverride ?? ''}
              onChange={(event) =>
                onYearOverride(event.target.value ? Number(event.target.value) : null)
              }
              className="h-6 rounded-md border border-line bg-panel-2 px-1 text-[10.5px] text-muted [color-scheme:dark] hover:border-line-2 focus:outline-none"
              title="Bare dates like 10NOV get the next occurrence of that day. Pin a year here if you need to."
            >
              <option value="">auto</option>
              {[thisYear, thisYear + 1, thisYear + 2].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          </div>
        </div>
      </div>
    </Card>
  );
}
