export type CartableCategory = 'ADMIN' | 'AGENCY' | 'MANAGER';
export type CartableStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'TRANSFERRED';
export type CartableSourceType =
  | 'MANAGER_MESSAGE'
  | 'MANAGER_REFERRAL'
  | 'AGENCY_REQUEST'
  | 'CHAIR_PERMISSION';

export interface CartableTask {
  id: string;
  category: CartableCategory;
  title: string;
  description: string;
  senderLabelFa: string | null;
  sender: { fullName: string; role: string } | null;
  sourceType: CartableSourceType | null;
  sourceId: string | null;
  status: CartableStatus;
  resolutionNote: string | null;
  createdAt: string;
}

export interface CartableListResult {
  tasks: CartableTask[];
  counts: { ADMIN: number; AGENCY: number; MANAGER: number };
  totalOpen: number;
}

export type ChairPermissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ChairPermission {
  id: string;
  status: ChairPermissionStatus;
  createdAt: string;
}

export interface StaffDirectoryEntry {
  id: string;
  fullName: string;
  role: string;
  roleLabelFa: string;
}

export type ReferralPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ReferralStatus = 'SENT' | 'REVIEWING' | 'REPORTED' | 'CLOSED';

export interface ReferralRecipient {
  recipientId: string;
  recipient: { id: string; fullName: string; role: string };
}

export interface ReferralReport {
  id: string;
  body: string;
  createdAt: string;
  from: { id: string; fullName: string; role: string };
}

export interface Referral {
  id: string;
  title: string;
  body: string;
  priority: ReferralPriority;
  dueAt: string | null;
  status: ReferralStatus;
  createdAt: string;
  recipients: ReferralRecipient[];
  reports?: ReferralReport[];
  _count?: { reports: number };
}

export interface ReferralListResult {
  referrals: Referral[];
  kpis: { total: number; awaitingReport: number; reported: number; closed: number };
}

export type ManagerMessageDept =
  | 'FINANCE'
  | 'COMMERCIAL'
  | 'SUPPORT'
  | 'AGENCIES'
  | 'CEO'
  | 'ALL_MANAGERS';

export interface SendMessageResult {
  message: { id: string; subject: string };
  deliveredCount: number;
  warning?: 'PARTIAL_DELIVERY';
}
