import { useCallback, useEffect, useState } from 'react';
import { createBackup, fetchBackupSchedule, fetchBackups } from '../../api/it-manager';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import {
  StaffAlert,
  StaffPanelCard,
  StaffPanelPageHeader,
  StaffPrimaryButton,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { staffStatusStyle } from '../../lib/staff-panel-styles';
import type { BackupRecord, BackupSchedule } from '../../types/it-manager';

const STATUS: Record<BackupRecord['status'], { label: string; tone: 'success' | 'danger' | 'accent' }> = {
  SUCCESS: { label: 'موفق', tone: 'success' },
  FAILED: { label: 'ناموفق', tone: 'danger' },
  RUNNING: { label: 'در حال اجرا', tone: 'accent' },
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
    <div style={{ padding: '24px 28px' }}>
      <StaffPanelPageHeader title="پشتیبان‌گیری" subtitle="نسخه‌های پشتیبان و زمان‌بندی خودکار" />

      {error && <StaffAlert tone="error">{error}</StaffAlert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <StaffPanelCard
          title="نسخه‌های پشتیبان"
          headerAction={
            <StaffPrimaryButton onClick={() => void onCreate()} disabled={creating}>
              {creating ? 'در حال ایجاد…' : 'پشتیبان جدید'}
            </StaffPrimaryButton>
          }
        >
          {backups.length === 0 ? (
            <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted }}>
              هنوز نسخه پشتیبانی ایجاد نشده است.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {backups.map((b) => {
                const st = STATUS[b.status];
                return (
                  <li
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: 12,
                      border: `1px solid ${STAFF_PANEL.cardBorder}`,
                      padding: 12,
                      fontSize: 11,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ direction: 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 800, color: STAFF_PANEL.text }}>
                        {b.fileName}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 10.5, color: STAFF_PANEL.textMuted }}>
                        {formatJalaliDateTime(b.startedAt)} · {formatSize(b.sizeBytes)}
                      </div>
                    </div>
                    <span style={staffStatusStyle(st.tone)}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </StaffPanelCard>

        {schedule && (
          <StaffPanelCard title="زمان‌بندی خودکار">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: STAFF_PANEL.navMuted }}>پشتیبان دیتابیس</span>
                <span style={{ fontWeight: 800, color: STAFF_PANEL.success }}>{schedule.databaseBackup}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: STAFF_PANEL.navMuted }}>پشتیبان فایل‌ها و تصاویر</span>
                <span style={{ fontWeight: 800, color: STAFF_PANEL.success }}>{schedule.fileBackup}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: STAFF_PANEL.navMuted }}>نگهداری نسخه‌ها</span>
                <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faDigits(schedule.retentionDays)} روز</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: STAFF_PANEL.navMuted }}>ذخیره‌سازی ابری</span>
                <span style={staffStatusStyle('success')}>{schedule.cloudStorage}</span>
              </div>
            </div>
          </StaffPanelCard>
        )}
      </div>
    </div>
  );
}
