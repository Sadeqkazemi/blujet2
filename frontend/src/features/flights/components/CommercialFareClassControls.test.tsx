import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as flightsApi from '../../../api/flights';
import type { CommercialFlightControl } from '../../../types/flights';
import CommercialFareClassControls from './CommercialFareClassControls';

vi.mock('../../../api/flights');

const control: CommercialFlightControl = {
  flightInstanceId: 'flight-1',
  publicSaleEnabled: false,
  fareClasses: [
    {
      ruleId: 'rule-y',
      cabin: 'ECONOMY',
      classCode: 'Y',
      seatsAllocated: 30,
      soldSeats: 8,
      remainingSeats: 22,
      revenueIrr: '304000000',
      basePriceIrr: '36000000',
      sitePriceIrr: '38000000',
      siteSeatsReleased: 10,
      agencySeatsReleased: 5,
      agencyReleasePriceIrr: '32000000',
      agencySpecialOffer: false,
      priceHistory: [],
    },
  ],
};

describe('CommercialFareClassControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(flightsApi.fetchCommercialFlightControl).mockResolvedValue(control);
    vi.mocked(flightsApi.updateFlightSalesVisibility).mockResolvedValue({
      flightInstanceId: 'flight-1',
      publicSaleEnabled: true,
      version: 2,
    });
    vi.mocked(flightsApi.updateFareClassSitePrice).mockResolvedValue({} as never);
    vi.mocked(flightsApi.upsertAgencyFareRelease).mockResolvedValue({} as never);
  });

  it('renders a loading state while the commercial control is being fetched', () => {
    vi.mocked(flightsApi.fetchCommercialFlightControl).mockReturnValue(
      new Promise(() => undefined),
    );

    render(
      <CommercialFareClassControls
        instanceId="flight-1"
        canManage
        onNotice={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByText('در حال دریافت کنترل فروش…')).toBeInTheDocument();
  });

  it('reports the API error and does not fabricate controls', async () => {
    const onError = vi.fn();
    vi.mocked(flightsApi.fetchCommercialFlightControl).mockRejectedValue(
      new Error('پرواز یافت نشد.'),
    );

    render(
      <CommercialFareClassControls
        instanceId="missing-flight"
        canManage
        onNotice={vi.fn()}
        onError={onError}
      />,
    );

    await waitFor(() => expect(onError).toHaveBeenCalledWith('پرواز یافت نشد.'));
    expect(screen.queryByText('کنترل فروش کلاس‌های نرخی')).not.toBeInTheDocument();
  });

  it('renders the honest empty state when no fare class exists', async () => {
    vi.mocked(flightsApi.fetchCommercialFlightControl).mockResolvedValue({
      flightInstanceId: 'flight-1',
      publicSaleEnabled: false,
      fareClasses: [],
    });

    render(
      <CommercialFareClassControls
        instanceId="flight-1"
        canManage
        onNotice={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(
      await screen.findByText('ابتدا کلاس‌های نرخی این پرواز را تعریف کنید.'),
    ).toBeInTheDocument();
  });

  it('toggles public-site sale visibility through the API', async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    render(
      <CommercialFareClassControls
        instanceId="flight-1"
        canManage
        onNotice={onNotice}
        onError={vi.fn()}
      />,
    );

    const visibility = await screen.findByRole('checkbox', {
      name: 'فروش در سایت',
    });
    await user.click(visibility);

    await waitFor(() =>
      expect(flightsApi.updateFlightSalesVisibility).toHaveBeenCalledWith(
        'flight-1',
        true,
      ),
    );
    expect(onNotice).toHaveBeenCalledWith(
      'فروش این پرواز در سایت عمومی فعال شد.',
    );
  });

  it('sends تومان input as an exact IRR string with the change reason', async () => {
    const user = userEvent.setup();
    render(
      <CommercialFareClassControls
        instanceId="flight-1"
        canManage
        onNotice={vi.fn()}
        onError={vi.fn()}
      />,
    );

    const price = await screen.findByPlaceholderText('قیمت سایت (تومان)');
    await user.clear(price);
    await user.type(price, '4200000');
    await user.type(screen.getByPlaceholderText('دلیل تغییر قیمت'), 'افزایش تقاضا');
    await user.click(screen.getByRole('button', { name: 'ثبت قیمت سایت' }));

    await waitFor(() =>
      expect(flightsApi.updateFareClassSitePrice).toHaveBeenCalledWith(
        'flight-1',
        'rule-y',
        { priceIrr: '42000000', reason: 'افزایش تقاضا', seats: 10 },
      ),
    );
  });
});
