import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchCartable, fetchMyReferrals } from '../../api/cartable';
import { fetchEmployeeContext } from '../../api/panels';
import { faDigits } from '../../lib/fa-format';
import type { EmployeeContext } from '../../types/panels';
import type { PanelShellContext } from '../../types/panel-shell';

const TAB_DESCRIPTIONS: Record<string, string> = {
  agencies: 'مشاهده و بررسی آژانس‌های همکار و درخواست‌های عضویت',
  flights: 'مشاهده فهرست و جزئیات پروازها',
  pricing: 'ثبت نرخ پیشنهادی برای پروازهای آینده',
  reports: 'جستجوی مسافر و مشاهده جزئیات بلیط',
  refund: 'بررسی و ارجاع درخواست‌های استرداد بلیط',
  cartable: 'کارهای در انتظار اقدام و ارسال پیام به مدیر',
  referrals: 'درخواست‌های ارجاع‌شده به شما توسط مدیران',
};

/**
 * پنل کارمند.dc.html's dashboard: KPI cards (open cartable + pending
 * referrals + unit), permission chips, and section link grid.
 */
export default function EmployeeDashboardPage() {
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
    <div className="p-6">
      <h1 className="text-lg font-bold text-panel-ink">داشبورد کارمند</h1>
      <p className="mt-1 text-xs text-panel-muted">نمای کلی کارها و ارجاعات واحد</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-panel-surface p-4">
          <div className="mb-2 text-[11px] text-panel-muted">کارهای باز کارتابل</div>
          <div className="font-num text-2xl font-black text-[#f59e0b]">
            {openTasks === null ? '—' : faDigits(openTasks)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-panel-surface p-4">
          <div className="mb-2 text-[11px] text-panel-muted">ارجاعات در انتظار</div>
          <div className="font-num text-2xl font-black text-[#a855f7]">
            {openReferrals === null ? '—' : faDigits(openReferrals)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-panel-surface p-4">
          <div className="mb-2 text-[11px] text-panel-muted">واحد سازمانی</div>
          <div className="text-base font-bold text-panel-ink">
            {context?.deptLabelFa ?? '—'}
          </div>
        </div>
      </div>

      {context && context.permissionLabelsFa.length > 0 && (
        <section className="mt-5 rounded-xl border border-white/10 bg-panel-surface p-4">
          <h2 className="text-sm font-bold text-panel-ink">دسترسی‌های شما در این واحد</h2>
          <p className="mt-1 text-[11px] text-panel-muted">
            این دسترسی‌ها توسط مدیر IT مطابق واحد سازمانی شما تعیین شده است.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {context.permissionLabelsFa.map((label) => (
              <span
                key={label}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-panel-ink"
              >
                <span className="text-[#059669]">✓</span>
                {label}
              </span>
            ))}
          </div>
        </section>
      )}

      {nav === null && <p className="mt-4 text-xs text-panel-muted">در حال بارگذاری…</p>}
      {nav !== null && grantedSections.length === 0 && (
        <p className="mt-4 text-xs text-panel-muted">
          هنوز هیچ دسترسی برای شما توسط مدیر IT فعال نشده است.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((item) => (
          <Link
            key={item.key}
            to={`/panel/${item.key}`}
            className="rounded-xl border border-white/10 bg-panel-surface p-4 transition hover:border-accent"
          >
            <h2 className="text-sm font-bold text-panel-ink">{item.labelFa}</h2>
            <p className="mt-1 text-xs text-panel-muted">{TAB_DESCRIPTIONS[item.key] ?? ''}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
