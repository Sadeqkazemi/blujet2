import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PublicFooter from './PublicFooter';
import * as useLocaleModule from '../../hooks/useLocale';

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

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
});
