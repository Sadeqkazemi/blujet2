import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LogsPage from './LogsPage';
import * as itApi from '../../api/it-manager';
import type { AuditLogRow } from '../../types/it-manager';

const LOGS: AuditLogRow[] = [
  {
    id: 'l1',
    actorRole: 'IT_MANAGER',
    category: 'SYSTEM',
    action: 'تغییر سرویس',
    detail: 'سرویس «CDN و تصاویر» غیرفعال شد.',
    createdAt: '2026-07-17T08:30:00.000Z',
  },
  {
    id: 'l2',
    actorRole: 'IT_MANAGER',
    category: 'ACCOUNT',
    action: 'ایجاد کارمند',
    detail: 'کارمند «رضا کاظمی» ایجاد شد.',
    createdAt: '2026-07-17T08:00:00.000Z',
  },
];

describe('LogsPage', () => {
  it('renders audit log rows with category badges', async () => {
    vi.spyOn(itApi, 'fetchSystemLogs').mockResolvedValue(LOGS);

    render(<LogsPage />);

    expect(await screen.findByText('لاگ و رویدادها')).toBeInTheDocument();
    expect(screen.getByText('سرویس «CDN و تصاویر» غیرفعال شد.')).toBeInTheDocument();
    expect(screen.getByText('کارمند «رضا کاظمی» ایجاد شد.')).toBeInTheDocument();
    expect(screen.getByText('سیستم')).toBeInTheDocument();
    expect(screen.getByText('حساب')).toBeInTheDocument();
  });

  it('shows empty state when no logs exist', async () => {
    vi.spyOn(itApi, 'fetchSystemLogs').mockResolvedValue([]);

    render(<LogsPage />);

    expect(
      await screen.findByText('فعالیتی از کارمندان ثبت نشده است.'),
    ).toBeInTheDocument();
  });

  it('shows an error when fetch fails', async () => {
    vi.spyOn(itApi, 'fetchSystemLogs').mockRejectedValue(new Error('fail'));

    render(<LogsPage />);

    expect(await screen.findByText('خطا در دریافت لاگ‌ها.')).toBeInTheDocument();
  });
});
