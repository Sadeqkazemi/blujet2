export type PricingStatus = 'PENDING' | 'REGISTERED';

export interface AiSuggestion {
  priceIrr: number;
  reason: string;
  factors: string[];
  season: string;
  occasion: string;
  confidence: number;
  modelVersion: string;
  generatedAt: string;
}

export interface PricingProposal {
  id: string;
  flightInstanceId: string;
  basePriceIrr: number;
  competitorPriceIrr: number;
  proposedPriceIrr: number;
  legalRateIrr: number | null;
  note: string | null;
  status: PricingStatus;
  registeredPriceIrr: number | null;
  approvedAt: string | null;
  aiSuggestion: AiSuggestion | null;
  createdAt: string;
  proposedBy: { id: string; fullName: string; role: string };
  approvedBy: { id: string; fullName: string; role: string } | null;
  flightInstance: {
    id: string;
    departureAt: string;
    capacity: number;
    charterSeats: number;
    flight: { flightNo: string; route: { originCode: string; destCode: string } };
  };
}

export interface CeoPricingResult {
  pending: PricingProposal[];
  registered: PricingProposal[];
}

export interface CommercialFlightRow {
  id: string;
  departureAt: string;
  capacity: number;
  charterSeats: number;
  flight: { flightNo: string; route: { originCode: string; destCode: string } };
  pricing: PricingProposal | null;
}

export interface CommercialPricingResult {
  flights: CommercialFlightRow[];
}
