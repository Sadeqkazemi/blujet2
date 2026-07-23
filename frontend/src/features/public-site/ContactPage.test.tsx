import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContactPage from './ContactPage';
import * as contactApi from '../../api/contact';
import * as useAuthModule from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';

beforeEach(() => {
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
    <MemoryRouter>
      <ContactPage />
    </MemoryRouter>,
  );
}

describe('ContactPage', () => {
  it('requires name, phone, subject and message before submitting', async () => {
    renderPage();
    expect(screen.getByTestId('contact-submit')).toBeDisabled();

    await userEvent.type(screen.getByTestId('contact-name'), 'نگار رضایی');
    await userEvent.type(screen.getByTestId('contact-phone'), '09121234567');
    expect(screen.getByTestId('contact-submit')).toBeDisabled();

    await userEvent.type(screen.getByTestId('contact-subject'), 'مشکل در پرداخت');
    await userEvent.type(screen.getByTestId('contact-msg'), 'سلام، سوال داشتم.');
    expect(screen.getByTestId('contact-submit')).toBeEnabled();
  });

  it('submits a real contact message and shows the sent state', async () => {
    const submit = vi.spyOn(contactApi, 'submitContactMessage').mockResolvedValue({
      id: 'c1',
      name: 'نگار رضایی',
      phone: '09121234567',
      subject: 'مشکل در پرداخت',
      body: 'سلام، سوال داشتم.',
      createdAt: new Date().toISOString(),
    });
    renderPage();

    await userEvent.type(screen.getByTestId('contact-name'), 'نگار رضایی');
    await userEvent.type(screen.getByTestId('contact-phone'), '09121234567');
    await userEvent.type(screen.getByTestId('contact-subject'), 'مشکل در پرداخت');
    await userEvent.type(screen.getByTestId('contact-msg'), 'سلام، سوال داشتم.');
    await userEvent.click(screen.getByTestId('contact-submit'));

    expect(await screen.findByTestId('contact-sent')).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith({
      name: 'نگار رضایی',
      phone: '09121234567',
      subject: 'مشکل در پرداخت',
      body: 'سلام، سوال داشتم.',
    });
  });

  it('shows the real error message on a submit failure', async () => {
    vi.spyOn(contactApi, 'submitContactMessage').mockRejectedValue(
      new ApiRequestError('VALIDATION_FAILED', 'خطا در ارسال پیام.', 400),
    );
    renderPage();

    await userEvent.type(screen.getByTestId('contact-name'), 'نگار رضایی');
    await userEvent.type(screen.getByTestId('contact-phone'), '09121234567');
    await userEvent.type(screen.getByTestId('contact-subject'), 'مشکل در پرداخت');
    await userEvent.type(screen.getByTestId('contact-msg'), 'سلام');
    await userEvent.click(screen.getByTestId('contact-submit'));

    expect(await screen.findByText('خطا در ارسال پیام.')).toBeInTheDocument();
  });
});
