import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchCartable, fetchMyReferrals } from '../../api/cartable';
import { fetchEmployeeContext } from '../../api/panels';
import { faDigits } from '../../lib/fa-format';
import { StaffPanelCard, StaffPanelPageHeader, StaffKpiCard } from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { EmployeeContext, PanelNavItem } from '../../types/panels';

interface PanelShellContext {
  nav: PanelNavItem[] | null;
}

const TAB_DESCRIPTIONS: Record<string, string> = {
  agencies: 'مشاهده و بررسی آژانس‌های همکار و درخواست‌های عضویت',
  flights: 'مشاهده فهرست و جزئیات پروازها',
  pricing: 'ثبت نرخ پیشنهادی برای پروازهای آینده',
  reports: 'جستجوی مسافر و مشاهده جزئیات بلیط',
  refund: 'بررسی و ارجاع درخواست‌های استرداد بلیط',
  cartable: 'کارهای در انتظار اقدام و ارسال پیام به مدیر',
  referrals: 'درخواست‌های ارجاع‌شده به شما توسط مدیران',
};

export default function EmployeeDashboardPage() {
  const isMobile = useIsMobile();
  const { nav } = useOutletContext<PanelShellContext>();
  const sections = (nav ?? []).filter((item) => item.key !== 'dashboard');
  const grantedSections = sections.filter((item) => item.key !== 'referrals');

  const [context, setContext] = useState<EmployeeContext | null>(null);
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const [openReferrals, setOpenReferrals] = useState<number | null>(null);

  const hasCartable = nav?.some((item) => item.key === 'cartable') ?? false;

  useEffect(() => {
    fetchEmployeeContext()
      .then(setContext)
      .catch(() => setContext(null));
  }, []);

  useEffect(() => {
    const tasks: Promise<void>[] = [];
    if (hasCartable) {
      tasks.push(
        fetchCartable()
          .then((r) => setOpenTasks(r.totalOpen))
          .catch(() => setOpenTasks(null)),
      );
    }
    tasks.push(
      fetchMyReferrals()
        .then((r) => setOpenReferrals(r.counts.awaitingMyReport))
        .catch(() => setOpenReferrals(null)),
    );
    void Promise.all(tasks);
  }, [hasCartable]);

  return (
    <div data-testid="employee-dashboard">
      <StaffPanelPageHeader title="داشبورد کارمند" subtitle="نمای کلی کارها و ارجاعات واحد" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 13,
          marginBottom: 20,
        }}
      >
        <StaffKpiCard
          label="کارهای باز کارتابل"
          value={openTasks === null ? '—' : faDigits(openTasks)}
          iconBg="rgba(245,158,11,0.16)"
          iconColor={STAFF_PANEL.warning}
        />
        <StaffKpiCard
          label="ارجاعات در انتظار"
          value={openReferrals === null ? '—' : faDigits(openReferrals)}
          iconBg="rgba(168,85,247,0.16)"
          iconColor={STAFF_PANEL.purple}
        />
        <StaffKpiCard
          label="واحد سازمانی"
          value={context?.deptLabelFa ?? '—'}
          iconBg={STAFF_PANEL.accentSoft}
          iconColor={STAFF_PANEL.accent}
        />
      </div>

      {context && context.permissionLabelsFa.length > 0 && (
        <StaffPanelCard title="دسترسی‌های شما در این واحد" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: STAFF_PANEL.textMuted, margin: '0 0 12px' }}>
            این دسترسی‌ها توسط مدیر IT مطابق واحد سازمانی شما تعیین شده است.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {context.permissionLabelsFa.map((label) => (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 8,
                  border: `1px solid ${STAFF_PANEL.inputBorder}`,
                  background: STAFF_PANEL.inputBg,
                  padding: '6px 12px',
                  fontSize: 11,
                  color: STAFF_PANEL.text,
                }}
              >
                <span style={{ color: STAFF_PANEL.success }}>✓</span>
                {label}
              </span>
            ))}
          </div>
        </StaffPanelCard>
      )}

      {nav === null && <p style={{ fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>}
      {nav !== null && grantedSections.length === 0 && (
        <p style={{ fontSize: 12, color: STAFF_PANEL.textMuted, marginBottom: 16 }}>
          هنوز هیچ دسترسی برای شما توسط مدیر IT فعال نشده است.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 13,
        }}
      >
        {sections.map((item) => (
          <Link
            key={item.key}
            to={`/panel/${item.key}`}
            style={{
              background: STAFF_PANEL.cardBg,
              border: `1px solid ${STAFF_PANEL.cardBorder}`,
              borderRadius: 14,
              padding: 16,
              textDecoration: 'none',
              color: 'inherit',
              transition: 'border-color 0.15s',
            }}
          >
            <h2 style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', margin: 0 }}>{item.labelFa}</h2>
            <p style={{ marginTop: 6, fontSize: 11, color: STAFF_PANEL.textMuted, lineHeight: 1.6 }}>
              {TAB_DESCRIPTIONS[item.key] ?? ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
