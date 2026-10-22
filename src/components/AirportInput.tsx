import { useEffect, useMemo, useRef, useState } from 'react';
import { searchAirports } from '../lib/airports';
import { cn } from '../lib/cn';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid?: boolean;
  align?: 'left' | 'right';
}

export function AirportInput({ value, onChange, label, invalid, align = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(
    () => (open && query.trim().length >= 1 ? searchAirports(query, 6) : []),
    [open, query],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commit = (code: string) => {
    onChange(code);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        aria-label={label}
        value={value}
        spellCheck={false}
        autoComplete="off"
        onFocus={() => {
          setQuery(value);
          setActive(0);
          setOpen(true);
        }}
        onChange={(event) => {
          const next = event.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
          setQuery(next);
          setActive(0);
          setOpen(true);
          onChange(next);
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
            setOpen(true);
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => Math.min(i + 1, hits.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === 'Enter' && hits[active]) {
            event.preventDefault();
            commit(hits[active].code);
          } else if (event.key === 'Escape') {
            setOpen(false);
          } else if (event.key === 'Tab') {
            setOpen(false);
          }
        }}
        className={cn(
          'w-[54px] rounded-md border border-transparent bg-transparent px-1.5 py-1 text-center',
          'font-mono text-[13px] font-semibold uppercase tracking-wide',
          'transition-colors hover:border-line-2 hover:bg-panel-3',
          'focus:border-gold-400/50 focus:bg-panel-3 focus:outline-none',
          invalid ? 'text-amber-300' : 'text-ink',
        )}
      />

      {open && hits.length > 0 && (
        <div
          className={cn(
            'absolute top-full z-50 mt-1 w-[268px] overflow-hidden rounded-lg border border-line-2',
            'bg-[#0d1219] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {hits.map((hit, i) => (
            <button
              key={hit.code}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                commit(hit.code);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors',
                i === active ? 'bg-gold-400/10' : 'hover:bg-panel-3',
              )}
            >
              <span className="w-[38px] shrink-0 font-mono text-[12px] font-semibold text-gold-300">
                {hit.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] text-ink">{hit.city || hit.name}</span>
                <span className="block truncate text-[10px] text-faint">
                  {hit.name}
                  {hit.country ? ` · ${hit.country}` : ''}
                </span>
              </span>
            </button>
          ))}
          <div className="border-t border-line/70 px-2.5 py-1 text-[9.5px] text-faint">
            {hits.length} match{hits.length === 1 ? '' : 'es'} · ↑↓ to move, Enter to pick
          </div>
        </div>
      )}
    </div>
  );
}
