import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AgencyLoginPage from './AgencyLoginPage';
import * as useAuthModule from '../../hooks/useAuth';
import * as agenciesApi from '../../api/agencies';

function mockAuth(agencyLogin = vi.fn()) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin,
    signOut: vi.fn(),
  });
}

describe('AgencyLoginPage', () => {
  it('requires phone and password before submitting', async () => {
    const agencyLogin = vi.fn();
    mockAuth(agencyLogin);
    render(
      <MemoryRouter>
        <AgencyLoginPage />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'ورود به پنل آژانس' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('شماره تماس و رمز عبور را وارد کنید.');
    expect(agencyLogin).not.toHaveBeenCalled();
  });

  it('calls agencyLogin with phone+password, no 2FA step', async () => {
    const agencyLogin = vi.fn().mockResolvedValue({ id: 'a1', fullName: 'آژانس تست', role: 'AGENCY' });
    mockAuth(agencyLogin);
    render(
      <MemoryRouter>
        <AgencyLoginPage />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('شماره تماس آژانس'), '+989120000002');
    await user.type(screen.getByLabelText('رمز عبور'), 'Blujet@1404');
    await user.click(screen.getByRole('button', { name: 'ورود به پنل آژانس' }));

    expect(agencyLogin).toHaveBeenCalledWith('+989120000002', 'Blujet@1404');
  });

  it('signup tab: requests OTP, submits the request, shows the pending-review message', async () => {
    mockAuth();
    const requestOtp = vi
      .spyOn(agenciesApi, 'requestAgencySignupOtp')
      .mockResolvedValue({ challengeId: 'ch1' });
    const submitRequest = vi
      .spyOn(agenciesApi, 'submitAgencyRequest')
      .mockResolvedValue({ id: 'req1' });

    render(
      <MemoryRouter>
        <AgencyLoginPage />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'ثبت‌نام' }));

    await user.type(screen.getByLabelText('نام آژانس'), 'آژانس مسافرتی پرشین');
    await user.type(screen.getByLabelText('شماره مجوز بند ب'), 'XXXX-1234');
    await user.type(screen.getByLabelText('نام مدیر آژانس'), 'نگار رضایی');
    await user.type(screen.getByLabelText('شماره موبایل'), '09121234567');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'ثبت درخواست و دریافت کد' }));

    expect(requestOtp).toHaveBeenCalledWith('09121234567');

    const codeInput = await screen.findByLabelText(/کد تأیید ۶ رقمی/);
    await user.type(codeInput, '482913');
    await user.click(screen.getByRole('button', { name: 'تأیید و ثبت درخواست' }));

    await screen.findByText(/درخواست همکاری شما ثبت شد/);
    expect(submitRequest).toHaveBeenCalledWith({
      applicantName: 'آژانس مسافرتی پرشین',
      managerName: 'نگار رضایی',
      licenseNo: 'XXXX-1234',
      phone: '09121234567',
      challengeId: 'ch1',
      code: '482913',
    });
  });
});
