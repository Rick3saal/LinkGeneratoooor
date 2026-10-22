import { Plus, RotateCcw, TriangleAlert } from 'lucide-react';
import { CABIN_META } from '../lib/classes';
import { cn } from '../lib/cn';
import type { SlicePlan } from '../lib/slices';
import { formatDuration, formatShortDate } from '../lib/time';
import type { Segment } from '../lib/types';
import { SegmentRow, SLICE_COLORS } from './SegmentRow';
import { Badge, Button, Card, CardHead, IconButton } from './ui';

interface Props {
  plan: SlicePlan;
  hasManualSlices: boolean;
  onPatch: (id: string, patch: Partial<Segment>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAdd: () => void;
  onResetSlices: () => void;
}

export function ItineraryPanel({
  plan,
  hasManualSlices,
  onPatch,
  onRemove,
  onMove,
  onAdd,
  onResetSlices,
}: Props) {
  const total = plan.items.length;
  const cabinCounts = new Map<string, number>();
  for (const item of plan.items) {
    cabinCounts.set(item.segment.cabin, (cabinCounts.get(item.segment.cabin) ?? 0) + 1);
  }

  return (
    <Card>
      <CardHead
        step="02"
        title="The itinerary"
        subtitle="Every field is editable — force a class, switch a cabin, split a slice."
        right={
          <>
            {plan.mixedCabin && (
              <span className="hidden sm:block">
                <Badge tone="violet">mixed cabin</Badge>
              </span>
            )}
            {hasManualSlices && (
              <IconButton label="Re-detect slices" onClick={onResetSlices}>
                <RotateCcw className="h-3.5 w-3.5" />
              </IconButton>
            )}
            <Button size="sm" variant="secondary" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" /> Segment
            </Button>
          </>
        }
      />

      <div className="px-3 pb-3 pt-2">
        {total === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 px-4 py-10 text-center">
            <p className="text-[12.5px] text-muted">No segments yet.</p>
            <p className="max-w-[320px] text-[11px] leading-relaxed text-faint">
              Paste an itinerary above — or build one by hand. Each row needs a carrier, a flight
              number, an airport pair, a date and a departure time.
            </p>
            <Button size="sm" variant="secondary" onClick={onAdd} className="mt-1">
              <Plus className="h-3.5 w-3.5" /> Add the first segment
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {plan.slices.map((slice, sliceIndex) => {
              const first = slice[0];
              const last = slice[slice.length - 1];
              const color = SLICE_COLORS[sliceIndex % SLICE_COLORS.length];
              return (
                <div key={`slice-${sliceIndex}`} className={sliceIndex > 0 ? 'pt-2.5' : ''}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color }}
                    >
                      Slice {sliceIndex + 1}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {first.segment.origin || '???'}
                      <span className="mx-1 text-faint">→</span>
                      {last.segment.destination || '???'}
                    </span>
                    <span className="text-[10.5px] text-faint">
                      {formatShortDate(first.segment.depDate)}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      {[...new Set(slice.map((i) => i.segment.cabin))].map((cabin) => (
                        <span
                          key={cabin}
                          className="rounded px-1.5 py-[1px] text-[9.5px] font-medium"
                          style={{
                            color: CABIN_META[cabin].hex,
                            background: `${CABIN_META[cabin].hex}14`,
                          }}
                        >
                          {CABIN_META[cabin].label}
                        </span>
                      ))}
                      <span className="text-[10px] text-faint">
                        {slice.length} seg{slice.length > 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-1">
                    {slice.map((item, i) => (
                      <div key={item.segment.id}>
                        {i > 0 && (
                          <div className="flex items-center gap-2 py-[3px] pl-3">
                            <span className="h-2.5 w-px bg-line-2" />
                            <span
                              className={cn(
                                'text-[10px]',
                                item.gapMinutes !== null && item.gapMinutes < 45
                                  ? 'text-amber-300/90'
                                  : 'text-faint',
                              )}
                            >
                              {item.gapMinutes === null
                                ? 'connection'
                                : `${formatDuration(item.gapMinutes)} layover in ${
                                    item.segment.origin
                                  }`}
                              {item.gapMinutes !== null && item.gapMinutes < 0 && (
                                <TriangleAlert className="ml-1 inline h-2.5 w-2.5" />
                              )}
                            </span>
                          </div>
                        )}
                        <SegmentRow
                          item={item}
                          sliceIndex={sliceIndex}
                          onChange={(patch) => onPatch(item.segment.id, patch)}
                          onRemove={() => onRemove(item.segment.id)}
                          onMove={(dir) => onMove(item.segment.id, dir)}
                          canMoveUp={item.index > 0}
                          canMoveDown={item.index < total - 1}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
