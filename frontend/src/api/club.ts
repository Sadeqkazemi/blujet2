import { apiGet, apiPatch, apiPost } from './http';
import type { ClubCardRequest, ClubMember, ClubMembersResult, ClubTier } from '../types/club';

export function fetchClubMembers(query: { level?: ClubTier; q?: string } = {}) {
  const params = new URLSearchParams();
  if (query.level) params.set('level', query.level);
  if (query.q) params.set('q', query.q);
  const qs = params.toString();
  return apiGet<ClubMembersResult>(`/club/members${qs ? `?${qs}` : ''}`);
}

export function createClubMember(dto: {
  fullName: string;
  email: string;
  birthDate?: string;
  nationalId: string;
  level: ClubTier;
}) {
  return apiPost<ClubMember>('/club/members', dto);
}

export function updateClubMemberLevel(id: string, level: ClubTier) {
  return apiPatch<ClubMember>(`/club/members/${id}/level`, { level });
}

export function issueClubCard(id: string) {
  return apiPost<ClubMember>(`/club/members/${id}/issue-card`);
}

export function fetchCardRequests() {
  return apiGet<ClubCardRequest[]>('/club/card-requests');
}

export function approveCardRequest(id: string) {
  return apiPatch<ClubCardRequest>(`/club/card-requests/${id}/approve`);
}

export function rejectCardRequest(id: string) {
  return apiPatch<ClubCardRequest>(`/club/card-requests/${id}/reject`);
}
