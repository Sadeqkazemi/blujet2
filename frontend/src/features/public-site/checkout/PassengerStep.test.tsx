import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SavedPassenger } from '../../../types/public-site';
import PassengerStep from './PassengerStep';
import { emptyPassenger } from './checkout-types';

describe('PassengerStep — saved passengers', () => {
  const realSavedPassenger: SavedPassenger = {
    id: 'api-1',
    fullName: 'سارا احمدی',
    latinName: 'SARA AHMADI',
    nationalId: '0499370899',
    passportNo: null,
    mobile: null,
    isChild: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('always shows the from-saved link with icon, even when API list is empty', () => {
    render(
      <PassengerStep
        locale="fa"
        passengers={[emptyPassenger('')]}
        onChange={vi.fn()}
        savedPassengers={[]}
      />,
    );

    expect(screen.getByTestId('checkout-from-saved-0')).toHaveTextContent(
      'از مسافران ذخیره‌شده',
    );
  });

  it('shows an honest empty state when the account has no saved passengers', async () => {
    const user = userEvent.setup();
    render(
      <PassengerStep
        locale="fa"
        passengers={[emptyPassenger('')]}
        onChange={vi.fn()}
        savedPassengers={[]}
      />,
    );

    await user.click(screen.getByTestId('checkout-from-saved-0'));
    expect(screen.getByTestId('checkout-saved-panel-0')).toBeInTheDocument();
    expect(screen.getByText('انتخاب از مسافران ذخیره‌شده:')).toBeInTheDocument();
    expect(screen.getByText('هنوز مسافری در حساب شما ذخیره نشده است.')).toBeInTheDocument();
    expect(screen.queryByTestId(/checkout-saved-chip/)).not.toBeInTheDocument();
  });

  it('autofills only fields actually returned by the saved-passenger API', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PassengerStep
        locale="fa"
        passengers={[emptyPassenger('')]}
        onChange={onChange}
        savedPassengers={[realSavedPassenger]}
      />,
    );

    await user.click(screen.getByTestId('checkout-from-saved-0'));
    await user.click(screen.getByTestId('checkout-saved-chip-api-1'));

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0] as ReturnType<typeof emptyPassenger>[];
    expect(next[0]).toMatchObject({
      firstNameLatin: 'SARA',
      lastNameLatin: 'AHMADI',
      gender: '',
      nationalId: '0499370899',
      docType: 'NATIONAL_ID',
      birthDay: '',
      birthMonth: '',
      birthYear: '',
    });
    expect(screen.queryByTestId('checkout-saved-panel-0')).not.toBeInTheDocument();
  });

  it('prefers API saved passengers over the demo list', async () => {
    const user = userEvent.setup();
    const apiRows: SavedPassenger[] = [realSavedPassenger];
    render(
      <PassengerStep
        locale="fa"
        passengers={[emptyPassenger('')]}
        onChange={vi.fn()}
        savedPassengers={apiRows}
      />,
    );

    await user.click(screen.getByTestId('checkout-from-saved-0'));
    expect(screen.getByTestId('checkout-saved-chip-api-1')).toHaveTextContent('سارا احمدی');
    expect(screen.queryAllByTestId(/checkout-saved-chip/)).toHaveLength(1);
  });

  it('limits the first passenger birth year to someone at least 12 on departure', () => {
    render(
      <PassengerStep
        locale="fa"
        passengers={[emptyPassenger('')]}
        onChange={vi.fn()}
        savedPassengers={[]}
        departureAt="2026-08-01T05:00:00.000Z"
      />,
    );

    const yearSelect = screen.getAllByRole('combobox')[3]!;
    expect(yearSelect).toHaveTextContent('۱۳۹۳');
    expect(yearSelect).not.toHaveTextContent('۱۳۹۴');
  });

  it('shows the age and fare notice for every added passenger', () => {
    render(
      <PassengerStep
        locale="fa"
        passengers={[emptyPassenger(''), emptyPassenger('', 'CHILD')]}
        onChange={vi.fn()}
        savedPassengers={[]}
        departureAt="2026-08-01T05:00:00.000Z"
      />,
    );

    expect(screen.getByTestId('checkout-passenger-age-notice-1')).toHaveTextContent(
      'رده سنی مسافر و قیمت بلیط بر اساس تاریخ تولد در روز پرواز محاسبه می‌شود.',
    );
  });
});
