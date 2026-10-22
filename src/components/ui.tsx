import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-panel/85',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_20px_50px_-30px_rgba(0,0,0,0.95)]',
        'backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHead({
  step,
  icon,
  title,
  subtitle,
  right,
}: {
  step?: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-line/80 px-4 py-3.5">
      {step ? (
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-gold-400/25 bg-gold-400/10 font-mono text-[10px] font-semibold text-gold-300">
          {step}
        </span>
      ) : icon ? (
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line-2 bg-panel-3 text-muted">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-gold-300 to-gold-500 text-[#181200] font-semibold border border-gold-500/60 ' +
    'hover:from-gold-200 hover:to-gold-400 shadow-[0_10px_28px_-14px_rgba(247,201,72,0.85)]',
  secondary:
    'border border-line-2 bg-panel-3 text-ink hover:border-[#33415a] hover:bg-[#1a2230]',
  ghost: 'border border-transparent text-muted hover:bg-panel-3 hover:text-ink',
  danger:
    'border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:text-red-200',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center gap-1.5 rounded-lg transition-all',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2 text-[11.5px]' : 'h-9 px-3 text-[12.5px]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  className,
  label,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md border border-transparent text-faint',
        'transition-colors hover:border-line-2 hover:bg-panel-3 hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-30',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

type Tone = 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'neutral' | 'violet';

const TONES: Record<Tone, string> = {
  gold: 'bg-gold-400/10 text-gold-300 ring-gold-400/25',
  green: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
  red: 'bg-red-500/10 text-red-300 ring-red-500/25',
  amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
  blue: 'bg-sky-500/10 text-sky-300 ring-sky-500/25',
  violet: 'bg-violet-500/10 text-violet-300 ring-violet-500/25',
  neutral: 'bg-white/[0.04] text-muted ring-white/10',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function useCopy(timeout = 1800) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const copy = useCallback(
    async (value: string) => {
      if (!value) return;
      const ok = await writeClipboard(value);
      if (!ok) return;
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), timeout);
    },
    [timeout],
  );

  return { copied, copy };
}

export function CopyButton({
  value,
  label = 'Copy link',
  variant = 'secondary',
  className,
  disabled,
}: {
  value: string;
  label?: string;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
}) {
  const { copied, copy } = useCopy();
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => void copy(value)}
      disabled={disabled || !value}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-left transition-colors hover:border-line-2"
    >
      <span className="min-w-0">
        <span className="block text-[11.5px] text-ink">{label}</span>
        {hint && <span className="block text-[10.5px] leading-tight text-faint">{hint}</span>}
      </span>
      <span
        className={cn(
          'relative h-4 w-7 shrink-0 rounded-full transition-colors',
          checked ? 'bg-gold-400' : 'bg-line-2',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
            checked ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line/80', className)} />;
}
