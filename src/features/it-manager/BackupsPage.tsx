import { useCallback, useEffect, useState } from 'react';
import { createBackup, fetchBackupSchedule, fetchBackups } from '../../api/it-manager';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { BackupRecord, BackupSchedule } from '../../types/it-manager';

const STATUS: Record<BackupRecord['status'], { label: string; className: string }> = {
  SUCCESS: { label: 'موفق', className: 'bg-[#10b98124] text-[#059669]' },
  FAILED: { label: 'ناموفق', className: 'bg-danger/15 text-danger' },
  RUNNING: { label: 'در حال اجرا', className: 'bg-surface text-text-2' },
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return `${faDigits(mb < 1 ? (bytes / 1024).toFixed(0) : mb.toFixed(1))} ${mb < 1 ? 'KB' : 'MB'}`;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([fetchBackups(), fetchBackupSchedule()]);
      setBackups(b);
      setSchedule(s);
    } catch {
      setError('خطا در دریافت نسخه‌های پشتیبان.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    setCreating(true);
    setError(null);
    try {
      await createBackup();
      await load();
    } catch {
      setError('خطا در ایجاد نسخه پشتیبان.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">پشتیبان‌گیری</h1>
      <p className="mb-6 text-sm text-muted">نسخه‌های پشتیبان و زمان‌بندی خودکار</p>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">نسخه‌های پشتیبان</h2>
            <button
              onClick={() => void onCreate()}
              disabled={creating}
              className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-accent/90 disabled:opacity-60"
            >
              {creating ? 'در حال ایجاد…' : 'پشتیبان جدید'}
            </button>
          </div>
          {backups.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">هنوز نسخه پشتیبانی ایجاد نشده است.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {backups.map((b) => {
                const st = STATUS[b.status];
                return (
                  <li key={b.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="ltr truncate font-bold text-ink">{b.fileName}</div>
                      <div className="mt-0.5 text-[10.5px] text-muted">
                        {formatJalaliDateTime(b.startedAt)} · {formatSize(b.sizeBytes)}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {schedule && (
          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">زمان‌بندی خودکار</h2>
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-2">پشتیبان دیتابیس</span>
                <span className="font-bold text-[#059669]">{schedule.databaseBackup}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">پشتیبان فایل‌ها و تصاویر</span>
                <span className="font-bold text-[#059669]">{schedule.fileBackup}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">نگهداری نسخه‌ها</span>
                <span className="font-num font-bold text-ink">{faDigits(schedule.retentionDays)} روز</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">ذخیره‌سازی ابری</span>
                <span className="rounded-full bg-[#10b98124] px-2.5 py-0.5 text-[10px] font-bold text-[#059669]">
                  {schedule.cloudStorage}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
