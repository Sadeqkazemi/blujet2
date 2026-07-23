import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PricingPage from './PricingPage';
import * as pricingApi from '../../api/pricing';
import * as authApi from '../../api/auth';
import * as useAuthModule from '../../hooks/useAuth';
import type { CeoPricingResult, CommercialPricingResult, PricingProposal } from '../../types/pricing';
import type { Role } from '../../types/auth';

const PROPOSAL: PricingProposal = {
  id: 'pp1',
  flightInstanceId: 'fi1',
  basePriceIrr: 38_000_000,
  competitorPriceIrr: 39_000_000,
  proposedPriceIrr: 38_500_000,
  legalRateIrr: 42_000_000,
  note: 'قیمت کمی پایین‌تر از رقبا برای پرکردن صندلی‌های آزاد.',
  status: 'PENDING',
  registeredPriceIrr: null,
  approvedAt: null,
  aiSuggestion: null,
  createdAt: '2026-07-10T00:00:00.000Z',
  proposedBy: { id: 'u1', fullName: 'رضا مرادی', role: 'COMMERCIAL_MANAGER' },
  approvedBy: null,
  flightInstance: {
    id: 'fi1',
    departureAt: '2026-07-27T08:30:00.000Z',
    capacity: 180,
    charterSeats: 60,
    flight: { flightNo: 'EP-821', route: { originCode: 'THR', destCode: 'DXB' } },
  },
};

const WITH_AI: PricingProposal = {
  ...PROPOSAL,
  id: 'pp2',
  aiSuggestion: {
    priceIrr: 39_200_000,
    reason: 'با توجه به فصل تابستان و قیمت رقبا، نرخ پیشنهادی مدل هم‌تراز رقباست.',
    factors: ['فصل: اوج سفرهای تابستانی', 'موقعیت رقابتی: هم‌تراز با میانگین رقبا'],
    season: 'اوج سفرهای تابستانی',
    occasion: 'بدون مناسبت خاص',
    confidence: 0.85,
    modelVersion: 'heuristic-v1.0.0',
    generatedAt: '2026-07-17T00:00:00.000Z',
  },
};

const REGISTERED: PricingProposal = {
  ...PROPOSAL,
  id: 'pp3',
  status: 'REGISTERED',
  registeredPriceIrr: 38_500_000,
  approvedBy: { id: 'u2', fullName: 'محمد رحیمی', role: 'CEO' },
  approvedAt: '2026-07-15T00:00:00.000Z',
};

const CEO_DATA: CeoPricingResult = { pending: [PROPOSAL, WITH_AI], registered: [REGISTERED] };

const COMMERCIAL_DATA: CommercialPricingResult = {
  flights: [
    {
      id: 'fi1',
      departureAt: '2026-07-27T08:30:00.000Z',
      capacity: 180,
      charterSeats: 60,
      flight: { flightNo: 'EP-821', route: { originCode: 'THR', destCode: 'DXB' } },
      pricing: PROPOSAL,
    },
    {
      id: 'fi2',
      departureAt: '2026-08-06T08:30:00.000Z',
      capacity: 180,
      charterSeats: 60,
      flight: { flightNo: 'EP-822', route: { originCode: 'THR', destCode: 'IST' } },
      pricing: null,
    },
    {
      id: 'fi3',
      departureAt: '2026-08-16T08:30:00.000Z',
      capacity: 180,
      charterSeats: 60,
      flight: { flightNo: 'EP-823', route: { originCode: 'MHD', destCode: 'KIH' } },
      pricing: REGISTERED,
    },
  ],
};

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: { id: 'me', fullName: 'کاربر تست', role },
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PricingPage />
    </MemoryRouter>,
  );
}

describe('PricingPage', () => {
  it('CEO sees the workflow banner, AI button, pending cards with the three price columns and register buttons', async () => {
    mockRole('CEO');
    vi.spyOn(pricingApi, 'fetchCeoPricing').mockResolvedValue(CEO_DATA);

    renderPage();

    expect(await screen.findByText('۱ پیشنهاد مدیر بازرگانی')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تحلیل و پیشنهاد قیمت هوش مصنوعی' })).toBeInTheDocument();
    expect(screen.getByText('در انتظار تأیید مدیر عامل')).toBeInTheDocument();
    // 38,500,000 rial -> ۳٬۸۵۰٬۰۰۰ toman
    expect(screen.getAllByText('۳٬۸۵۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'تأیید بازرگانی' })).toHaveLength(2);
    // «ثبت با AI» only on the card with a persisted suggestion.
    expect(screen.getAllByRole('button', { name: 'ثبت با AI' })).toHaveLength(1);
    expect(screen.getByText('تحلیل کامل هوش مصنوعی')).toBeInTheDocument();
    expect(screen.getByText(/یادداشت مدیر بازرگانی/)).toBeInTheDocument();
    // Registered list with the locked badge.
    expect(screen.getByText('قیمت‌های ثبت‌شده')).toBeInTheDocument();
    expect(screen.getByText('قفل‌شده')).toBeInTheDocument();
  });

  it('CEO registering with AI calls the API with source=AI', async () => {
    mockRole('CEO');
    vi.spyOn(pricingApi, 'fetchCeoPricing').mockResolvedValue(CEO_DATA);
    vi.spyOn(authApi, 'requestStepUp').mockResolvedValue({ challengeId: 'ch1' });
    const register = vi.spyOn(pricingApi, 'registerProposal').mockResolvedValue(REGISTERED);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'ثبت با AI' }));

    const stepUpDialog = await screen.findByRole('dialog', { name: 'تأیید مجدد هویت' });
    await userEvent.type(within(stepUpDialog).getByRole('textbox'), '482913');
    await userEvent.click(within(stepUpDialog).getByRole('button', { name: 'تأیید' }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith('pp2', 'AI', { stepUpChallengeId: 'ch1', stepUpCode: '482913' }),
    );
    expect(await screen.findByText('قیمت پرواز تأیید و ثبت شد ✓')).toBeInTheDocument();
  });

  it('CEO AI-analysis outage shows the graceful degradation message', async () => {
    mockRole('CEO');
    vi.spyOn(pricingApi, 'fetchCeoPricing').mockResolvedValue(CEO_DATA);
    vi.spyOn(pricingApi, 'runAiAnalysis').mockResolvedValue({ analyzed: 0, available: false });

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'تحلیل و پیشنهاد قیمت هوش مصنوعی' }));
    expect(
      await screen.findByText('سرویس تحلیل هوش مصنوعی در دسترس نیست؛ تأیید قیمت پیشنهادی همچنان ممکن است.'),
    ).toBeInTheDocument();
  });

  it('Commercial sees the three row states and the correct button labels', async () => {
    mockRole('COMMERCIAL_MANAGER');
    vi.spyOn(pricingApi, 'fetchCommercialPricing').mockResolvedValue(COMMERCIAL_DATA);

    renderPage();

    expect(await screen.findByText('تعیین قیمت پرواز و ارسال به مدیر عامل')).toBeInTheDocument();
    expect(screen.getByText('در انتظار تأیید مدیر عامل')).toBeInTheDocument();
    expect(screen.getByText('قیمت‌گذاری نشده')).toBeInTheDocument();
    expect(screen.getByText('تأییدشده و قفل‌شده')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ویرایش پیشنهاد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تعیین قیمت' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'قفل‌شده' })).toBeDisabled();
  });

  it('Commercial set-price modal validates the proposed price and submits toman→rial', async () => {
    mockRole('COMMERCIAL_MANAGER');
    vi.spyOn(pricingApi, 'fetchCommercialPricing').mockResolvedValue(COMMERCIAL_DATA);
    const upsert = vi.spyOn(pricingApi, 'upsertProposal').mockResolvedValue(PROPOSAL);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'تعیین قیمت' }));
    await userEvent.click(screen.getByRole('button', { name: 'ارسال نرخ پیشنهادی برای تأیید مدیر عامل' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('نرخ پیشنهادی را وارد کنید');
    expect(upsert).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('نرخ پیشنهادی (تومان)'), '3850000');
    await userEvent.click(screen.getByRole('button', { name: 'ارسال نرخ پیشنهادی برای تأیید مدیر عامل' }));
    // 3,850,000 toman -> 38,500,000 rial
    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith('fi2', {
        proposedPriceIrr: 38_500_000,
        legalRateIrr: undefined,
        note: undefined,
      }),
    );
    expect(await screen.findByText('نرخ پیشنهادی برای تأیید به مدیر عامل ارسال شد ✓')).toBeInTheDocument();
  });
});
