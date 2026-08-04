import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SavedPassenger } from '../../../types/public-site';
import PassengerStep from './PassengerStep';
import { emptyPassenger } from './checkout-types';

describe('PassengerStep — saved passengers', () => {
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

  it('opens the chip panel with design demo passengers when API is empty', async () => {
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
    expect(screen.getByTestId('checkout-saved-chip-demo-negar')).toHaveTextContent(
      'نگار رضایی',
    );
    expect(screen.getByTestId('checkout-saved-chip-demo-sadeq')).toHaveTextContent(
      'صادق کاظمی',
    );
    expect(screen.getByTestId('checkout-saved-chip-demo-mohammad')).toHaveTextContent(
      'محمد رضایی',
    );
  });

  it('autofills name, gender, national id and Jalali DOB when a chip is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PassengerStep
        locale="fa"
        passengers={[emptyPassenger('')]}
        onChange={onChange}
        savedPassengers={[]}
      />,
    );

    await user.click(screen.getByTestId('checkout-from-saved-0'));
    await user.click(screen.getByTestId('checkout-saved-chip-demo-negar'));

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0] as ReturnType<typeof emptyPassenger>[];
    expect(next[0]).toMatchObject({
      firstNameLatin: 'NEGAR',
      lastNameLatin: 'REZAEI',
      gender: 'female',
      nationalId: '0074185969',
      docType: 'NATIONAL_ID',
      birthDay: '13',
      birthMonth: '3',
      birthYear: '1370',
    });
    expect(screen.queryByTestId('checkout-saved-panel-0')).not.toBeInTheDocument();
  });

  it('prefers API saved passengers over the demo list', async () => {
    const user = userEvent.setup();
    const apiRows: SavedPassenger[] = [
      {
        id: 'api-1',
        fullName: 'سارا احمدی',
        latinName: 'SARA AHMADI',
        nationalId: '0499370899',
        passportNo: null,
        mobile: null,
        isChild: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
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
    expect(screen.queryByTestId('checkout-saved-chip-demo-negar')).not.toBeInTheDocument();
  });
});
