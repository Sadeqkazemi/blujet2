import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchAgencyRequests } from '../../api/agencies';
import { fetchCartable } from '../../api/cartable';
import { fetchRefunds } from '../../api/refunds';
import { fetchSiteAdminOverview } from '../../api/reporting';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import type { AgencyMembershipRequest } from '../../types/agencies';
import type { CartableListResult } from '../../types/cartable';
import type { RefundListRow } from '../../types/refunds';
import type { SiteAdminOverview } from '../../types/reporting';

/**
 * پنل ادمین سایت.dc.html dashboard — 4 KPI cards + operational widgets
 * (agency requests, refunds, cartable). All counts from real endpoints.
 */
function KpiIcon({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-[11px]"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon,
  to,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  to?: string;
}) {
  const body = (
    <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[14px] transition hover:border-[#2f3f5c]">
      <div className="mb-3 flex items-center justify-between">{icon}</div>
      <div className="font-num text-[22.5px] font-black text-white">{value}</div>
      <div className="mt-1 text-[11.5px] text-[#6b7b94]">{label}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function SiteAdminDashboardPage() {
  const [overview, setOverview] = useState<SiteAdminOverview | null>(null);
  const [requests, setRequests] = useState<AgencyMembershipRequest[] | null>(null);
  const [refunds, setRefunds] = useState<RefundListRow[] | null>(null);
  const [cartable, setCartable] = useState<CartableListResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const results = await Promise.allSettled([
        fetchSiteAdminOverview(),
        fetchAgencyRequests('PENDING'),
        fetchRefunds(),
        fetchCartable(),
      ]);

      if (cancelled) return;

      const [ovRes, reqRes, refundRes, cartRes] = results;
      const ov = ovRes.status === 'fulfilled' ? ovRes.value : null;
      const reqs = reqRes.status === 'fulfilled' ? reqRes.value : [];
      const refundResult = refundRes.status === 'fulfilled' ? refundRes.value : null;
      const cartableData = cartRes.status === 'fulfilled' ? cartRes.value : null;

      if (!ov && !refundResult && !cartableData && reqRes.status === 'rejected') {
        setError('خطا در دریافت اطلاعات داشبورد.');
        return;
      }

      setOverview(
        ov ?? {
          activeAgencies: 0,
          passengersThisMonth: 0,
          ticketsSoldThisMonth: 0,
          pendingActionCount: 0,
        },
      );
      setRequests(reqs);
      setRefunds(
        (refundResult?.requests ?? []).filter(
          (r) => r.status === 'SUBMITTED' || r.status === 'REVIEW',
        ),
      );
      setCartable(
        cartableData ?? { tasks: [], counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 }, totalOpen: 0 },
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="px-[21px] py-8 text-sm text-[#f87171]">{error}</p>;
  }
  if (!overview || requests === null || refunds === null || !cartable) {
    return <p className="px-[21px] py-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;
  }

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-6">
        <h1 className="m-0 text-[20.5px] font-black text-white">داشبورد</h1>
        <p className="mt-1 text-[11.5px] text-[#6b7b94]">
          درخواست‌ها، استرداد بلیط و کارهای در انتظار اقدام
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="آژانس فعال"
          value={faDigits(overview.activeAgencies)}
          to="/panel/agencies"
          icon={
            <KpiIcon bg="rgba(59,130,246,.16)" color="#3b82f6">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 21h18" />
                <path d="M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
                <path d="M19 21V10a1 1 0 0 0-1-1h-3" />
              </svg>
            </KpiIcon>
          }
        />
        <KpiCard
          label="مسافر این ماه"
          value={faDigits(overview.passengersThisMonth)}
          to="/panel/reports"
          icon={
            <KpiIcon bg="rgba(147,51,234,.16)" color="#a855f7">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                <path d="M16 5a3.2 3.2 0 0 1 0 6.4" />
                <path d="M18 14.5c1.9.6 3.4 2.4 3.4 4.5" />
              </svg>
            </KpiIcon>
          }
        />
        <KpiCard
          label="بلیط فروخته‌شده"
          value={faDigits(overview.ticketsSoldThisMonth)}
          to="/panel/reports"
          icon={
            <KpiIcon bg="rgba(16,185,129,.16)" color="#34d399">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" />
                <path d="M14 7v10" />
              </svg>
            </KpiIcon>
          }
        />
        <KpiCard
          label="درخواست در انتظار اقدام"
          value={faDigits(overview.pendingActionCount)}
          to="/panel/cartable"
          icon={
            <KpiIcon bg="rgba(245,158,11,.16)" color="#f59e0b">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.5 21a2 2 0 0 1-3 0" />
              </svg>
            </KpiIcon>
          }
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-[15px] lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-[15px]">
          <section className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-[14.5px] font-extrabold text-white">درخواست‌های آژانس‌ها</h2>
              <Link
                to="/panel/agencies"
                className="rounded-[9px] border border-[rgba(59,130,246,.3)] bg-[rgba(59,130,246,.12)] px-3 py-1.5 text-[11.5px] font-bold text-[#60a5fa]"
              >
                مدیریت آژانس‌ها ←
              </Link>
            </div>
            {requests.length === 0 ? (
              <p className="py-5 text-center text-xs text-[#6b7b94]">
                درخواست جدیدی در انتظار تأیید نیست.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {requests.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/panel/agencies/requests/${r.id}`}
                      className="flex items-center justify-between gap-3 rounded-[12px] border border-[#28344c] bg-[#18223a] px-3.5 py-2.5 transition hover:border-[#3b82f6]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-extrabold text-[#e7ecf3]">
                          {r.applicantName}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[#6b7b94]">
                          مدیر: {r.managerName} · {r.city}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11.5px] font-bold text-[#60a5fa]">بررسی ←</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-[14.5px] font-extrabold text-white">درخواست‌های استرداد بلیط</h2>
              <Link
                to="/panel/refund"
                className="rounded-[9px] border border-[rgba(59,130,246,.3)] bg-[rgba(59,130,246,.12)] px-3 py-1.5 text-[11.5px] font-bold text-[#60a5fa]"
              >
                مدیریت استرداد بلیط ←
              </Link>
            </div>
            {refunds.length === 0 ? (
              <p className="py-5 text-center text-xs text-[#6b7b94]">درخواست استردادی در انتظار نیست.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {refunds.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/panel/refund"
                      className="flex items-center justify-between gap-3 rounded-[12px] border border-[#28344c] bg-[#18223a] px-3.5 py-2.5 transition hover:border-[#3b82f6]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-extrabold text-[#e7ecf3]">
                          {r.passengerName}
                        </span>
                        <span className="ltr font-num mt-0.5 block text-[11px] text-[#6b7b94]">
                          {r.booking.pnr} · {formatJalaliDate(r.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11.5px] font-bold text-[#60a5fa]">بررسی ←</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="m-0 text-[14.5px] font-extrabold text-white">کارهای در انتظار اقدام</h2>
              {cartable.totalOpen > 0 && (
                <span className="mt-1 inline-block rounded-full bg-[#f8717124] px-2.5 py-0.5 text-[11px] font-bold text-[#f87171]">
                  {faDigits(cartable.totalOpen)} باز
                </span>
              )}
            </div>
            <Link
              to="/panel/cartable"
              className="text-[11.5px] font-bold text-[#60a5fa] hover:underline"
            >
              مشاهده‌ی همه‌ی کارها ←
            </Link>
          </div>
          {cartable.tasks.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#6b7b94]">کارتابل خالی است ✓</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cartable.tasks.slice(0, 6).map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-2.5 rounded-[12px] border border-[#28344c] bg-[#18223a] px-3 py-2.5"
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#3b82f624] text-[#60a5fa]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-extrabold text-[#e7ecf3]">{t.title}</span>
                    <span className="mt-0.5 block text-[10.5px] text-[#6b7b94]">
                      {t.senderLabelFa ?? t.sender?.fullName ?? 'سیستم'}
                      {' · '}
                      {formatJalaliDate(t.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
