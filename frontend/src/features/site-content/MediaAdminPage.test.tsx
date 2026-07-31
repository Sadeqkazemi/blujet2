import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MediaAdminPage from './MediaAdminPage';
import * as siteContentApi from '../../api/site-content';

vi.mock('../../api/site-content');
vi.mock('../../api/files', () => ({
  uploadFile: vi.fn(),
}));

const mockBlocks = [
  {
    key: 'HERO_BANNER' as const,
    enabled: true,
    title: 'پرواز بعدی‌ات را با blujet رزرو کن',
    subtitle: 'بیش از ۲۰۰ مقصد',
    buttonText: 'مشاهده',
    badgeText: 'کش‌بک ۵٪',
    imageFileId: null,
    imageUrl: null,
  },
  {
    key: 'ANNOUNCEMENT_BAR' as const,
    enabled: true,
    title: 'اطلاعیه تست',
    subtitle: '',
    buttonText: 'مشاهده',
    badgeText: '',
    imageFileId: null,
    imageUrl: null,
  },
  {
    key: 'PROMO_BANNER' as const,
    enabled: true,
    title: 'تا ۴۰٪ تخفیف',
    subtitle: 'رزرو تا پایان مرداد',
    buttonText: 'مشاهده پروازها',
    badgeText: 'حراج تابستانه',
    imageFileId: null,
    imageUrl: null,
  },
];

const mockDestinations = [
  {
    id: 'd1',
    airportCode: 'IST',
    priceIrr: '42000000',
    imageFileId: null,
    sortOrder: 0,
  },
];

const mockRoutes = [
  {
    id: 'r1',
    fromAirportCode: 'THR',
    toAirportCode: 'MHD',
    priceIrr: '16000000',
    sortOrder: 0,
  },
];

describe('MediaAdminPage', () => {
  beforeEach(() => {
    vi.mocked(siteContentApi.fetchLibraryAssets).mockResolvedValue([]);
    vi.mocked(siteContentApi.fetchContentBlocks).mockResolvedValue(mockBlocks);
    vi.mocked(siteContentApi.fetchDestinations).mockResolvedValue(mockDestinations);
    vi.mocked(siteContentApi.fetchRoutes).mockResolvedValue(mockRoutes);
    vi.mocked(siteContentApi.updateContentBlock).mockResolvedValue(mockBlocks[0]);
    vi.mocked(siteContentApi.updateDestination).mockResolvedValue(mockDestinations[0]);
    vi.mocked(siteContentApi.updateRoute).mockResolvedValue(mockRoutes[0]);
  });

  it('renders banner and CMS sections', async () => {
    render(<MediaAdminPage />);
    expect(await screen.findByText('بنر اصلی سایت')).toBeInTheDocument();
    expect(screen.getByText('بنر اطلاع‌رسانی بالای هدر')).toBeInTheDocument();
    expect(screen.getByText('بنر تبلیغاتی میانی')).toBeInTheDocument();
    expect(screen.getByText('مقاصد محبوب')).toBeInTheDocument();
    expect(screen.getByText('مسیرهای پرتردد')).toBeInTheDocument();
    expect(screen.getByText('کتابخانهٔ تصاویر')).toBeInTheDocument();
  });

  it('shows seeded destination and route rows', async () => {
    render(<MediaAdminPage />);
    expect(await screen.findByText('IST')).toBeInTheDocument();
    expect(screen.getByText(/THR ← MHD/)).toBeInTheDocument();
  });

  it('opens hero banner editor', async () => {
    const user = userEvent.setup();
    render(<MediaAdminPage />);
    await screen.findByText('بنر اصلی سایت');
    await user.click(screen.getAllByRole('button', { name: 'ویرایش بنر' })[0]);
    expect(screen.getByDisplayValue('پرواز بعدی‌ات را با blujet رزرو کن')).toBeInTheDocument();
  });

  it('toggles announcement bar', async () => {
    const user = userEvent.setup();
    render(<MediaAdminPage />);
    await screen.findByText('بنر اطلاع‌رسانی بالای هدر');
    await user.click(screen.getByRole('button', { name: 'فعال' }));
    await waitFor(() => {
      expect(siteContentApi.updateContentBlock).toHaveBeenCalledWith('ANNOUNCEMENT_BAR', {
        enabled: false,
      });
    });
  });
});
