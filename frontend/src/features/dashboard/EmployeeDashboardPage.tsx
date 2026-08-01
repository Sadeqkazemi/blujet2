import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchCartable, fetchMyReferrals } from '../../api/cartable';
import { fetchEmployeeContext } from '../../api/panels';
import { faDigits } from '../../lib/fa-format';
import type { EmployeeContext, PanelNavItem } from '../../types/panels';
import PanelCard from '../panel/PanelCard';
import { panelCard, panelMuted, panelMuted2 } from '../panel/panel-theme';

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
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`${panelCard} p-4`}>
          <div className={`mb-2 text-[11px] ${panelMuted}`}>کارهای باز کارتابل</div>
          <div className="text-2xl font-black text-[#f59e0b]">
            {openTasks === null ? '—' : faDigits(openTasks)}
          </div>
        </div>
        <div className={`${panelCard} p-4`}>
          <div className={`mb-2 text-[11px] ${panelMuted}`}>ارجاعات در انتظار</div>
          <div className="text-2xl font-black text-[#a855f7]">
            {openReferrals === null ? '—' : faDigits(openReferrals)}
          </div>
        </div>
        <div className={`${panelCard} p-4`}>
          <div className={`mb-2 text-[11px] ${panelMuted}`}>واحد سازمانی</div>
          <div className="text-base font-bold text-white">{context?.deptLabelFa ?? '—'}</div>
        </div>
      </div>

      {context && context.permissionLabelsFa.length > 0 && (
        <PanelCard className="mt-5" title="دسترسی‌های شما در این واحد" subtitle="این دسترسی‌ها توسط مدیر IT مطابق واحد سازمانی شما تعیین شده است.">
          <div className="flex flex-wrap gap-2">
            {context.permissionLabelsFa.map((label) => (
              <span
                key={label}
                className="flex items-center gap-1.5 rounded-lg border border-panel-border-2 bg-panel-elevated px-3 py-1.5 text-[11px] text-panel-text"
              >
                <span className="text-[#34d399]">✓</span>
                {label}
              </span>
            ))}
          </div>
        </PanelCard>
      )}

      {nav === null && <p className={`mt-4 text-xs ${panelMuted}`}>در حال بارگذاری…</p>}
      {nav !== null && grantedSections.length === 0 && (
        <p className={`mt-4 text-xs ${panelMuted}`}>
          هنوز هیچ دسترسی برای شما توسط مدیر IT فعال نشده است.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((item) => (
          <Link
            key={item.key}
            to={`/panel/${item.key}`}
            className={`${panelCard} p-4 transition hover:border-panel-accent/40`}
          >
            <h2 className="text-sm font-bold text-white">{item.labelFa}</h2>
            <p className={`mt-1 text-xs ${panelMuted2}`}>{TAB_DESCRIPTIONS[item.key] ?? ''}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
