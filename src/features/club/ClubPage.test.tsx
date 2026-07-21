import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ClubPage from './ClubPage';
import * as clubApi from '../../api/club';
import * as useAuthModule from '../../hooks/useAuth';
import type { ClubCardRequest, ClubMembersResult } from '../../types/club';
import type { Role } from '../../types/auth';

const MEMBERS: ClubMembersResult = {
  members: [
    {
      id: 'm1',
      fullName: 'نگار رضایی',
      email: 'negar@email.example',
      birthDate: '1993-08-05T00:00:00.000Z',
      joinDate: '2025-05-31T00:00:00.000Z',
      points: 12450,
      level: 'GOLD',
      cardStatus: 'ISSUED',
      cardNo: 'GOLD-8842',
      issuedByLabelFa: 'رئیس هیئت مدیره (تأیید درخواست)',
    },
    {
      id: 'm2',
      fullName: 'سارا احمدی',
      email: 'sahmadi@email.example',
      birthDate: null,
      joinDate: '2026-01-20T00:00:00.000Z',
      points: 2100,
      level: 'SILVER',
      cardStatus: 'NONE',
      cardNo: null,
      issuedByLabelFa: null,
    },
  ],
  kpis: {
    totalMembers: 2,
    issuedCards: 1,
    pendingRequests: 1,
    tierCounts: { SILVER: 1, GOLD: 1, PLATINUM: 0 },
  },
};

const SENIOR_REQ: ClubCardRequest = {
  id: 'r1',
  memberId: 'm2',
  member: { id: 'm2', fullName: 'سارا احمدی', email: 'sahmadi@email.example', points: 5100, level: 'SILVER' },
  level: 'SILVER',
  points: 5100,
  status: 'REFERRED',
  assignedTo: 'SENIOR',
  cardNo: null,
  history: [{ step: 'referred', labelFa: 'ارجاع به مدیر ارشد توسط ادمین سایت', at: '۱۴۰۵/۰۴/۰۲' }],
  createdAt: '2026-07-01T00:00:00.000Z',
};

const CHAIR_REQ: ClubCardRequest = {
  ...SENIOR_REQ,
  id: 'r2',
  assignedTo: 'CHAIR',
};

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: { id: 'u1', fullName: 'کاربر تست', role },
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ClubPage />
    </MemoryRouter>,
  );
}

describe('ClubPage', () => {
  it('CEO sees the 4 KPI cards, add-VIP button, tier filters, search and member rows with Persian points', async () => {
    mockRole('CEO');
    vi.spyOn(clubApi, 'fetchClubMembers').mockResolvedValue(MEMBERS);
    vi.spyOn(clubApi, 'fetchCardRequests').mockResolvedValue([SENIOR_REQ]);

    renderPage();

    expect(await screen.findByText('کل اعضای باشگاه')).toBeInTheDocument();
    expect(screen.getByText('کارت‌های صادرشده')).toBeInTheDocument();
    expect(screen.getByText('درخواست در انتظار')).toBeInTheDocument();
    expect(screen.getByText('توزیع سطوح عضویت')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تعریف مشتری VIP جدید' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'همه سطوح' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('جستجو در نام، ایمیل، شماره ملی یا کارت…')).toBeInTheDocument();

    expect(screen.getByText('نگار رضایی')).toBeInTheDocument();
    expect(screen.getByText(/۱۲٬۴۵۰/)).toBeInTheDocument();
    expect(screen.getByText('GOLD-8842')).toBeInTheDocument();
    // Member without a card gets the direct-issue button.
    expect(screen.getByText('بدون کارت')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'صدور کارت' })).toBeInTheDocument();
    // CEO reviews requests via the modal, not inline buttons.
    expect(screen.getByRole('button', { name: 'بررسی درخواست' })).toBeInTheDocument();
  });

  it('Senior Manager sees the simple layout: no KPIs/search/add-form, inline approve for senior-assigned, read-only note for chair-assigned', async () => {
    mockRole('SENIOR_MANAGER');
    vi.spyOn(clubApi, 'fetchClubMembers').mockResolvedValue(MEMBERS);
    vi.spyOn(clubApi, 'fetchCardRequests').mockResolvedValue([SENIOR_REQ, CHAIR_REQ]);

    renderPage();

    expect(await screen.findByText('درخواست‌های صدور کارت (ارجاع‌شده)')).toBeInTheDocument();
    expect(screen.queryByText('کل اعضای باشگاه')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تعریف مشتری VIP جدید' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('جستجو در نام، ایمیل، شماره ملی یا کارت…')).not.toBeInTheDocument();

    expect(await screen.findByRole('button', { name: 'تأیید و صدور کارت' })).toBeInTheDocument();
    expect(screen.getByText('ارجاع‌شده به رئیس هیئت مدیره — در انتظار تأیید')).toBeInTheDocument();
  });

  it('CEO request modal shows the روند درخواست timeline and approving calls the API', async () => {
    mockRole('CEO');
    vi.spyOn(clubApi, 'fetchClubMembers').mockResolvedValue(MEMBERS);
    vi.spyOn(clubApi, 'fetchCardRequests').mockResolvedValue([SENIOR_REQ]);
    const approve = vi
      .spyOn(clubApi, 'approveCardRequest')
      .mockResolvedValue({ ...SENIOR_REQ, status: 'APPROVED', cardNo: 'SILV-1234' });

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'بررسی درخواست' }));
    expect(screen.getByText('روند درخواست')).toBeInTheDocument();
    expect(screen.getByText('ارجاع به مدیر ارشد توسط ادمین سایت')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'تأیید و صدور کارت' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText(/کارت نقره‌ای برای «سارا احمدی» صادر شد ✓/)).toBeInTheDocument();
  });

  it('the add-VIP form validates required fields', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(clubApi, 'fetchClubMembers').mockResolvedValue(MEMBERS);
    vi.spyOn(clubApi, 'fetchCardRequests').mockResolvedValue([]);
    const create = vi.spyOn(clubApi, 'createClubMember');

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'تعریف مشتری VIP جدید' }));
    await userEvent.click(screen.getByRole('button', { name: 'افزودن به باشگاه' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('نام، ایمیل و شماره ملی الزامی است.');
    expect(create).not.toHaveBeenCalled();
  });
});
