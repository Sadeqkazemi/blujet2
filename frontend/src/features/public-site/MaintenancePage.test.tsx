import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MaintenancePage from './MaintenancePage';
import * as useLocaleModule from '../../hooks/useLocale';

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MaintenancePage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MaintenancePage', () => {
  it('renders the Persian maintenance notice by default', () => {
    renderPage();
    expect(screen.getByText('سایت در حال تعمیر و نگهداری است')).toBeInTheDocument();
    expect(screen.getByText('در حال به‌روزرسانی')).toBeInTheDocument();
    expect(screen.getByText(/حدود ۲ ساعت آینده/)).toBeInTheDocument();
  });

  it('renders translated maintenance notice in English', () => {
    mockLocale('en');
    renderPage();
    expect(screen.getByText('The site is under maintenance')).toBeInTheDocument();
    expect(screen.getByText('Updating')).toBeInTheDocument();
    expect(screen.getByText(/in about ۲ hours/)).toBeInTheDocument();
  });

  it('renders translated maintenance notice in Arabic', () => {
    mockLocale('ar');
    renderPage();
    expect(screen.getByText('الموقع قيد الصيانة')).toBeInTheDocument();
    expect(screen.getByText('جارٍ التحديث')).toBeInTheDocument();
  });
});
