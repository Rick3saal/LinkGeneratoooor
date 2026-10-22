/** Core domain types for El 3asool Scoop. */

export type Cabin = 'FIRST' | 'BUSINESS' | 'PREMIUM' | 'ECONOMY';

export interface Segment {
  id: string;
  /** Marketing carrier, 2 characters (AA, BA, …). */
  carrier: string;
  /** Flight number without the carrier prefix. */
  flightNumber: string;
  /** Single letter booking class (J, I, Y …). Empty when unknown. */
  bookingClass: string;
  /** Cabin used for display + mixed-cabin detection. */
  cabin: Cabin;
  origin: string;
  destination: string;
  /** Local departure date, ISO `yyyy-mm-dd`. */
  depDate: string;
  /** Local departure time, `HH:mm` 24h. */
  depTime: string;
  /** Local arrival time, `HH:mm` 24h. May be empty when the source had none. */
  arrTime: string;
  /** Days added to the arrival date (overnight / +1 markers). */
  arrDayOffset: number;
  /** Free-text operating carrier, e.g. "BRITISH AIRWAYS" for a codeshare. */
  operatedBy?: string;
  /** Manual override for slice detection: true = start a new slice, false = stay. */
  newSliceOverride?: boolean | null;
  /** Manual IANA timezone override for the departure airport. */
  tzOverride?: string;
  /** Original source line, kept for the editor + debugging. */
  raw?: string;
  /** 1-based line number from the pasted text, when the source had one. */
  lineNumber?: number;
  /** Second booking class found on the same source line, kept for a gentle warning. */
  classConflict?: string;
}

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  detail?: string;
  /** Segment the issue belongs to, when applicable. */
  segmentId?: string;
}

export interface AirportInfo {
  code: string;
  name: string;
  city: string;
  country: string;
  tz: string;
}

export type AirportLookup = (code: string) => AirportInfo | undefined;

export interface PassengerCounts {
  adults: number;
  seniors: number;
  children: number;
  infants: number;
  youth: number;
  lap: number;
}

export interface BuildOptions {
  /** Value for ITEN field 0 — "DIRECT" in AA's own hand-offs. */
  source: string;
  /** Point-of-sale country (ITEN field 2). */
  posCountry: string;
  /** Trip type written to the envelope. */
  tripType: 'multi' | 'oneWay';
  passengers: PassengerCounts;
  /** Price carried in the envelope (field 17). Display-only for AA. */
  price: string;
  /** Constant tail field (field 18). */
  tail: string;
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  source: 'DIRECT',
  posCountry: 'US',
  tripType: 'multi',
  passengers: { adults: 1, seniors: 0, children: 0, infants: 0, youth: 0, lap: 0 },
  price: '0.00',
  tail: '1',
};
