import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FlightStatusPage from './FlightStatusPage';
import * as useAuthModule from '../../hooks/useAuth';

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
      <FlightStatusPage />
    </MemoryRouter>,
  );
}

describe('FlightStatusPage', () => {
  it('finds the mock flight by flight number', async () => {
    renderPage();
    await userEvent.type(screen.getByTestId('fs-flightno'), 'bj-410');
    await userEvent.click(screen.getByTestId('fs-search'));
    expect(screen.getByTestId('fs-result')).toBeInTheDocument();
    expect(screen.getByText('به‌موقع')).toBeInTheDocument();
  });

  it('shows not-found for an unknown flight number', async () => {
    renderPage();
    await userEvent.type(screen.getByTestId('fs-flightno'), 'ZZ-999');
    await userEvent.click(screen.getByTestId('fs-search'));
    expect(screen.getByTestId('fs-not-found')).toBeInTheDocument();
  });

  it('switches to route mode and requires all three fields', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('fs-mode-route'));
    await userEvent.click(screen.getByTestId('fs-search'));
    expect(screen.getByTestId('fs-not-found')).toBeInTheDocument();

    await userEvent.type(screen.getByTestId('fs-origin'), 'تهران');
    await userEvent.type(screen.getByTestId('fs-dest'), 'مشهد');
    await userEvent.type(screen.getByTestId('fs-date'), '۲۵ تیر ۱۴۰۵');
    await userEvent.click(screen.getByTestId('fs-search'));
    expect(screen.getByTestId('fs-result')).toBeInTheDocument();
  });
});
