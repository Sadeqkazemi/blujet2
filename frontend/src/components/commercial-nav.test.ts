import { describe, expect, it } from 'vitest';
import { commercialNavWithServices } from './commercial-nav';

describe('commercialNavWithServices', () => {
  it('adds the frontend-only services tab and follows the approved handoff order', () => {
    const result = commercialNavWithServices([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'flights', labelFa: 'مدیریت پروازها', implemented: true },
      { key: 'routes', labelFa: 'مسیرهای پروازی', implemented: true },
      { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    ]);

    expect(result.map((item) => item.key)).toEqual([
      'dashboard',
      'routes',
      'flights',
      'services',
      'reports',
    ]);
  });

  it('does not duplicate a services item returned by a future backend nav response', () => {
    const result = commercialNavWithServices([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'services', labelFa: 'خدمات سفر', implemented: true },
    ]);

    expect(result.filter((item) => item.key === 'services')).toHaveLength(1);
    expect(result.find((item) => item.key === 'services')?.labelFa).toBe('خدمات سفر');
  });
});
