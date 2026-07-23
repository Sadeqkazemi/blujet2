import { apiGet, apiPatch, apiPost, apiRequest } from './http';
import type { CeoPricingResult, CommercialPricingResult, PricingProposal } from '../types/pricing';

export function fetchCeoPricing() {
  return apiGet<CeoPricingResult>('/pricing/proposals');
}

export function fetchCommercialPricing() {
  return apiGet<CommercialPricingResult>('/pricing/proposals');
}

export function upsertProposal(
  flightInstanceId: string,
  dto: { proposedPriceIrr: number; legalRateIrr?: number; note?: string },
) {
  return apiRequest<PricingProposal>(`/pricing/flights/${flightInstanceId}/proposal`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function setLegalRate(id: string, legalRateIrr: number) {
  return apiPatch<PricingProposal>(`/pricing/proposals/${id}/legal-rate`, { legalRateIrr });
}

export function registerProposal(
  id: string,
  source: 'PROPOSED' | 'AI',
  stepUp: { stepUpChallengeId: string; stepUpCode: string },
) {
  return apiPatch<PricingProposal>(`/pricing/proposals/${id}/register`, { source, ...stepUp });
}

export function runAiAnalysis() {
  return apiPost<{ analyzed: number; available: boolean }>('/pricing/proposals/ai-analysis');
}
