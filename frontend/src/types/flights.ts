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
  basePriceIrr: number | null;
  derivedStatus: DerivedFlightStatus;
}

export interface FlightAiSuggestion {
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
  basePriceIrr: number;
  avgPriceIrr: number;
  revenueIrr: number;
  channelRevenueIrr: { SYSTEM: number; CHARTER: number; AGENCY: number };
  profitIrr: number;
  lossIrr: number;
}

export interface FlightsOverview {
  kpis: { activeCount: number; soldSeats: number; meanOccupancyPct: number };
  active: FlightRow[];
  completed: {
    rows: CompletedFlightRow[];
    kpis: {
      totalSalesIrr: number;
      totalProfitIrr: number;
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
  channels: { channel: 'SYSTEM' | 'CHARTER' | 'AGENCY'; seats: number; revenueIrr: number }[];
  totalRevenueIrr: number;
  occupancyPct: number;
  aircraftType: string;
}

export interface AircraftTypeOption {
  aircraftType: string;
  capacity: number;
}

export interface PlanResult {
  id: string;
  basePriceIrr: number;
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
  contractPriceIrr: number | null;
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
