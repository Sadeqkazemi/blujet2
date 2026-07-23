import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MyReferralsPage from './MyReferralsPage';
import * as cartableApi from '../../api/cartable';
import type { MyReferral, MyReferralListResult } from '../../types/cartable';

afterEach(() => {
  vi.restoreAllMocks();
});

const REFERRAL: MyReferral = {
  id: 'r1',
  title: 'گزارش فروش سه‌ماهه',
  body: 'لطفاً گزارش فروش سه‌ماهه را آماده کنید.',
  priority: 'HIGH',
  status: 'SENT',
  dueAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  from: { id: 'sm1', fullName: 'محمد رحیمی', role: 'SENIOR_MANAGER' },
  hasMyReport: false,
};

function mockList(referrals: MyReferral[]) {
  const result: MyReferralListResult = {
    referrals,
    counts: {
      total: referrals.length,
      awaitingMyReport: referrals.filter((r) => !r.hasMyReport && r.status !== 'CLOSED').length,
    },
  };
  vi.spyOn(cartableApi, 'fetchMyReferrals').mockResolvedValue(result);
  return result;
}

describe('MyReferralsPage', () => {
  it('renders the empty state when nothing is assigned', async () => {
    mockList([]);
    render(<MyReferralsPage />);
    expect(await screen.findByTestId('my-referrals-empty')).toBeInTheDocument();
  });

  it('lists referrals assigned to me with KPI counts', async () => {
    mockList([REFERRAL]);
    render(<MyReferralsPage />);

    expect(await screen.findByText('گزارش فروش سه‌ماهه')).toBeInTheDocument();
    expect(screen.getByText('در انتظار اقدام')).toBeInTheDocument();
    expect(screen.getByText(/محمد رحیمی/)).toBeInTheDocument();
  });

  it('opens a referral detail and submits a real report', async () => {
    mockList([REFERRAL]);
    const submitSpy = vi.spyOn(cartableApi, 'submitReferralReport').mockResolvedValue({
      id: 'r1',
      title: REFERRAL.title,
      body: REFERRAL.body,
      priority: 'HIGH',
      status: 'REPORTED',
      dueAt: null,
      createdAt: REFERRAL.createdAt,
      recipients: [],
    });

    render(<MyReferralsPage />);
    await userEvent.click(await screen.findByTestId('my-referral-r1'));

    expect(await screen.findByText('لطفاً گزارش فروش سه‌ماهه را آماده کنید.')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('referral-report-body'), 'گزارش من آماده است.');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت گزارش' }));

    expect(submitSpy).toHaveBeenCalledWith('r1', 'گزارش من آماده است.');
    expect(await screen.findByText('گزارش شما ثبت شد ✓')).toBeInTheDocument();
  });

  it('requires non-empty report text before submitting', async () => {
    mockList([REFERRAL]);
    const submitSpy = vi.spyOn(cartableApi, 'submitReferralReport');

    render(<MyReferralsPage />);
    await userEvent.click(await screen.findByTestId('my-referral-r1'));
    await userEvent.click(screen.getByRole('button', { name: 'ثبت گزارش' }));

    expect(await screen.findByText('متن گزارش را وارد کنید.')).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('a CLOSED referral shows no report form', async () => {
    mockList([{ ...REFERRAL, status: 'CLOSED', hasMyReport: true }]);
    render(<MyReferralsPage />);

    await userEvent.click(await screen.findByTestId('my-referral-r1'));
    expect(await screen.findByText('این ارجاع بسته شده است.')).toBeInTheDocument();
    expect(screen.queryByTestId('referral-report-body')).not.toBeInTheDocument();
  });
});
