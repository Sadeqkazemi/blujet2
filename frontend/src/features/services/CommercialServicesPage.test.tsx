import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as travelCostsApi from '../../api/travel-costs';
import CommercialServicesPage from './CommercialServicesPage';

vi.mock('../../api/travel-costs');

const insurance = {
  id: 'cost-1',
  code: 'TRAVEL_INSURANCE' as const,
  titleFa: 'بیمه مسافرتی',
  titleEn: null,
  titleAr: null,
  descriptionFa: 'پوشش کامل تأخیر و خسارت',
  billingUnit: 'PER_PASSENGER' as const,
  priceIrr: '3200000',
  active: true,
  purchaseEnabled: true,
  sortOrder: 0,
};

describe('CommercialServicesPage', () => {
  beforeEach(() => {
    vi.mocked(travelCostsApi.fetchTravelCosts).mockResolvedValue([insurance]);
    vi.mocked(travelCostsApi.updateTravelCost).mockImplementation(async (_id, payload) => ({
      ...insurance,
      ...payload,
    }));
  });

  it('renders real API rows and saves the edited toman price as rial', async () => {
    const user = userEvent.setup();
    render(<CommercialServicesPage />);

    expect(await screen.findByText('بیمه مسافرتی')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'قیمت بیمه مسافرتی' });
    await user.clear(input);
    await user.type(input, '450000');
    await user.click(screen.getByRole('button', { name: 'ثبت قیمت' }));

    await waitFor(() => {
      expect(travelCostsApi.updateTravelCost).toHaveBeenCalledWith('cost-1', {
        priceIrr: '4500000',
      });
    });
    expect(await screen.findByText('قیمت «بیمه مسافرتی» ذخیره شد.')).toBeInTheDocument();
  });

  it('updates active and purchase visibility together from the design toggle', async () => {
    const user = userEvent.setup();
    render(<CommercialServicesPage />);
    await screen.findByText('بیمه مسافرتی');

    await user.click(screen.getByRole('switch', { name: '' }));

    await waitFor(() => {
      expect(travelCostsApi.updateTravelCost).toHaveBeenCalledWith('cost-1', {
        active: false,
        purchaseEnabled: false,
      });
    });
  });
});
