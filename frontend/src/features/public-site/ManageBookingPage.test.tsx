import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ManageBookingPage from './ManageBookingPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import type { BookingDetail, RefundRequestView } from '../../types/public-site';

const BOOKING: BookingDetail = {
  id: 'b1',
  pnr: 'BJ4X2K',
  status: 'TICKETED',
  cabin: 'ECONOMY',
  priceIrr: 160_000_000,
  holdExpiresAt: null,
  flightInstanceId: 'fi-1',
  flightNo: 'BJ-102',
  originCode: 'THR',
  destCode: 'MHD',
  departureAt: '2026-08-01T04:00:00.000Z',
  arrivalAt: '2026-08-01T05:25:00.000Z',
  isPriceLocked: false,
  passengers: [
    { fullName: 'نگار رضایی', seatCode: '12A' },
    { fullName: 'آرش رضایی', seatCode: '12B' },
  ],
};

function renderPage() {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <ManageBookingPage />
    </MemoryRouter>,
  );
}

describe('ManageBookingPage', () => {
  it('looks up a real booking by PNR + last name and shows it', async () => {
    const lookup = vi.spyOn(publicSiteApi, 'lookupBookingByPnrAndLastName').mockResolvedValue(BOOKING);
    renderPage();

    await userEvent.type(screen.getByTestId('mb-pnr'), 'bj4x2k');
    await userEvent.type(screen.getByTestId('mb-lastname'), 'رضایی');
    await userEvent.click(screen.getByTestId('mb-lookup'));

    expect(await screen.findByTestId('mb-pnr-show')).toHaveTextContent('BJ4X2K');
    expect(screen.getByText('نگار رضایی')).toBeInTheDocument();
    expect(screen.getByText('آرش رضایی')).toBeInTheDocument();
    expect(lookup).toHaveBeenCalledWith('bj4x2k', 'رضایی');
  });

  it('shows the real error message on a lookup failure (wrong PNR/last name)', async () => {
    vi.spyOn(publicSiteApi, 'lookupBookingByPnrAndLastName').mockRejectedValue(
      new ApiRequestError('NOT_FOUND', 'رزرو یافت نشد.', 404),
    );
    renderPage();

    await userEvent.type(screen.getByTestId('mb-pnr'), 'ZZZZZZ');
    await userEvent.type(screen.getByTestId('mb-lastname'), 'ناشناس');
    await userEvent.click(screen.getByTestId('mb-lookup'));

    expect(await screen.findByTestId('mb-lookup-error')).toHaveTextContent('رزرو یافت نشد.');
  });

  it('submits a real anonymous refund and shows the real computed penalty breakdown', async () => {
    vi.spyOn(publicSiteApi, 'lookupBookingByPnrAndLastName').mockResolvedValue(BOOKING);
    const submit = vi.spyOn(publicSiteApi, 'submitAnonymousRefund').mockResolvedValue({
      id: 'r1',
      bookingId: 'b1',
      status: 'SUBMITTED',
      penaltyPct: 30,
      penaltyAmountIrr: 4_800_000,
      refundableIrr: 11_200_000,
      totalPaidIrr: 16_000_000,
      createdAt: new Date().toISOString(),
    } satisfies RefundRequestView);
    renderPage();

    await userEvent.type(screen.getByTestId('mb-pnr'), 'BJ4X2K');
    await userEvent.type(screen.getByTestId('mb-lastname'), 'رضایی');
    await userEvent.click(screen.getByTestId('mb-lookup'));
    await screen.findByTestId('mb-pnr-show');

    await userEvent.click(screen.getByTestId('mb-open-refund'));
    await userEvent.type(screen.getByTestId('mb-iban'), 'IR820170000000332211009900');
    await userEvent.click(screen.getByTestId('mb-refund-confirm'));

    expect(await screen.findByText('درخواست استرداد ثبت شد')).toBeInTheDocument();
    expect(screen.getByTestId('mb-refundable-result')).toHaveTextContent('۱٬۱۲۰٬۰۰۰');
    expect(submit).toHaveBeenCalledWith('BJ4X2K', 'رضایی', 'IR820170000000332211009900');
  });

  it('disables تغییر صندلی and دانلود بلیط as not-yet-built', async () => {
    vi.spyOn(publicSiteApi, 'lookupBookingByPnrAndLastName').mockResolvedValue(BOOKING);
    renderPage();

    await userEvent.type(screen.getByTestId('mb-pnr'), 'BJ4X2K');
    await userEvent.type(screen.getByTestId('mb-lastname'), 'رضایی');
    await userEvent.click(screen.getByTestId('mb-lookup'));
    await screen.findByTestId('mb-pnr-show');

    expect(screen.getByRole('button', { name: /تغییر صندلی/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /دانلود بلیط/ })).toBeDisabled();
  });
});
