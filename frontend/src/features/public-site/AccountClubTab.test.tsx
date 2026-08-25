import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountClubTab from './AccountClubTab';
import * as useLocaleModule from '../../hooks/useLocale';
import type { ClubMembershipView } from '../../types/club-membership';

const MEMBERSHIP: ClubMembershipView = {
  isMember: true,
  level: 'GOLD',
  balance: 12450,
  cardStatus: 'ISSUED',
  cardNo: 'GOLD-8842',
  tierRules: { goldMinPoints: 5000, platinumMinPoints: 15000, cardRequestMinPoints: 5000 },
  cardRequest: null,
  canRequestCard: false,
  pointsNeededForCard: 0,
};

afterEach(() => vi.restoreAllMocks());

describe('AccountClubTab', () => {
  it('shows the membership card and the real bank-loan entry paths', async () => {
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'fa', setLocale: vi.fn() });
    render(
      <MemoryRouter>
        <AccountClubTab membership={MEMBERSHIP} onMembershipChange={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('کارت عضویت باشگاه')).toBeInTheDocument();
    expect(screen.getByTestId('club-bank-loan-section')).toBeInTheDocument();
    expect(screen.getByTestId('club-bank-action')).toHaveAttribute('href', '/account?tab=loans');

    await userEvent.click(screen.getByTestId('club-bank-non-customer'));
    expect(screen.getByTestId('club-bank-action')).toHaveAttribute('href', '/account?tab=tickets');
    expect(screen.getByTestId('club-bank-action')).toHaveTextContent('ارسال درخواست عضویت');
  });
});
