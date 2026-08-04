export type DerivedFlightStatus = 'ACTIVE' | 'SELLING' | 'FULL' | 'CANCELLED';

export interface FlightRow {
  id: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  capacity: number;
  charterSeats: number;
  sold: number;
  // Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON
  // on the backend — a JS number can't safely hold IRR amounts above 2^53).
  basePriceIrr: string | null;
  derivedStatus: DerivedFlightStatus;
}

export interface FlightAiSuggestion {
  // Advisory-only ML output, persisted as a plain JSON blob (not a native
  // bigint column, never routed through BigInt.prototype.toJSON) — stays a
  // real JS number, unlike the other Irr fields on this page.
  priceIrr: number;
  reason: string;
  factors: string[];
  season: string;
  occasion: string;
  confidence: number;
  modelVersion: string;
  generatedAt: string;
}

export interface FutureFlightRow extends Omit<FlightRow, 'derivedStatus'> {
  agencySeatsAllocated: number | null;
  aiSuggestion: FlightAiSuggestion | null;
}

export interface CompletedFlightRow {
  id: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  tickets: number;
  basePriceIrr: string;
  avgPriceIrr: string;
  revenueIrr: string;
  channelRevenueIrr: { SYSTEM: string; CHARTER: string; AGENCY: string };
  profitIrr: string;
  lossIrr: string;
}

export interface FlightsOverview {
  kpis: { activeCount: number; soldSeats: number; meanOccupancyPct: number };
  active: FlightRow[];
  completed: {
    rows: CompletedFlightRow[];
    kpis: {
      totalSalesIrr: string;
      totalProfitIrr: string;
      totalTickets: number;
      flightCount: number;
    };
  };
  future: FutureFlightRow[];
}

export interface AirportEntry {
  id: string;
  code: string;
  cityFa: string;
  tz: string;
}

export interface FlightDetail extends FlightRow {
  channels: { channel: 'SYSTEM' | 'CHARTER' | 'AGENCY'; seats: number; revenueIrr: string }[];
  totalRevenueIrr: string;
  occupancyPct: number;
  aircraftType: string;
}

export interface AircraftTypeOption {
  aircraftType: string;
  capacity: number;
}

export interface PlanResult {
  id: string;
  basePriceIrr: string;
  agencySeatsAllocated: number;
  directSeats: number;
  proposalPending: boolean;
}

export interface AllotmentRow {
  id: string;
  agencyId: string;
  agencyName: string;
  seatsAllocated: number;
  type: 'SOFT' | 'HARD';
  releaseAt: string | null;
  contractPriceIrr: string | null;
  createdAt: string;
  active: boolean;
}

export interface FareRuleRow {
  id: string;
  flightInstanceId: string;
  cabin: 'ECONOMY' | 'BUSINESS';
  classCode: string;
  priceIrr: number;
  seatsAllocated: number;
  taxIrr: number;
  refundable: boolean;
  changeable: boolean;
  baggageAllowanceKg: number | null;
  validFrom: string | null;
  validUntil: string | null;
  allowedChannels: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
}

export interface CreateFareRulePayload {
  cabin: 'ECONOMY' | 'BUSINESS';
  classCode: string;
  priceIrr: number;
  seatsAllocated: number;
  taxIrr?: number;
  refundable?: boolean;
  changeable?: boolean;
  baggageAllowanceKg?: number;
  validFrom?: string;
  validUntil?: string;
  allowedChannels?: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
}

export interface UpdateFareRulePayload {
  priceIrr?: number;
  seatsAllocated?: number;
  taxIrr?: number;
  refundable?: boolean;
  changeable?: boolean;
  baggageAllowanceKg?: number;
  validFrom?: string;
  validUntil?: string;
  allowedChannels?: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
}
