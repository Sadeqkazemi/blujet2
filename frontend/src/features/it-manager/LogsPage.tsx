import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { fetchSystemLogs } from '../../api/it-manager';
import { formatJalaliDateTime } from '../../lib/jalali';
import { StaffAlert, StaffPanelCard, StaffPanelPageHeader } from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { staffCard, staffStatusStyle } from '../../lib/staff-panel-styles';
import type { AuditLogRow } from '../../types/it-manager';

const LEVEL_LABEL: Record<AuditLogRow['level'], { label: string; tone: 'accent' | 'warning' | 'danger' }> = {
  info: { label: 'info', tone: 'accent' },
  warn: { label: 'warn', tone: 'warning' },
  error: { label: 'error', tone: 'danger' },
};

const tableHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '0.9fr 1.2fr 2fr 0.8fr 0.7fr',
  gap: 8,
  borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
  padding: '10px 16px',
  fontSize: 10.5,
  fontWeight: 800,
  color: STAFF_PANEL.textMuted,
};

const tableRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '0.9fr 1.2fr 2fr 0.8fr 0.7fr',
  gap: 8,
  alignItems: 'center',
  padding: '12px 16px',
  fontSize: 11,
};

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemLogs()
      .then(setLogs)
      .catch(() => setError('خطا در دریافت لاگ‌ها.'));
  }, []);

  return (
    <div style={{ padding: '24px 28px' }}>
      <StaffPanelPageHeader
        title="لاگ و رویدادها"
        subtitle="فعالیت‌های ثبت‌شدهٔ کارمندان واحدها — اقدامات و ایجاد حساب‌ها"
      />

      {error && <StaffAlert tone="error">{error}</StaffAlert>}

      <div style={{ ...staffCard, overflow: 'hidden' }}>
        <div style={tableHeader}>
          <span>زمان</span>
          <span>کارمند</span>
          <span>رویداد</span>
          <span>واحد</span>
          <span>سطح</span>
        </div>
        {logs.length === 0 ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted }}>
            فعالیتی از کارمندان ثبت نشده است.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {logs.map((l, idx) => {
              const lvl = LEVEL_LABEL[l.level] ?? LEVEL_LABEL.info;
              return (
                <li
                  key={l.id}
                  style={{
                    ...tableRow,
                    borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
                  }}
                >
                  <span style={{ color: STAFF_PANEL.textMuted }}>{formatJalaliDateTime(l.createdAt)}</span>
                  <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{l.actorName}</span>
                  <span style={{ color: STAFF_PANEL.navMuted }}>
                    {l.action} — {l.detail}
                  </span>
                  <span style={{ color: STAFF_PANEL.navMuted }}>{l.unit}</span>
                  <span style={staffStatusStyle(lvl.tone)}>{lvl.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
