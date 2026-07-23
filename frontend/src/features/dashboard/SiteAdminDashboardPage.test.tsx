import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SiteAdminDashboardPage from './SiteAdminDashboardPage';
import * as agenciesApi from '../../api/agencies';
import * as refundsApi from '../../api/refunds';
import * as supportTicketsApi from '../../api/support-tickets';
import type { AgencyMembershipRequest } from '../../types/agencies';
import type { RefundsResult } from '../../types/refunds';
import type { ContactMessageRow } from '../../types/support-tickets';

const REQUEST: AgencyMembershipRequest = {
  id: 'r1',
  applicantName: 'آژانس تست',
  managerName: 'مدیر تست',
  licenseNo: 'LC123',
  city: 'تهران',
  phone: '09121110000',
  email: 'a@a.com',
  status: 'PENDING',
  referredToId: null,
  reviewNote: null,
  reviewedById: null,
  reviewedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
};

const REFUNDS: RefundsResult = {
  requests: [
    {
      id: 'f1',
      bookingId: 'b1',
      passengerName: 'نگار رضایی',
      totalPaidIrr: 10_000_000,
      penaltyPct: 10,
      penaltyAmountIrr: 1_000_000,
      refundableIrr: 9_000_000,
      status: 'SUBMITTED',
      assigneeId: null,
      assignee: null,
      paidAt: null,
      history: [],
      createdAt: '2026-07-02T00:00:00.000Z',
      booking: {
        id: 'b1',
        pnr: 'BJ1X2',
        flightInstance: {
          departureAt: '2026-08-01T00:00:00.000Z',
          flight: { flightNo: 'BJ-1', route: { originCode: 'THR', destCode: 'MHD' } },
        },
      },
    },
  ],
  kpis: { payoutQueue: 0, paid: 0, awaitingAdmin: 1 },
};

const MESSAGES: ContactMessageRow[] = [
  {
    id: 'c1',
    name: 'آرش کریمی',
    phone: '09121110000',
    subject: 'سوال دربارهٔ استرداد',
    body: 'چطور می‌توانم بلیطم را استرداد کنم؟',
    createdAt: '2026-07-03T00:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <SiteAdminDashboardPage />
    </MemoryRouter>,
  );
}

describe('SiteAdminDashboardPage', () => {
  it('shows pending agency requests, refunds awaiting review, and recent contact messages from real endpoints', async () => {
    vi.spyOn(agenciesApi, 'fetchAgencyRequests').mockResolvedValue([REQUEST]);
    vi.spyOn(refundsApi, 'fetchRefunds').mockResolvedValue(REFUNDS);
    vi.spyOn(supportTicketsApi, 'fetchRecentContactMessages').mockResolvedValue(MESSAGES);

    renderPage();

    expect(await screen.findByText('آژانس تست')).toBeInTheDocument();
    expect(await screen.findByText('نگار رضایی')).toBeInTheDocument();
    expect(await screen.findByText('آرش کریمی')).toBeInTheDocument();
    expect(agenciesApi.fetchAgencyRequests).toHaveBeenCalledWith('PENDING');
  });

  it('shows an error message when the endpoints fail', async () => {
    vi.spyOn(agenciesApi, 'fetchAgencyRequests').mockRejectedValue(new Error('x'));
    vi.spyOn(refundsApi, 'fetchRefunds').mockRejectedValue(new Error('x'));
    vi.spyOn(supportTicketsApi, 'fetchRecentContactMessages').mockRejectedValue(new Error('x'));

    renderPage();

    expect(await screen.findByText('خطا در دریافت اطلاعات داشبورد.')).toBeInTheDocument();
  });
});
