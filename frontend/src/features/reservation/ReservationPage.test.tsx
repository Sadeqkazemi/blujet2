import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReservationPage from './ReservationPage';
import * as reservationApi from '../../api/reservation';
import * as agenciesApi from '../../api/agencies';
import * as flightsApi from '../../api/flights';
import * as useAuthModule from '../../hooks/useAuth';
import { mockAuthUserWithRole } from '../../test/mockAuthUser';
import type { PnrDetail, PnrGroup, ReservationDashboardStats, SeatMap } from '../../types/reservation';
import type { Role } from '../../types/auth';

const GROUPS: PnrGroup[] = [
  {
    flightInstanceId: 'fi1',
    flightNo: 'EP-821',
    route: 'THR → DXB',
    departureAt: '2026-08-01T05:00:00.000Z',
    rows: [{ pnr: 'BJDEMO1', passenger: 'نگار رضایی', channel: 'SYSTEM', status: 'TICKETED' }],
  },
];

const DETAIL: PnrDetail = {
  pnr: 'BJDEMO1',
  status: 'TICKETED',
  channel: 'SYSTEM',
  priceIrr: '380000000',
  flightNo: 'EP-821',
  originCode: 'THR',
  destCode: 'DXB',
  departureAt: '2026-08-01T05:00:00.000Z',
  arrivalAt: '2026-08-01T08:00:00.000Z',
  flightInstanceId: 'fi1',
  passenger: { fullName: 'نگار رضایی', seatCode: '3A' },
};

const STATS: ReservationDashboardStats = {
  todayBookings: 2,
  activePnrs: 5,
  seatsSold: 12,
  revenueIrr: '1000000000',
};

const FREE_SEAT_MAP: SeatMap = {
  flightInstanceId: 'fi1',
  aircraftType: 'MD-88',
  cabinLayout: { BUSINESS: { aisleAfterIndex: 2 }, ECONOMY: { aisleAfterIndex: 2 } },
  capacity: 10,
  soldCount: 1,
  lockedCount: 0,
  occupancyPct: 10,
  rows: [
    {
      row: 3,
      cabin: 'BUSINESS',
      seats: [
        { seatCode: '3A', status: 'SOLD', lockId: null },
        { seatCode: '3B', status: 'FREE', lockId: null },
        { seatCode: '3E', status: 'FREE', lockId: null },
        { seatCode: '3F', status: 'FREE', lockId: null },
      ],
    },
  ],
};

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: mockAuthUserWithRole(role),
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

describe('ReservationPage', () => {
  it('BOARD_CHAIR sees the full 4-tab ReservationSystem (not lock-only plane mode)', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);

    render(<ReservationPage />);
    expect(await screen.findByRole('button', { name: 'داشبورد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مدیریت رزروها' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'دسترسی آژانس‌ها' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'پروازها' })).toBeInTheDocument();
    expect(screen.queryByText('هواپیما — رزرو صندلی')).not.toBeInTheDocument();
    expect(await screen.findByText('رزروهای امروز')).toBeInTheDocument();
  });

  it('BOARD_CHAIR opens seat map from the پروازها tab and can lock a seat', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);
    vi.spyOn(flightsApi, 'fetchFlightsOverview').mockResolvedValue({
      kpis: { activeCount: 1, soldSeats: 1, meanOccupancyPct: 10 },
      active: [
        {
          id: 'fi1',
          flightNo: 'EP-821',
          originCode: 'THR',
          destCode: 'DXB',
          departureAt: '2026-08-01T05:00:00.000Z',
          capacity: 146,
          charterSeats: 0,
          sold: 10,
          basePriceIrr: '380000000',
          derivedStatus: 'SELLING',
        },
      ],
      completed: { rows: [], kpis: { totalSalesIrr: '0', totalProfitIrr: '0', totalTickets: 0, flightCount: 0 } },
      future: [],
    });
    vi.spyOn(reservationApi, 'fetchSeatMap').mockResolvedValue(FREE_SEAT_MAP);
    const lockSpy = vi.spyOn(reservationApi, 'lockSeat').mockResolvedValue({
      id: 'lock1',
      flightInstanceId: 'fi1',
      seatCode: '3B',
      lockedById: 'u1',
      passengerName: null,
      releasedById: null,
      releasedAt: null,
      createdAt: '2026-08-01T05:00:00.000Z',
    });

    render(<ReservationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'پروازها' }));
    await user.click(await screen.findByText('تهران ← دبی'));
    expect(await screen.findByText(/نقشه صندلی‌ها/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '3B' }));
    expect(await screen.findByText(/لاک دستی صندلی/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'مسدود کردن توسط شرکت هواپیمایی (بدون PNR)' }));
    await waitFor(() =>
      expect(lockSpy).toHaveBeenCalledWith(
        'fi1',
        expect.objectContaining({ seatCode: '3B', classification: 'FREE' }),
      ),
    );
  });

  it('BOARD_CHAIR sees PNR list and change-seat/cancel controls in the detail modal', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);
    vi.spyOn(reservationApi, 'fetchPnrDetail').mockResolvedValue(DETAIL);

    render(<ReservationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'مدیریت رزروها' }));
    expect(await screen.findByText('نگار رضایی')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /BJDEMO1/ }));
    expect(await screen.findByRole('button', { name: 'ثبت تغییر' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'لغو رزرو' })).toBeInTheDocument();
  });

  it('BOARD_CHAIR agency tab loads agency cards', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);
    vi.spyOn(agenciesApi, 'fetchAgencies').mockResolvedValue({
      agencies: [
        {
          id: 'ag1',
          fullName: 'آژانس blujet',
          managerName: 'مدیر',
          licenseNo: '1',
          city: 'تهران',
          tier: 'GOLD',
          isActive: true,
          limitIrr: '0',
          usedIrr: '0',
          remainingIrr: '0',
          pendingInvoiceCount: 0,
        },
      ],
      kpis: {
        activeCount: 1,
        totalCreditGrantedIrr: '0',
        totalUsedIrr: '0',
        pendingSettlementCount: 0,
      },
    });
    vi.spyOn(agenciesApi, 'fetchAgencyApiKeys').mockResolvedValue([
      {
        id: 'key1',
        agencyId: 'ag1',
        keyHash: 'hash',
        scope: 'FULL',
        status: 'ACTIVE',
        activatedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: null,
        lastUsedAt: null,
        callCount: 1284,
      },
    ]);

    render(<ReservationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'دسترسی آژانس‌ها' }));
    expect(await screen.findByText('آژانس blujet')).toBeInTheDocument();
    expect(screen.getByText('فعال')).toBeInTheDocument();
  });

  it('SENIOR_MANAGER is view-only: no change-seat/cancel controls in the detail modal', async () => {
    mockRole('SENIOR_MANAGER');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);
    vi.spyOn(reservationApi, 'fetchPnrDetail').mockResolvedValue(DETAIL);

    render(<ReservationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'BJDEMO1' }));

    await waitFor(() => expect(screen.getByText('رزرو BJDEMO1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'ثبت تغییر' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'لغو رزرو' })).not.toBeInTheDocument();
  });

  it('searches PNRs by query', async () => {
    mockRole('IT_MANAGER');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    const listSpy = vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);

    render(<ReservationPage />);
    await screen.findByText('نگار رضایی');

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('جستجو با کد PNR یا نام مسافر…'), 'نگار');

    await waitFor(() => expect(listSpy).toHaveBeenCalledWith('نگار'));
  });

  it('renders the aisle gap from cabinLayout.aisleAfterIndex per row, not a fixed seat position', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);
    vi.spyOn(flightsApi, 'fetchFlightsOverview').mockResolvedValue({
      kpis: { activeCount: 1, soldSeats: 0, meanOccupancyPct: 0 },
      active: [
        {
          id: 'fi1',
          flightNo: 'EP-821',
          originCode: 'THR',
          destCode: 'DXB',
          departureAt: '2026-08-01T05:00:00.000Z',
          capacity: 9,
          charterSeats: 0,
          sold: 0,
          basePriceIrr: null,
          derivedStatus: 'SELLING',
        },
      ],
      completed: { rows: [], kpis: { totalSalesIrr: '0', totalProfitIrr: '0', totalTickets: 0, flightCount: 0 } },
      future: [],
    });
    const seatMap: SeatMap = {
      flightInstanceId: 'fi1',
      aircraftType: 'CUSTOM',
      cabinLayout: { BUSINESS: { aisleAfterIndex: 1 }, ECONOMY: { aisleAfterIndex: 3 } },
      capacity: 9,
      soldCount: 0,
      lockedCount: 0,
      occupancyPct: 0,
      rows: [
        {
          row: 3,
          cabin: 'BUSINESS',
          seats: [
            { seatCode: '3A', status: 'FREE', lockId: null },
            { seatCode: '3B', status: 'FREE', lockId: null },
            { seatCode: '3C', status: 'FREE', lockId: null },
            { seatCode: '3D', status: 'FREE', lockId: null },
          ],
        },
        {
          row: 10,
          cabin: 'ECONOMY',
          seats: [
            { seatCode: '10A', status: 'FREE', lockId: null },
            { seatCode: '10B', status: 'FREE', lockId: null },
            { seatCode: '10C', status: 'FREE', lockId: null },
            { seatCode: '10D', status: 'FREE', lockId: null },
            { seatCode: '10E', status: 'FREE', lockId: null },
          ],
        },
      ],
    };
    vi.spyOn(reservationApi, 'fetchSeatMap').mockResolvedValue(seatMap);

    render(<ReservationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'پروازها' }));
    await user.click(await screen.findByText('تهران ← دبی'));

    const businessGap = await screen.findByTestId('aisle-gap-3');
    expect(businessGap.parentElement!.querySelector('button')).toHaveAttribute('aria-label', '3A');

    const economyGap = screen.getByTestId('aisle-gap-10');
    expect(economyGap.parentElement!.querySelector('button')).toHaveAttribute('aria-label', '10C');
  });

  it('a canLock role can mark a TICKETED booking as no-show, and the detail refreshes', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);
    vi.spyOn(reservationApi, 'fetchPnrDetail').mockResolvedValue(DETAIL);
    const noShowSpy = vi
      .spyOn(reservationApi, 'markNoShow')
      .mockResolvedValue({ ...DETAIL, status: 'NO_SHOW' });

    render(<ReservationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'مدیریت رزروها' }));
    await user.click(await screen.findByRole('button', { name: /BJDEMO1/ }));
    await user.click(await screen.findByRole('button', { name: 'ثبت عدم حضور مسافر' }));

    await waitFor(() => expect(noShowSpy).toHaveBeenCalledWith('BJDEMO1'));
    expect(await screen.findByText('عدم حضور مسافر ثبت شد.')).toBeInTheDocument();
  });

  it('no-show is not offered for a CANCELLED booking', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(reservationApi, 'fetchReservationDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reservationApi, 'fetchPnrList').mockResolvedValue(GROUPS);
    vi.spyOn(reservationApi, 'fetchPnrDetail').mockResolvedValue({ ...DETAIL, status: 'CANCELLED' });

    render(<ReservationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'مدیریت رزروها' }));
    await user.click(await screen.findByRole('button', { name: /BJDEMO1/ }));

    await waitFor(() => expect(screen.getByText('رزرو BJDEMO1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'ثبت عدم حضور مسافر' })).not.toBeInTheDocument();
  });
});
