import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CareersApplyPage from './CareersApplyPage';
import * as careersApi from '../../api/careers';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';
import * as useCareersEnabledModule from '../../hooks/useCareersEnabled';
import type { JobDetail } from '../../types/careers';

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

const JOB: JobDetail = {
  id: 'j1',
  title: 'کارشناس پشتیبانی مسافران',
  dept: 'پشتیبانی',
  city: 'تهران',
  type: 'FULL_TIME',
  generalReqs: ['حداقل ۲ سال سابقه'],
  specialReqs: ['آشنایی با Excel'],
};

beforeEach(() => {
  vi.restoreAllMocks();
  mockLocale('fa');
  vi.spyOn(useCareersEnabledModule, 'useCareersEnabled').mockReturnValue(false);
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/careers/j1/apply']}>
      <Routes>
        <Route path="/careers/:jobId/apply" element={<CareersApplyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CareersApplyPage', () => {
  it('renders the job title, requirements and requires first/last name, national id and phone', async () => {
    vi.spyOn(careersApi, 'fetchJobDetail').mockResolvedValue(JOB);
    renderPage();

    expect(await screen.findByText('کارشناس پشتیبانی مسافران')).toBeInTheDocument();
    expect(screen.getByText('حداقل ۲ سال سابقه')).toBeInTheDocument();
    expect(screen.getByText('آشنایی با Excel')).toBeInTheDocument();
    expect(screen.getByTestId('apply-submit')).toBeDisabled();
  });

  it('shows a not-found message for an unknown or inactive job', async () => {
    vi.spyOn(careersApi, 'fetchJobDetail').mockRejectedValue(new Error('404'));
    renderPage();

    expect(await screen.findByText('این فرصت شغلی یافت نشد یا دیگر فعال نیست.')).toBeInTheDocument();
  });

  it('submits the application and shows the success state', async () => {
    vi.spyOn(careersApi, 'fetchJobDetail').mockResolvedValue(JOB);
    const apply = vi.spyOn(careersApi, 'applyToJob').mockResolvedValue({ id: 'app1' });

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await screen.findByText('کارشناس پشتیبانی مسافران');
    await userEvent.type(screen.getByTestId('apply-firstName'), 'نگار');
    await userEvent.type(screen.getByTestId('apply-lastName'), 'رضایی');
    await userEvent.type(screen.getByTestId('apply-nationalId'), '0012345679');
    await userEvent.type(screen.getByTestId('apply-phone'), '09121234567');

    const submit = screen.getByTestId('apply-submit');
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(apply).toHaveBeenCalledWith(
      'j1',
      expect.objectContaining({ firstName: 'نگار', lastName: 'رضایی', nationalId: '0012345679', phone: '09121234567' }),
    );
    expect(await screen.findByTestId('apply-sent')).toBeInTheDocument();
  });

  it('rejects a non-PDF resume before submission', async () => {
    vi.spyOn(careersApi, 'fetchJobDetail').mockResolvedValue(JOB);
    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await screen.findByText('کارشناس پشتیبانی مسافران');
    const file = new File(['x'], 'resume.txt', { type: 'text/plain' });
    // applyAccept:false — the `accept="application/pdf"` attribute is only
    // a UX hint; the component's own JS validation is what's under test.
    await userEvent.upload(screen.getByTestId('apply-resume'), file, { applyAccept: false });

    expect(await screen.findByText('فقط فایل PDF مجاز است.')).toBeInTheDocument();
    expect(screen.getByTestId('apply-submit')).toBeDisabled();
  });
});
