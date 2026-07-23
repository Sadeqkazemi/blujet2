import { useOutletContext } from 'react-router-dom';
import { Link } from 'react-router-dom';
import type { PanelNavItem } from '../../types/panels';

interface PanelShellContext {
  nav: PanelNavItem[] | null;
}

const TAB_DESCRIPTIONS: Record<string, string> = {
  agencies: 'مشاهده و بررسی آژانس‌های همکار و درخواست‌های عضویت',
  flights: 'مشاهده فهرست و جزئیات پروازها',
  pricing: 'ثبت نرخ پیشنهادی برای پروازهای آینده',
  reports: 'جستجوی مسافر و مشاهده جزئیات بلیط',
  refund: 'بررسی و ارجاع درخواست‌های استرداد بلیط',
};

/**
 * پنل کارمند.dc.html's dashboard sub is "نمای کلی کارها و ارجاعات واحد" —
 * an overview of the employee's granted sections. Since PANEL_NAV for
 * EMPLOYEE is computed per-user from real EmployeePermission grants (see
 * PanelsService.getNav), this reuses that same server-computed nav rather
 * than a separate endpoint — every link here is real access, not mock.
 */
export default function EmployeeDashboardPage() {
  const { nav } = useOutletContext<PanelShellContext>();
  const sections = (nav ?? []).filter((item) => item.key !== 'dashboard');

  return (
    <div className="p-6">
      <h1 className="text-lg font-bold text-ink">داشبورد کارمند</h1>
      <p className="mt-1 text-xs text-muted">نمای کلی دسترسی‌های فعال شما</p>

      {nav === null && <p className="mt-4 text-xs text-muted">در حال بارگذاری…</p>}
      {nav !== null && sections.length === 0 && (
        <p className="mt-4 text-xs text-muted">
          هنوز هیچ دسترسی برای شما توسط مدیر IT فعال نشده است.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((item) => (
          <Link
            key={item.key}
            to={`/panel/${item.key}`}
            className="rounded-xl border border-border bg-white p-4 transition hover:border-accent"
          >
            <h2 className="text-sm font-bold text-ink">{item.labelFa}</h2>
            <p className="mt-1 text-xs text-muted">{TAB_DESCRIPTIONS[item.key] ?? ''}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
