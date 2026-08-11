import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountLoansTab from './AccountLoansTab';
import * as loansApi from '../../api/loans';

afterEach(() => vi.restoreAllMocks());

describe('AccountLoansTab', () => {
  it('sends a Toman amount to the bank API as an IRR decimal string', async () => {
    vi.spyOn(loansApi, 'fetchMyLoanApplications').mockResolvedValue({
      items: [], page: 1, pageSize: 20, total: 0,
    });
    const createSpy = vi.spyOn(loansApi, 'createLoanApplication').mockResolvedValue({
      id: 'loan-1', requestedAmountIrr: '12500000', bankStatus: 'SUBMITTED',
      displayStatus: 'awaiting_bank', bankReferenceId: 'BANK-1',
      createdAt: '2026-08-10T08:00:00.000Z', updatedAt: '2026-08-10T08:00:00.000Z',
      lastSyncedAt: null,
    });

    render(<AccountLoansTab />);
    expect(await screen.findByText('هنوز درخواست وامی ثبت نشده است.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), '۱٬۲۵۰٬۰۰۰');
    await user.click(screen.getByRole('button', { name: 'ارسال درخواست به بانک' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledWith('12500000', expect.any(String)));
  });
});
