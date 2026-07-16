import type { AgencyInvoiceStatus, AgencyTier } from '../../types/agencies';

/** Label/tone maps shared by the agencies pages — exact strings from the design. */

export const TIER_LABELS: Record<AgencyTier, string> = {
  GOLD: 'طلایی',
  SILVER: 'نقره‌ای',
  NORMAL: 'عادی',
};

export const INVOICE_STATUS: Record<AgencyInvoiceStatus, { label: string; className: string }> = {
  PAID: { label: 'تسویه شد', className: 'bg-[#10b98124] text-[#059669]' },
  UNPAID: { label: 'در انتظار پرداخت', className: 'bg-[#f59e0b24] text-[#b45309]' },
  OVERDUE: { label: 'معوق', className: 'bg-danger/15 text-danger' },
};

export const ACTIVE_BADGE = { label: 'فعال', className: 'bg-[#10b98124] text-[#059669]' };
export const SUSPENDED_BADGE = { label: 'تعلیق‌شده', className: 'bg-danger/15 text-danger' };

export function statusBadge(isActive: boolean) {
  return isActive ? ACTIVE_BADGE : SUSPENDED_BADGE;
}
