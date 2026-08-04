import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicFooter from './PublicFooter';
import * as useLocaleModule from '../../hooks/useLocale';
import * as useIsMobileModule from '../../hooks/useIsMobile';
import * as useCareersEnabledModule from '../../hooks/useCareersEnabled';

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

function mockDesktop() {
  vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
}

function mockMobile() {
  vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(true);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(useCareersEnabledModule, 'useCareersEnabled').mockReturnValue(false);
});

function renderFooter() {
  return render(
    <MemoryRouter>
      <PublicFooter />
    </MemoryRouter>,
  );
}

describe('PublicFooter — desktop', () => {
  beforeEach(() => mockDesktop());

  it('renders Persian labels by default', () => {
    mockLocale('fa');
    renderFooter();
    expect(screen.getByText('خدمات')).toBeInTheDocument();
    expect(screen.getByText('رزرو پرواز')).toHaveAttribute('href', '/results');
    expect(screen.getByText('© ۱۴۰۵ blujet. تمامی حقوق محفوظ است.')).toBeInTheDocument();
    expect(screen.queryByText('استرداد بلیط')).not.toBeInTheDocument();
    expect(screen.queryByText('بلاگ')).not.toBeInTheDocument();
  });

  it('renders English labels when locale is en', () => {
    mockLocale('en');
    renderFooter();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Book a Flight')).toHaveAttribute('href', '/results');
    expect(screen.getByText('© 2026 blujet. All rights reserved.')).toBeInTheDocument();
  });

  it('renders app download buttons and trust badges', () => {
    mockLocale('fa');
    renderFooter();
    expect(screen.getByTestId('footer-app-store')).toBeInTheDocument();
    expect(screen.getByTestId('footer-google-play')).toBeInTheDocument();
    expect(screen.getByTestId('footer-trust-badges')).toBeInTheDocument();
    expect(screen.getByText('نماد اعتماد الکترونیکی')).toBeInTheDocument();
    expect(screen.getByText('عضو IATA')).toBeInTheDocument();
  });

  it('renders company links without blog or careers', () => {
    mockLocale('fa');
    const { rerender } = renderFooter();
    expect(screen.queryByText('فرصت‌های شغلی')).not.toBeInTheDocument();

    vi.spyOn(useCareersEnabledModule, 'useCareersEnabled').mockReturnValue(true);
    rerender(
      <MemoryRouter>
        <PublicFooter />
      </MemoryRouter>,
    );
    expect(screen.getByText('فرصت‌های شغلی')).toHaveAttribute('href', '/careers');
  });
});

describe('PublicFooter — mobile', () => {
  beforeEach(() => mockMobile());

  it('renders centered brand block and accordion sections', () => {
    mockLocale('fa');
    renderFooter();
    expect(screen.getByTestId('footer-app-store')).toBeInTheDocument();
    expect(screen.getByText('خدمات')).toBeInTheDocument();
    expect(screen.getByText('شرکت')).toBeInTheDocument();
    expect(screen.getByText('پشتیبانی')).toBeInTheDocument();
  });
});
