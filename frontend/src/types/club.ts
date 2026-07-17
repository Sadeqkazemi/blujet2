export type ClubTier = 'SILVER' | 'GOLD' | 'PLATINUM';
export type ClubCardStatus = 'NONE' | 'REVIEW' | 'ISSUED';
export type ClubCardRequestStatus = 'REFERRED' | 'APPROVED' | 'REJECTED';

export interface ClubMember {
  id: string;
  fullName: string;
  email: string;
  birthDate: string | null;
  joinDate: string;
  points: number;
  level: ClubTier;
  cardStatus: ClubCardStatus;
  cardNo: string | null;
  issuedByLabelFa: string | null;
}

export interface ClubMembersResult {
  members: ClubMember[];
  kpis: {
    totalMembers: number;
    issuedCards: number;
    pendingRequests: number;
    tierCounts: Record<ClubTier, number>;
  };
}

export interface ClubCardRequest {
  id: string;
  memberId: string;
  member: { id: string; fullName: string; email: string; points: number; level: ClubTier };
  level: ClubTier;
  points: number;
  status: ClubCardRequestStatus;
  assignedTo: 'SENIOR' | 'CHAIR' | null;
  cardNo: string | null;
  history: { step: string; labelFa: string; at: string }[];
  createdAt: string;
}
