import type { Cabin } from './types';

export const CABINS: Cabin[] = ['FIRST', 'BUSINESS', 'PREMIUM', 'ECONOMY'];

export interface CabinMeta {
  label: string;
  short: string;
  /** Tailwind utility classes for chips/badges. */
  chip: string;
  /** Solid colour used by the ribbon. */
  hex: string;
}

export const CABIN_META: Record<Cabin, CabinMeta> = {
  FIRST: {
    label: 'First',
    short: 'F',
    chip: 'bg-violet-500/12 text-violet-300 ring-violet-400/25',
    hex: '#a78bfa',
  },
  BUSINESS: {
    label: 'Business',
    short: 'J',
    chip: 'bg-gold-400/12 text-gold-300 ring-gold-400/30',
    hex: '#f7c948',
  },
  PREMIUM: {
    label: 'Premium economy',
    short: 'W',
    chip: 'bg-teal-400/12 text-teal-300 ring-teal-400/25',
    hex: '#2dd4bf',
  },
  ECONOMY: {
    label: 'Main cabin',
    short: 'Y',
    chip: 'bg-sky-400/12 text-sky-300 ring-sky-400/25',
    hex: '#60a5fa',
  },
};

/**
 * Booking class → cabin map. It mirrors the buckets AA uses when it renders a
 * fare: F/A in first, J/C/D/I/R in business, W in premium economy and the rest
 * in the main cabin. The cabin is *not* sent in the deep link — AA re-derives it
 * from the booking class — so this map only drives the tool's own display.
 */
export const CLASS_TO_CABIN: Record<string, Cabin> = {
  F: 'FIRST',
  A: 'FIRST',
  J: 'BUSINESS',
  C: 'BUSINESS',
  D: 'BUSINESS',
  I: 'BUSINESS',
  R: 'BUSINESS',
  W: 'PREMIUM',
};

export function cabinForClass(cls: string): Cabin | null {
  if (!cls) return null;
  const key = cls.toUpperCase();
  if (CLASS_TO_CABIN[key]) return CLASS_TO_CABIN[key];
  if (/^[A-Z]$/.test(key)) return 'ECONOMY';
  return null;
}

export const CABIN_CLASSES: Record<Cabin, string[]> = {
  FIRST: ['F', 'A'],
  BUSINESS: ['J', 'C', 'D', 'I', 'R'],
  PREMIUM: ['W'],
  ECONOMY: ['Y', 'B', 'H', 'K', 'M', 'L', 'V', 'G', 'Q', 'N', 'O', 'S', 'T', 'U', 'X', 'P', 'E'],
};

export const ALL_CLASSES = Array.from(
  new Set(Object.values(CABIN_CLASSES).flat()),
).sort();

/* Operating-carrier names → codes now live in `carriers.ts`, next to the
 * carrier directory and the "will aa.com price this?" rule. */
