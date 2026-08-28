import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgencyNoticesPage from './AgencyNoticesPage';
import * as agencyApi from '../../api/agency-portal';
import * as notificationsApi from '../../api/notifications';
import * as siteContentApi from '../../api/site-content';
import * as localeHook from '../../hooks/useLocale';
import type { NotificationRow } from '../../types/notifications';

const notification: NotificationRow = {
  id: 'notification-1',
  recipientId: 'agency-1',
  category: 'SYSTEM',
  action: 'CREATED',
  title: 'اصلاح ساعت پرواز',
  body: 'ساعت پرواز شما به ۱۰:۳۰ تغییر کرد.',
  entityType: 'AgencySeatRequest',
  entityId: 'request-1',
  dedupeKey: null,
  readAt: null,
  createdAt: '2026-08-27T08:00:00.000Z',
};

beforeEach(() => {
  vi.spyOn(localeHook, 'useLocale').mockReturnValue({ locale: 'fa', setLocale: vi.fn() });
  vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue({
    blocks: [{
      key: 'ANNOUNCEMENT_BAR',
      enabled: true,
      title: 'مدارک فروش مرداد',
      subtitle: 'لطفاً فایل تسویه را تا پایان روز ارسال کنید.',
      buttonText: 'مشاهده',
      badgeText: '',
      imageFileId: null,
      imageUrl: null,
    }],
    destinations: [],
    routes: [],
  });
  vi.spyOn(agencyApi, 'fetchSeatRequestOptions').mockResolvedValue([{
    flightInstanceId: 'flight-1',
    flightNo: 'XY1235',
    originCode: 'THR',
    destCode: 'MHD',
    departureAt: '2026-08-30T04:30:00.000Z',
    aircraftType: 'MD-80',
    cabin: 'ECONOMY',
    fareClassCode: 'Y',
    capacity: 140,
    agencySeatsReleased: 20,
    agencyAllocated: 5,
    ownAllocated: 0,
    availableToRequest: 15,
    pricePerSeatIrr: '58000000',
    specialOffer: false,
    definitionStatus: 'PUBLISHED',
  }]);
  vi.spyOn(notificationsApi, 'fetchNotifications').mockResolvedValue([notification]);
  vi.spyOn(notificationsApi, 'markNotificationRead').mockResolvedValue({
    ...notification,
    readAt: '2026-08-28T08:00:00.000Z',
  });
});
afterEach(() => vi.restoreAllMocks());

function renderPage() {
  return render(<MemoryRouter><AgencyNoticesPage /></MemoryRouter>);
}

describe('AgencyNoticesPage', () => {
  it('aggregates the site-admin notice, real available flight, and agency notification', async () => {
    renderPage();

    expect(await screen.findByText('مدارک فروش مرداد')).toBeInTheDocument();
    expect(screen.getByText('پرواز جدید XY1235')).toBeInTheDocument();
    expect(screen.getByText('اصلاح ساعت پرواز')).toBeInTheDocument();
    expect(siteContentApi.fetchPublicHomeContent).toHaveBeenCalledWith('fa');
    expect(agencyApi.fetchSeatRequestOptions).toHaveBeenCalledOnce();
    expect(notificationsApi.fetchNotifications).toHaveBeenCalledWith({ limit: 100, offset: 0 });
  });

  it('opens the full admin instruction when its row is clicked', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /مدارک فروش مرداد/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('لطفاً فایل تسویه را تا پایان روز ارسال کنید.')).toBeInTheDocument();
  });

  it('shows real flight details and links to the agency seat-request flow', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /پرواز جدید XY1235/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('THR → MHD');
    expect(dialog).toHaveTextContent('۱۵ صندلی');
    expect(within(dialog).getByRole('link', { name: 'مشاهده و درخواست صندلی' })).toHaveAttribute('href', '/agency/seats');
  });

  it('marks an unread agency notification as read when opened', async () => {
    renderPage();
    const user = userEvent.setup();

    const row = await screen.findByRole('button', { name: /اصلاح ساعت پرواز/ });
    expect(row).toHaveTextContent('خوانده‌نشده');
    await user.click(row);

    await waitFor(() => expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('notification-1'));
    expect(screen.getByRole('dialog')).toHaveTextContent('ساعت پرواز شما به ۱۰:۳۰ تغییر کرد.');
  });

  it('filters the list and keeps partial results when one source fails', async () => {
    vi.mocked(siteContentApi.fetchPublicHomeContent).mockRejectedValueOnce(new Error('offline'));
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('بخشی از اطلاعات در دسترس نیست');
    await user.click(screen.getByRole('tab', { name: /پروازها/ }));
    expect(screen.getByText('پرواز جدید XY1235')).toBeInTheDocument();
    expect(screen.queryByText('اصلاح ساعت پرواز')).not.toBeInTheDocument();
  });
});
