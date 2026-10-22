import { Braces, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { decodeIten, extractIten, formatUtc } from '../lib/aaLink';
import { Badge, IconButton } from './ui';

export function DecodeModal({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const decoded = useMemo(() => {
    const iten = extractIten(value);
    return iten ? decodeIten(iten) : null;
  }, [value]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className="my-[4vh] w-full max-w-3xl animate-rise overflow-hidden rounded-2xl border border-line-2 bg-panel shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Braces className="h-4 w-4 text-gold-300" />
          <h2 className="text-[13px] font-semibold text-ink">Inspect an aa.com link</h2>
          <IconButton label="Close" className="ml-auto" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="p-4">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-faint">
              Paste a full aa.com/goto/metasearch URL or a raw ITEN string
            </span>
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              spellCheck={false}
              placeholder="https://www.aa.com/goto/metasearch?ITEN=DIRECT%2C0%2CUS%2Cmulti…"
              className="block h-[92px] w-full resize-y rounded-lg border border-line bg-black/30 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-ink/90 placeholder:text-faint/50 focus:border-gold-400/50 focus:outline-none"
            />
          </label>

          {!decoded ? (
            <p className="mt-3 text-[11.5px] text-faint">
              Waiting for something that looks like an ITEN — it starts with{' '}
              <code className="font-mono text-[10.5px] text-muted">
                DIRECT,0,US,multi,4,…
              </code>
              .
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="gold">{decoded.fields.length} fields</Badge>
                <Badge tone="blue">{decoded.slices.length} slices</Badge>
                <Badge tone="green">{decoded.segments.length} segments</Badge>
                <Badge tone="neutral">source {decoded.fields[0] || '?'}</Badge>
                {decoded.error && <Badge tone="red">{decoded.error}</Badge>}
              </div>

              <div className="overflow-hidden rounded-lg border border-line">
                <div className="grid grid-cols-[72px_1fr_1fr_88px] gap-2 border-b border-line bg-panel-2 px-2 py-1 text-[9px] uppercase tracking-wider text-faint">
                  <span>Carrier</span>
                  <span>Route</span>
                  <span>Class</span>
                  <span className="text-right">Departure</span>
                </div>
                {decoded.segments.map((segment, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[72px_1fr_1fr_88px] items-center gap-2 border-b border-line/50 px-2 py-1 last:border-0"
                  >
                    <span className="font-mono text-[10.5px] text-gold-300">
                      {segment.carrier} {segment.flight}
                    </span>
                    <span className="font-mono text-[10.5px] text-muted">
                      {segment.from}→{segment.to}
                    </span>
                    <span className="font-mono text-[10.5px] text-ink/80">
                      {segment.cls}
                      <span className="ml-1.5 text-faint/70">s{segment.sliceIndex + 1}</span>
                    </span>
                    <span className="text-right font-mono text-[9.5px] text-faint">
                      {formatUtc(segment.departureUtc)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="max-h-[180px] overflow-auto rounded-lg border border-line bg-black/25">
                {decoded.fields.map((field, index) => {
                  const doc = decoded.docs[index];
                  return (
                    <div
                      key={index}
                      className="flex items-baseline gap-2 border-b border-line/40 px-2 py-[3px] last:border-0"
                    >
                      <span className="w-4 shrink-0 font-mono text-[9px] text-faint/60">
                        {String(index).padStart(2, '0')}
                      </span>
                      <span className="w-[104px] shrink-0 text-[9.5px] text-faint">
                        {doc?.label ?? 'unknown'}
                      </span>
                      <span className="min-w-0 flex-1 break-all font-mono text-[9.5px] text-muted">
                        {field || '∅'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
