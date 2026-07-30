import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencySeatsPage from './AgencySeatsPage';
import * as portalApi from '../../api/agency-portal';
import * as useLocaleModule from '../../hooks/useLocale';
import type { AgencyAllotmentRow } from '../../types/agency-portal';

const ROWS: AgencyAllotmentRow[] = [
  {
    id: 'al1',
    route: 'تهران → دبی',
    flightNo: 'BJ-100',
    departureAt: '2026-08-01T05:00:00.000Z',
    aircraftType: 'Airbus A320',
    seatsAllocated: 20,
    seatsUsed: 12,
    type: 'HARD',
    releaseAt: null,
    contractPriceIrr: null,
    active: true,
  },
];

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgencySeatsPage', () => {
  it('renders real per-flight allotment cards with allocated/sold/remaining counts', async () => {
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    expect(await screen.findByTestId('alloc-card')).toBeInTheDocument();
    expect(screen.getByText('تخصیص‌یافته')).toBeInTheDocument();
    expect(screen.getByText('فعال')).toBeInTheDocument();
    expect(screen.getByText('۸')).toBeInTheDocument();
  });

  it('shows the empty state when the agency has no allotments', async () => {
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue([]);
    render(<AgencySeatsPage />);

    expect(await screen.findByText('هنوز سهمیه‌ای برای آژانس شما ثبت نشده است.')).toBeInTheDocument();
  });

  it('renders translated info banner and labels in English', async () => {
    mockLocale('en');
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    expect(await screen.findByText('Allocated')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/available for you to sell/)).toBeInTheDocument();
  });

  it('renders translated labels in Arabic', async () => {
    mockLocale('ar');
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    expect(await screen.findByText('مخصَّص')).toBeInTheDocument();
    expect(screen.getByText('نشط')).toBeInTheDocument();
  });
});
