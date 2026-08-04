import type { CabinClass } from '../../../types/public-site';

export type TripType = 'oneway' | 'round' | 'multi';

export interface SearchLeg {
  origin: string;
  dest: string;
  date: string;
}

export interface ParsedSearchParams {
  trip: TripType;
  legs: SearchLeg[];
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
  /** Active leg index for multi-city flow (0-based). */
  legIndex: number;
  /** Selected flight instance ids per leg for multi/round flows. */
  selectedFlights: string[];
}

export function buildResultsUrl(input: {
  trip: TripType;
  legs: SearchLeg[];
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  cabin?: CabinClass;
}): string {
  const q = new URLSearchParams();
  q.set('trip', input.trip);
  const leg = input.legs[0];
  if (!leg?.origin || !leg.dest || !leg.date) return '/results';

  if (input.trip === 'multi') {
    q.set(
      'legs',
      input.legs.map((l) => `${l.origin}:${l.dest}:${l.date}`).join('|'),
    );
  } else {
    q.set('origin', leg.origin);
    q.set('dest', leg.dest);
    q.set('date', leg.date.slice(0, 10));
    if (input.trip === 'round' && input.returnDate) {
      q.set('returnDate', input.returnDate.slice(0, 10));
    }
  }
  q.set('adults', String(input.adults ?? 1));
  if (input.children) q.set('children', String(input.children));
  if (input.infants) q.set('infants', String(input.infants));
  q.set('cabin', input.cabin ?? 'ECONOMY');
  return `/results?${q.toString()}`;
}

export function parseResultsSearchParams(params: URLSearchParams): ParsedSearchParams | null {
  const tripRaw = params.get('trip') ?? 'oneway';
  const trip: TripType =
    tripRaw === 'round' || tripRaw === 'multi' ? tripRaw : 'oneway';

  let legs: SearchLeg[] = [];
  if (trip === 'multi') {
    const raw = params.get('legs') ?? '';
    legs = raw
      .split('|')
      .map((part) => {
        const [origin, dest, date] = part.split(':');
        if (!origin || !dest || !date) return null;
        return { origin, dest, date };
      })
      .filter((l): l is SearchLeg => l !== null);
    if (legs.length < 2) return null;
  } else {
    const origin = params.get('origin') ?? '';
    const dest = params.get('dest') ?? '';
    const date = params.get('date') ?? '';
    if (!origin || !dest || !date) return null;
    legs = [{ origin, dest, date }];
  }

  const cabinRaw = params.get('cabin') ?? 'ECONOMY';
  const cabin: CabinClass = cabinRaw === 'BUSINESS' ? 'BUSINESS' : 'ECONOMY';

  const legIndex = Math.max(0, Number(params.get('leg') ?? '0') || 0);
  const selectedFlights = (params.get('sel') ?? '')
    .split(',')
    .filter(Boolean);

  return {
    trip,
    legs,
    returnDate: params.get('returnDate') ?? undefined,
    adults: Math.max(1, Number(params.get('adults') ?? '1') || 1),
    children: Math.max(0, Number(params.get('children') ?? '0') || 0),
    infants: Math.max(0, Number(params.get('infants') ?? '0') || 0),
    cabin,
    legIndex,
    selectedFlights,
  };
}
