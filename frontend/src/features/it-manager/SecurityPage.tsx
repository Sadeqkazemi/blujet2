import { useCallback, useEffect, useState } from 'react';
import { fetchActiveSessions, fetchSecurityPolicy, logoutAllSessions, updateSecurityPolicy } from '../../api/it-manager';
import { faDigits } from '../../lib/fa-format';
import { useStepUp } from '../../hooks/useStepUp';
import {
  StaffAlert,
  StaffPanelCard,
  StaffPanelPageHeader,
  StaffSecondaryButton,
  StaffToggle,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import Modal from '../../components/Modal';
import type { ActiveSession, SecurityPolicy } from '../../types/it-manager';

const TOGGLES: { key: keyof SecurityPolicy; title: string; desc: string }[] = [
  { key: 'requireUppercase', title: 'الزام حرف بزرگ', desc: 'رمز عبور باید حداقل یک حرف بزرگ داشته باشد' },
  { key: 'requireNumber', title: 'الزام عدد', desc: 'رمز عبور باید حداقل یک رقم داشته باشد' },
  { key: 'requireSymbol', title: 'الزام نماد', desc: 'رمز عبور باید حداقل یک نماد ویژه داشته باشد' },
  { key: 'blockReuse', title: 'ممانعت از تکرار رمز قبلی', desc: 'رمز جدید نباید با رمزهای پیشین یکسان باشد' },
  { key: 'staffTwoFactorMandatory', title: 'احراز هویت دومرحله‌ای', desc: 'اجباری برای همه حساب‌های مدیریتی' },
];

export default function SecurityPage() {
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const stepUp = useStepUp('SESSION_REVOKE');

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([fetchSecurityPolicy(), fetchActiveSessions()]);
      setPolicy(p);
      setSessions(s);
    } catch {
      setError('خطا در دریافت اطلاعات امنیتی.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggle(key: keyof SecurityPolicy) {
    if (!policy) return;
    try {
      const updated = await updateSecurityPolicy({ [key]: !policy[key] });
      setPolicy(updated);
    } catch {
      setError('خطا در ذخیره تغییرات.');
    }
  }

  async function onLogoutAll() {
    try {
      const fields = await stepUp.confirm();
      const { revokedCount } = await logoutAllSessions(fields);
      setNotice(`${faDigits(revokedCount)} نشست خاتمه یافت ✓`);
      setConfirmLogoutAll(false);
      await load();
    } catch (err) {
      if (err instanceof Error && err.message === 'CANCELLED') return;
      setError('خطا در خروج از نشست‌ها.');
    }
  }

  if (!policy) return <p style={{ padding: '24px 28px', fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>;

  return (
    <div style={{ padding: '24px 28px' }}>
      <StaffPanelPageHeader title="رمزها و امنیت" subtitle="سیاست‌های رمز عبور و کنترل دسترسی" />

      {error && <StaffAlert tone="error">{error}</StaffAlert>}
      {notice && <StaffAlert tone="success">{notice}</StaffAlert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <StaffPanelCard title="سیاست رمز عبور" subtitle="قوانین اعمال‌شده روی رمز همه حساب‌های سامانه">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {TOGGLES.map((t, idx) => (
              <div
                key={t.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>{t.title}</div>
                  <div style={{ marginTop: 2, fontSize: 10.5, color: STAFF_PANEL.textMuted }}>{t.desc}</div>
                </div>
                <StaffToggle checked={Boolean(policy[t.key])} onChange={() => void onToggle(t.key)} label={t.title} />
              </div>
            ))}
          </div>
        </StaffPanelCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StaffPanelCard title="پارامترهای رمز">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: STAFF_PANEL.navMuted }}>حداقل طول رمز</span>
                <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faDigits(policy.minLength)} کاراکتر</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: STAFF_PANEL.navMuted }}>انقضای رمز</span>
                <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>هر {faDigits(policy.expiryDays)} روز</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: STAFF_PANEL.navMuted }}>تلاش ناموفق مجاز</span>
                <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faDigits(policy.maxAttempts)} بار</span>
              </div>
            </div>
          </StaffPanelCard>

          <StaffPanelCard
            title="نشست‌های فعال"
            subtitle={`${faDigits(sessions.length)} کاربر هم‌اکنون وارد سامانه هستند`}
            headerAction={
              <button
                type="button"
                onClick={() => setConfirmLogoutAll(true)}
                style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 800, color: STAFF_PANEL.danger, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                خروج همه
              </button>
            }
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.slice(0, 8).map((s) => (
                <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ flex: 1, fontWeight: 800, color: STAFF_PANEL.text }}>
                    {s.who} <span style={{ fontWeight: 400, color: STAFF_PANEL.textMuted }}>· {s.role}</span>
                  </span>
                  <span style={{ direction: 'ltr', color: STAFF_PANEL.textMuted }}>{s.ip ?? '—'}</span>
                </li>
              ))}
            </ul>
          </StaffPanelCard>
        </div>
      </div>

      {confirmLogoutAll && (
        <Modal dark title="خروج اجباری همه نشست‌ها" onClose={() => setConfirmLogoutAll(false)}>
          <p style={{ marginBottom: 16, fontSize: 11, color: STAFF_PANEL.textMuted }}>
            همه کاربران سامانه از نشست فعلی خارج می‌شوند. این عملیات بلافاصله اعمال می‌شود.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <StaffSecondaryButton onClick={() => setConfirmLogoutAll(false)}>انصراف</StaffSecondaryButton>
            <button
              type="button"
              onClick={() => void onLogoutAll()}
              style={{
                borderRadius: 10,
                background: STAFF_PANEL.danger,
                color: '#fff',
                padding: '8px 16px',
                fontSize: 11.5,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              خروج همه
            </button>
          </div>
        </Modal>
      )}
      {stepUp.modal}
    </div>
  );
}
