import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotFoundPage from './NotFoundPage';
import * as useLocaleModule from '../../hooks/useLocale';

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NotFoundPage', () => {
  it('renders the Persian 404 heading and links by default', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('صفحه‌ای که دنبالش بودید پیدا نشد')).toBeInTheDocument();
    expect(screen.getByText('بازگشت به صفحهٔ اصلی')).toBeInTheDocument();
    expect(screen.getByText('جستجوی پرواز')).toBeInTheDocument();
    expect(screen.getByText('۴۰۴')).toBeInTheDocument();
  });

  it('renders translated heading and links in English', () => {
    mockLocale('en');
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("The page you're looking for wasn't found")).toBeInTheDocument();
    expect(screen.getByText('Back to homepage')).toBeInTheDocument();
    expect(screen.getByText('Search flights')).toBeInTheDocument();
  });

  it('renders translated heading and links in Arabic', () => {
    mockLocale('ar');
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('الصفحة التي تبحث عنها غير موجودة')).toBeInTheDocument();
    expect(screen.getByText('العودة إلى الصفحة الرئيسية')).toBeInTheDocument();
  });
});
