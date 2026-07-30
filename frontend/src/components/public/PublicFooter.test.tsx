import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicFooter from './PublicFooter';
import * as useLocaleModule from '../../hooks/useLocale';
import * as useCareersEnabledModule from '../../hooks/useCareersEnabled';

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

beforeEach(() => {
  // Deterministic by default — real fetch behavior is covered by
  // useCareersEnabled's own unit test, not here.
  vi.spyOn(useCareersEnabledModule, 'useCareersEnabled').mockReturnValue(false);
});

function renderFooter() {
  return render(
    <MemoryRouter>
      <PublicFooter />
    </MemoryRouter>,
  );
}

describe('PublicFooter', () => {
  it('renders Persian labels by default', () => {
    mockLocale('fa');
    renderFooter();
    expect(screen.getByText('خدمات')).toBeInTheDocument();
    expect(screen.getByText('رزرو پرواز')).toHaveAttribute('href', '/results');
    expect(screen.getByText('© ۱۴۰۵ blujet. تمامی حقوق محفوظ است.')).toBeInTheDocument();
  });

  it('renders English labels when locale is en', () => {
    mockLocale('en');
    renderFooter();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Book a Flight')).toHaveAttribute('href', '/results');
    expect(screen.getByText('© 2026 blujet. All rights reserved.')).toBeInTheDocument();
  });

  it('renders Arabic labels when locale is ar', () => {
    mockLocale('ar');
    renderFooter();
    expect(screen.getByText('الخدمات')).toBeInTheDocument();
    expect(screen.getByText('حجز رحلة')).toHaveAttribute('href', '/results');
  });

  it('hides the careers link when disabled, shows it when enabled', () => {
    mockLocale('fa');
    const { unmount } = renderFooter();
    expect(screen.queryByText('فرصت‌های شغلی')).not.toBeInTheDocument();
    unmount();

    vi.spyOn(useCareersEnabledModule, 'useCareersEnabled').mockReturnValue(true);
    renderFooter();
    expect(screen.getByText('فرصت‌های شغلی')).toHaveAttribute('href', '/careers');
  });
});
