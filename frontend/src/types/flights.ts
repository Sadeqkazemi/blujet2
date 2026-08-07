import type {
  CabinKind,
  ChargeKind,
  ChargeMethod,
  FlightApprovalStatus,
} from "../lib/flight-definition";

export type DerivedFlightStatus = "ACTIVE" | "SELLING" | "FULL" | "CANCELLED";

export type { CabinKind, ChargeKind, ChargeMethod, FlightApprovalStatus };

export interface CabinCapacity {
  cabin: CabinKind;
  seats: number;
}

export interface ChargeRule {
  id?: string;
  title: string;
  kind: ChargeKind;
  /** Backend contract — not the form method name. */
  calculationMode: 'FIXED' | 'PERCENTAGE';
  fixedAmountIrr?: string | number | null;
  percentageBasisPoints?: number | null;
  /** null = all cabins. */
  cabin: CabinKind | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}

export interface ChargeBreakdownLine {
  title: string;
  kind: ChargeKind;
  amountIrr: string;
}

export interface CalculatedChargeBreakdown {
  basePriceIrr: string;
  lines: ChargeBreakdownLine[];
  totalSellableIrr: string;
}

export interface FlightDefinitionSnapshot {
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  durationMinutes: number;
  aircraftType: string;
  capacity: number;
  cabinCapacities: CabinCapacity[];
  basePriceIrr: string | null;
  chargeRules: ChargeRule[];
}

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
  durationMinutes?: number;
  cabinCapacities?: CabinCapacity[];
  chargeRules?: ChargeRule[];
  calculatedChargeBreakdown?: CalculatedChargeBreakdown | null;
  approvalStatus?: FlightApprovalStatus;
  rejectionReason?: string | null;
  canEdit?: boolean;
  editBlockedReason?: string | null;
  pendingRevision?: boolean;
  approvedSnapshot?: FlightDefinitionSnapshot | null;
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

export interface FutureFlightRow extends Omit<FlightRow, "derivedStatus"> {
  agencySeatsAllocated: number | null;
  aiSuggestion: FlightAiSuggestion | null;
  aircraftType?: string;
  pricingRegistered?: boolean;
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
  airportNameFa: string;
  tz: string;
}

export interface FlightDetail extends FlightRow {
  channels: {
    channel: "SYSTEM" | "CHARTER" | "AGENCY";
    seats: number;
    revenueIrr: string;
  }[];
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
  type: "SOFT" | "HARD";
  releaseAt: string | null;
  contractPriceIrr: string | null;
  createdAt: string;
  active: boolean;
}

export interface FareRuleRow {
  id: string;
  flightInstanceId: string;
  cabin: CabinKind;
  classCode: string;
  priceIrr: number;
  seatsAllocated: number;
  taxIrr: number;
  refundable: boolean;
  changeable: boolean;
  baggageAllowanceKg: number | null;
  validFrom: string | null;
  validUntil: string | null;
  allowedChannels: ("SYSTEM" | "CHARTER" | "AGENCY")[];
}

export interface CreateFareRulePayload {
  cabin: CabinKind;
  classCode: string;
  priceIrr: number;
  seatsAllocated: number;
  taxIrr?: number;
  refundable?: boolean;
  changeable?: boolean;
  baggageAllowanceKg?: number;
  validFrom?: string;
  validUntil?: string;
  allowedChannels?: ("SYSTEM" | "CHARTER" | "AGENCY")[];
}

export interface CreateFlightDefinitionPayload {
  originCode: string;
  destCode: string;
  flightNo: string;
  departureAt: string;
  durationMinutes: number;
  capacity: number;
  cabinCapacities: CabinCapacity[];
  /** IRR decimal string (or legacy number) — prefer string on the wire. */
  basePriceIrr: string | number;
  aircraftType?: string;
  charterSeats?: number;
  chargeRules?: Omit<ChargeRule, "id">[];
  competitorPriceIrr?: string | number;
}

export interface UpdateFlightDefinitionPayload extends CreateFlightDefinitionPayload {}

export interface FlightDefinitionDetail extends FlightRow {
  aircraftType: string;
  durationMinutes: number;
  cabinCapacities: CabinCapacity[];
  chargeRules: ChargeRule[];
  calculatedChargeBreakdown: CalculatedChargeBreakdown | null;
  approvalStatus: FlightApprovalStatus;
  rejectionReason: string | null;
  canEdit: boolean;
  editBlockedReason: string | null;
  pendingRevision: boolean;
  approvedSnapshot: FlightDefinitionSnapshot | null;
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
  allowedChannels?: ("SYSTEM" | "CHARTER" | "AGENCY")[];
}
