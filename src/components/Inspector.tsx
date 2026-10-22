import { Braces, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { decodeIten, formatUtc, type BuiltLink } from '../lib/aaLink';
import { cn } from '../lib/cn';
import { Card, CardHead, CopyButton } from './ui';

export function Inspector({ link }: { link: BuiltLink }) {
  const [openFields, setOpenFields] = useState(false);
  const decoded = link.ok ? decodeIten(link.iten) : null;

  return (
    <Card>
      <CardHead
        title="Inside the link"
        icon={<Braces className="h-3.5 w-3.5" />}
        subtitle="The envelope, decoded — no black box."
        right={
          link.ok ? <CopyButton value={link.iten} label="ITEN" variant="ghost" /> : undefined
        }
      />

      {!decoded ? (
        <p className="px-4 py-5 text-[11.5px] text-faint">
          Build a valid link and its internals show up here.
        </p>
      ) : (
        <div className="divide-y divide-line/70">
          <div className="p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-faint">
              Slices ({decoded.slices.length})
            </p>
            <div className="space-y-1">
              {decoded.slices.map((slice, i) => (
                <div
                  key={`s-${i}`}
                  className="flex items-center gap-2 rounded-md border border-line bg-panel-2/50 px-2 py-1"
                >
                  <span className="font-mono text-[9.5px] text-faint">#{i + 1}</span>
                  <span className="font-mono text-[11px] text-ink">
                    {slice.from} <span className="text-faint">→</span> {slice.to}
                  </span>
                  <span className="ml-auto font-mono text-[9.5px] text-faint">
                    {formatUtc(slice.departureUtc)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-faint">
              Segments ({decoded.segments.length})
            </p>
            <div className="space-y-1">
              {decoded.segments.map((segment, i) => (
                <div
                  key={`f-${i}`}
                  className="flex items-center gap-2 rounded-md border border-line bg-panel-2/50 px-2 py-1"
                >
                  <span className="font-mono text-[10px] text-gold-300">
                    {segment.carrier} {segment.flight}
                  </span>
                  <span className="rounded border border-line-2 bg-panel-3 px-1 font-mono text-[9.5px] text-ink">
                    {segment.cls || '–'}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {segment.from}→{segment.to}
                  </span>
                  <span className="ml-auto flex items-center gap-2 font-mono text-[9.5px] text-faint">
                    <span>{formatUtc(segment.departureUtc)}</span>
                    <span className="text-faint/60">s{segment.sliceIndex + 1}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenFields((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-panel-2/60"
          >
            <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
              Envelope fields ({decoded.fields.length})
            </span>
            <ChevronDown
              className={cn('ml-auto h-3.5 w-3.5 text-faint transition-transform', openFields && 'rotate-180')}
            />
          </button>

          {openFields && (
            <div className="divide-y divide-line/50">
              {decoded.docs.map((doc) => {
                const value = decoded.fields[doc.index] ?? '';
                const isLong = value.length > 44;
                return (
                  <div key={doc.index} className="px-3 py-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="w-4 shrink-0 font-mono text-[9px] text-faint/70">
                        {String(doc.index).padStart(2, '0')}
                      </span>
                      <span className="shrink-0 text-[10.5px] text-muted">{doc.label}</span>
                      <span
                        className={cn(
                          'ml-auto min-w-0 truncate font-mono text-[10px]',
                          doc.status === 'constant' ? 'text-faint/60' : 'text-ink/80',
                        )}
                        title={value}
                      >
                        {value || '∅'}
                      </span>
                    </div>
                    {isLong && (
                      <p className="mt-0.5 max-h-16 overflow-auto break-all rounded bg-black/30 px-1.5 py-1 font-mono text-[9px] leading-relaxed text-faint">
                        {value}
                      </p>
                    )}
                    <p className="mt-[3px] text-[9.5px] leading-snug text-faint/60">{doc.note}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
