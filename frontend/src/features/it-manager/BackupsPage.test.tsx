import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BackupsPage from './BackupsPage';
import * as itApi from '../../api/it-manager';
import type { BackupRecord, BackupSchedule } from '../../types/it-manager';

const SCHEDULE: BackupSchedule = {
  databaseBackup: 'هر شب ۰۳:۰۰',
  fileBackup: 'هر یکشنبه ۰۴:۰۰',
  retentionDays: 30,
  cloudStorage: 'فعال',
};

const BACKUPS: BackupRecord[] = [
  {
    id: 'b1',
    fileName: 'blujet-2026-07-17.sql.gz',
    status: 'SUCCESS',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:00:05.000Z',
    sizeBytes: 2_048_000,
    errorMessage: null,
  },
];

describe('BackupsPage', () => {
  it('renders backup list and schedule card', async () => {
    vi.spyOn(itApi, 'fetchBackups').mockResolvedValue(BACKUPS);
    vi.spyOn(itApi, 'fetchBackupSchedule').mockResolvedValue(SCHEDULE);

    render(<BackupsPage />);

    expect(await screen.findByText('پشتیبان‌گیری')).toBeInTheDocument();
    expect(screen.getByText('blujet-2026-07-17.sql.gz')).toBeInTheDocument();
    expect(screen.getByText('موفق')).toBeInTheDocument();
    expect(screen.getByText('هر شب ۰۳:۰۰')).toBeInTheDocument();
    expect(screen.getByText('فعال')).toBeInTheDocument();
  });

  it('creates a backup and reloads the list', async () => {
    vi.spyOn(itApi, 'fetchBackups').mockResolvedValue([]);
    vi.spyOn(itApi, 'fetchBackupSchedule').mockResolvedValue(SCHEDULE);
    const createSpy = vi.spyOn(itApi, 'createBackup').mockResolvedValue({
      id: 'b2',
      fileName: 'new.sql.gz',
      status: 'SUCCESS',
      startedAt: '2026-07-17T10:00:00.000Z',
      completedAt: '2026-07-17T10:00:02.000Z',
      sizeBytes: 1024,
      errorMessage: null,
    });
    vi.spyOn(itApi, 'fetchBackups')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(BACKUPS);

    render(<BackupsPage />);
    await screen.findByText('پشتیبان‌گیری');

    await userEvent.click(screen.getByRole('button', { name: 'پشتیبان جدید' }));
    expect(createSpy).toHaveBeenCalled();
    expect(await screen.findByText('blujet-2026-07-17.sql.gz')).toBeInTheDocument();
  });

  it('shows an error when loading fails', async () => {
    vi.spyOn(itApi, 'fetchBackups').mockRejectedValue(new Error('fail'));
    vi.spyOn(itApi, 'fetchBackupSchedule').mockRejectedValue(new Error('fail'));

    render(<BackupsPage />);

    expect(await screen.findByText('خطا در دریافت نسخه‌های پشتیبان.')).toBeInTheDocument();
  });
});
