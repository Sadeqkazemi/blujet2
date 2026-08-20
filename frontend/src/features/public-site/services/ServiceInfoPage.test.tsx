import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatSelectionInfoPage } from './PublicServicePages';
import * as useAuthModule from '../../../hooks/useAuth';
import * as useIsMobileModule from '../../../hooks/useIsMobile';
import * as useLocaleModule from '../../../hooks/useLocale';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ServiceInfoPage responsive', () => {
  it('collapses the hero and step grids to a single column on mobile', () => {
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'fa', setLocale: vi.fn() });
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(true);
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SeatSelectionInfoPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('service-info-page')).toBeInTheDocument();
    expect(screen.getByTestId('service-hero-grid')).toHaveStyle({
      gridTemplateColumns: '1fr',
    });
  });
});
