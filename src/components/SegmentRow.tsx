import { ChevronDown, MoveDown, MoveUp, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { COMMON_TIMEZONES } from '../lib/airports';
import { ALL_CLASSES, CABINS, CABIN_META } from '../lib/classes';
import { carrierName, looksLikeCodeshareNumber } from '../lib/carriers';
import { cn } from '../lib/cn';
import type { SliceItem } from '../lib/slices';
import { parseDateToken, parseTimeToken } from '../lib/parse';
import { formatDuration, formatShortDate, formatTimezoneLabel, isoDate, pad2 } from '../lib/time';
import type { Segment } from '../lib/types';
import { AirportInput } from './AirportInput';
import { IconButton, Toggle } from './ui';

export const SLICE_COLORS = ['#f7c948', '#60a5fa', '#a78bfa', '#34d399', '#fb7185'];

interface Props {
  item: SliceItem;
  sliceIndex: number;
  onChange: (patch: Partial<Segment>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function InlineInput({
  value,
  onChange,
  width,
  mono,
  type = 'text',
  align = 'left',
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  width: string;
  mono?: boolean;
  type?: 'text' | 'date' | 'time';
  align?: 'left' | 'center';
  ariaLabel: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      type={type}
      value={value}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'rounded-md border border-transparent bg-transparent px-1.5 py-[3px] text-[12px]',
        'text-muted transition-colors hover:border-line-2 hover:bg-panel-3 hover:text-ink',
        'focus:border-gold-400/50 focus:bg-panel-3 focus:text-ink focus:outline-none',
        mono && 'font-mono',
        align === 'center' && 'text-center',
        '[color-scheme:dark]',
      )}
      style={{ width }}
    />
  );
}

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** ISO date → `10NOV26`, the way it is written in a GDS. */
function gdsDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}${MONTH_LABELS[Number(m[2]) - 1] ?? ''}${m[1].slice(2)}`;
}

function gdsTime(hhmm: string): string {
  return hhmm ? hhmm.replace(':', '') : '';
}

/**
 * A text field that reads and writes GDS notation (`10NOV`, `10NOV26`, `2026-11-10`
 * for dates; `2210`, `10:10 PM`, `1010P` for times). The native date/time inputs
 * render in the browser's own locale — this keeps 24-hour times and unambiguous
 * dates no matter where the agent sits.
 */
function GdsField({
  value,
  display,
  parse,
  onCommit,
  width,
  ariaLabel,
  title,
  invalid,
}: {
  value: string;
  display: string;
  parse: (draft: string) => string | null;
  onCommit: (next: string) => void;
  width: string;
  ariaLabel: string;
  title?: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftValid = draft === null || parse(draft) !== null;
  const shown = draft ?? display;

  const commit = () => {
    if (draft === null) return;
    const parsed = parse(draft);
    if (parsed !== null && parsed !== value) onCommit(parsed);
    setDraft(null);
  };

  return (
    <input
      aria-label={ariaLabel}
      title={title}
      value={shown}
      spellCheck={false}
      autoComplete="off"
      onFocus={() => setDraft(display)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit();
          (event.target as HTMLInputElement).blur();
        } else if (event.key === 'Escape') {
          setDraft(null);
          (event.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        'rounded-md border border-transparent bg-transparent px-1.5 py-[3px] text-center',
        'font-mono text-[11.5px] transition-colors hover:border-line-2 hover:bg-panel-3',
        'focus:border-gold-400/50 focus:bg-panel-3 focus:outline-none',
        invalid || !draftValid ? 'text-amber-300' : 'text-muted hover:text-ink focus:text-ink',
      )}
      style={{ width }}
    />
  );
}

function parseDateInput(draft: string): string | null {
  const token = parseDateToken(draft.replace(/\s+/g, '').toUpperCase());
  if (!token) return null;
  const year = token.year ?? new Date().getUTCFullYear() + (token.month < new Date().getUTCMonth() + 1 ? 1 : 0);
  return isoDate(year, token.month, token.day);
}

function parseTimeInput(draft: string): string | null {
  const token = parseTimeToken(draft.trim().toUpperCase());
  if (!token) return null;
  return `${pad2(token.hour)}:${pad2(token.minute)}`;
}

export function SegmentRow({
  item,
  sliceIndex,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: Props) {
  const [expanded, setExpanded] = useState(() => {
    // A partner codeshare with no operating number yet is the one case that
    // needs the user, so those rows open themselves.
    const op = item.segment.operatingCarrier;
    return (
      !!op &&
      !!item.segment.carrier &&
      op.toUpperCase() !== item.segment.carrier.toUpperCase() &&
      item.segment.carrier.toUpperCase() !== 'AA' &&
      !item.segment.operatingFlight
    );
  });
  const s = item.segment;
  const color = SLICE_COLORS[sliceIndex % SLICE_COLORS.length];
  const cabin = CABIN_META[s.cabin];
  const opCode = s.operatingCarrier ?? '';
  const isCodeshare = !!opCode && !!s.carrier && opCode.toUpperCase() !== s.carrier.toUpperCase();
  /** Partner codeshare with no operating number yet — aa.com will likely miss it. */
  const needsOperatingNumber = isCodeshare && s.carrier.toUpperCase() !== 'AA' && !s.operatingFlight;
  const sendingOperating = s.sendAs === 'operating' && !!s.operatingFlight;
  const canSendOperating = !!opCode && !!s.operatingFlight;
  const opLabel = opCode
    ? `${opCode} (${carrierName(opCode)})`
    : (s.operatedBy ?? '').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  const tz = item.tz;
  const offsetLabel = tz && !Number.isNaN(item.depUtc) ? formatTimezoneLabel(tz, item.depUtc) : null;
  const durationLabel =
    !Number.isNaN(item.depUtc) && !Number.isNaN(item.arrUtc) && item.depUtc < item.arrUtc
      ? formatDuration((item.arrUtc - item.depUtc) / 60_000)
      : null;

  return (
    <div
      className={cn(
        'group relative flex rounded-xl border bg-panel-2/50 transition-colors',
        'border-line hover:border-line-2',
        item.newSlice && 'bg-panel-2/80',
      )}
    >
      <div
        className="w-[3px] shrink-0 rounded-l-[11px]"
        style={{ background: color }}
        aria-hidden
      />

      <div className="min-w-0 flex-1 px-1.5 py-1.5">
        {/* main line */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
          <InlineInput
            ariaLabel="Airline code"
            value={s.carrier}
            width="34px"
            mono
            align="center"
            onChange={(value) =>
              onChange({ carrier: value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 2) })
            }
          />
          <InlineInput
            ariaLabel="Flight number"
            value={s.flightNumber}
            width="48px"
            mono
            onChange={(value) => onChange({ flightNumber: value.replace(/[^0-9]/g, '').slice(0, 4) })}
          />

          <select
            aria-label="Booking class"
            value={s.bookingClass}
            onChange={(event) => onChange({ bookingClass: event.target.value })}
            className={cn(
              'h-[26px] w-[46px] cursor-pointer appearance-none rounded-md border px-1.5 text-center',
              'font-mono text-[12px] font-semibold transition-colors [color-scheme:dark]',
              s.bookingClass
                ? 'border-line-2 bg-panel-3 text-ink hover:border-[#33415a]'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300',
            )}
            title={
              s.bookingClass
                ? `Booking class ${s.bookingClass}`
                : 'Missing booking class — AA needs this letter'
            }
          >
            <option value="">–</option>
            {ALL_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          <div className="relative">
            <select
              aria-label="Cabin"
              value={s.cabin}
              onChange={(event) => onChange({ cabin: event.target.value as Segment['cabin'] })}
              className={cn(
                'h-[26px] w-[104px] cursor-pointer appearance-none rounded-md border px-2 pr-5 text-[11px]',
                'font-medium transition-colors [color-scheme:dark]',
              )}
              style={{
                borderColor: `${cabin.hex}44`,
                background: `${cabin.hex}14`,
                color: cabin.hex,
              }}
            >
              {CABINS.map((c) => (
                <option key={c} value={c} className="bg-[#0f141d] text-ink">
                  {CABIN_META[c].label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70"
              style={{ color: cabin.hex }}
            />
          </div>

          <div className="mx-0.5 flex w-full items-center justify-center gap-0.5 rounded-lg border border-line/70 bg-black/20 px-0.5 sm:w-auto sm:justify-start">
            <AirportInput
              label="Origin"
              value={s.origin}
              onChange={(value) => onChange({ origin: value })}
              invalid={!item.tz}
            />
            <span className="text-[11px] text-faint">→</span>
            <AirportInput
              label="Destination"
              value={s.destination}
              onChange={(value) => onChange({ destination: value })}
              align="right"
            />
          </div>

          <div className="ml-auto hidden items-center gap-1 sm:flex">
            {offsetLabel ? (
              <span
                title={`${tz} · ${offsetLabel}`}
                className="hidden items-center rounded-md border border-line bg-panel-3 px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline-flex"
              >
                {offsetLabel}
              </span>
            ) : (
              <span
                title="No timezone for this airport"
                className="hidden items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300 sm:inline-flex"
              >
                <TriangleAlert className="h-2.5 w-2.5" /> TZ
              </span>
            )}
            <IconButton
              label={expanded ? 'Hide details' : 'More options'}
              onClick={() => setExpanded((v) => !v)}
              className={cn(expanded && 'border-line-2 bg-panel-3 text-ink')}
            >
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
              />
            </IconButton>
          </div>
        </div>

        {/* secondary line */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1 pl-0.5">
          <GdsField
            ariaLabel="Departure date"
            title={`${formatShortDate(s.depDate)} — type 10NOV, 10NOV27 or 2026-11-10`}
            value={s.depDate}
            display={gdsDate(s.depDate)}
            parse={(draft) => parseDateInput(draft)}
            onCommit={(next) => onChange({ depDate: next })}
            width="74px"
          />
          <GdsField
            ariaLabel="Departure time"
            title={`${s.depTime || '—'} local — type 2210, 10:10 or 1010P`}
            value={s.depTime}
            display={gdsTime(s.depTime)}
            parse={(draft) => parseTimeInput(draft)}
            onCommit={(next) => onChange({ depTime: next })}
            width="44px"
          />
          <span className="text-[10px] text-faint">→</span>
          <GdsField
            ariaLabel="Arrival time"
            title="Local arrival time — type 0710, 07:10 or 710A"
            value={s.arrTime}
            display={gdsTime(s.arrTime)}
            parse={(draft) => parseTimeInput(draft)}
            onCommit={(next) => onChange({ arrTime: next })}
            width="44px"
          />
          {s.arrDayOffset > 0 && (
            <span className="rounded bg-panel-3 px-1 font-mono text-[10px] text-faint">
              +{s.arrDayOffset}
            </span>
          )}
          {durationLabel && (
            <span className="text-[10.5px] text-faint/80">· {durationLabel}</span>
          )}
          {item.arrEstimated && (
            <span className="text-[10px] text-faint/70" title="Arrival time estimated from the schedule">
              · est.
            </span>
          )}
          {(isCodeshare || s.operatedBy) && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title={
                isCodeshare
                  ? `${s.carrier} ${s.flightNumber} is operated by ${opLabel}. Open the details to send the operating flight instead.`
                  : `Operated by ${opLabel}`
              }
              className={cn(
                'ml-1 rounded px-1.5 py-[1px] text-[10px] ring-1 ring-inset transition-opacity hover:opacity-80',
                needsOperatingNumber
                  ? 'bg-amber-500/10 text-amber-300 ring-amber-500/25'
                  : isCodeshare
                    ? 'bg-violet-500/10 text-violet-300/90 ring-violet-500/20'
                    : 'bg-white/[0.04] text-muted ring-white/10',
              )}
            >
              op. {opLabel}
              {needsOperatingNumber && ' · needs a number'}
            </button>
          )}
          {sendingOperating && (
            <span
              title="The link carries the operating flight instead of the marketed one"
              className="ml-1 rounded bg-gold-400/10 px-1.5 py-[1px] font-mono text-[10px] text-gold-300 ring-1 ring-inset ring-gold-400/20"
            >
              sends {opCode} {s.operatingFlight}
            </span>
          )}
          {!Number.isNaN(item.depUtc) && (
            <span className="ml-auto hidden font-mono text-[10px] text-faint/80 md:inline">
              {new Date(item.depUtc).toISOString().slice(11, 16)}Z
            </span>
          )}
        </div>

        {/* expanded */}
        {expanded && (
          <div className="mt-2 grid gap-2 rounded-lg border border-line/80 bg-black/20 p-2 sm:grid-cols-2">
            <div className="space-y-2">
              {item.index > 0 && (
                <Toggle
                  checked={!!item.newSlice}
                  onChange={(next) => onChange({ newSliceOverride: next })}
                  label="Starts a new slice"
                  hint={
                    item.autoNewSlice
                      ? 'Detected automatically (long stay or different airport)'
                      : 'Not detected automatically'
                  }
                />
              )}
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-faint">
                  Departure timezone
                </span>
                <select
                  value={s.tzOverride ?? ''}
                  onChange={(event) => onChange({ tzOverride: event.target.value || undefined })}
                  className="field [color-scheme:dark]"
                >
                  <option value="">
                    Auto{tz ? ` — ${tz}` : ' (airport unknown)'}
                  </option>
                  {tz && !s.tzOverride && <option value={tz}>{tz}</option>}
                  {COMMON_TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-faint">
                  Arrival day offset
                </span>
                <select
                  value={String(s.arrDayOffset)}
                  onChange={(event) => onChange({ arrDayOffset: Number(event.target.value) })}
                  className="field [color-scheme:dark]"
                >
                  <option value="0">Same day</option>
                  <option value="1">+1 day</option>
                  <option value="2">+2 days</option>
                </select>
              </label>
              <div className="flex items-center gap-1.5">
                <IconButton label="Move up" onClick={() => onMove(-1)} disabled={!canMoveUp}>
                  <MoveUp className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Move down" onClick={() => onMove(1)} disabled={!canMoveDown}>
                  <MoveDown className="h-3.5 w-3.5" />
                </IconButton>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-red-500/20 bg-red-500/5 px-2 text-[11px] text-red-300/90 transition-colors hover:bg-red-500/15 hover:text-red-200"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>

            {(isCodeshare ||
              s.operatedBy ||
              looksLikeCodeshareNumber(s.carrier, s.flightNumber)) && (
              <div className="space-y-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2 sm:col-span-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-faint">
                    Operated by
                  </span>
                  {isCodeshare && (
                    <span className="rounded bg-violet-500/10 px-1.5 py-[1px] text-[9.5px] text-violet-300 ring-1 ring-inset ring-violet-500/20">
                      codeshare
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-faint">
                    {s.carrier} {s.flightNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-wider text-faint">
                      Operating carrier
                    </span>
                    <input
                      aria-label="Operating carrier"
                      value={s.operatingCarrier ?? ''}
                      spellCheck={false}
                      placeholder="BA"
                      onChange={(event) => {
                        const value = event.target.value
                          .replace(/[^a-zA-Z0-9]/g, '')
                          .toUpperCase()
                          .slice(0, 2);
                        onChange({
                          operatingCarrier: value || undefined,
                          operatedBy: value ? s.operatedBy ?? value : undefined,
                        });
                      }}
                      className="field px-2 py-1 font-mono text-[12px] uppercase"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-wider text-faint">
                      Operating flight
                    </span>
                    <input
                      aria-label="Operating flight number"
                      value={s.operatingFlight ?? ''}
                      spellCheck={false}
                      placeholder="178"
                      onChange={(event) =>
                        onChange({
                          operatingFlight: event.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                        })
                      }
                      className="field px-2 py-1 font-mono text-[12px]"
                    />
                  </label>
                </div>

                <Toggle
                  checked={s.sendAs === 'operating'}
                  onChange={(next) => onChange({ sendAs: next ? 'operating' : 'marketing' })}
                  disabled={!canSendOperating}
                  label="Send the operating flight"
                  hint={
                    canSendOperating
                      ? `The link carries ${opCode} ${s.operatingFlight} instead of ${s.carrier} ${s.flightNumber}.`
                      : 'Fill in the operating carrier and its flight number to switch.'
                  }
                />

                <p className="text-[9.5px] leading-snug text-faint">
                  aa.com finds a flight by carrier + flight number. It carries AA, AA codeshares
                  and partner prime flights — a partner's codeshare of another partner's metal
                  (like {s.carrier} {s.flightNumber}
                  {isCodeshare ? ` on ${opCode}` : ''}) is usually invisible to it. Send the
                  operating number, or the AA codeshare, when the link comes back empty.
                </p>
              </div>
            )}

            {s.raw && (
              <div className="sm:col-span-2">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-faint">
                  Source line
                </span>
                <code className="block overflow-x-auto whitespace-pre rounded-md border border-line/70 bg-black/30 px-2 py-1 font-mono text-[10.5px] text-faint">
                  {s.raw}
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
