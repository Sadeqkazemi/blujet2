import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAgencyRequests } from '../../api/agencies';
import { fetchRefunds } from '../../api/refunds';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import type { AgencyMembershipRequest } from '../../types/agencies';
import type { RefundsResult } from '../../types/refunds';

/**
 * پنل ادمین سایت.dc.html's dashboard sub-title is "درخواست‌ها، استرداد
 * بلیط و کارهای در انتظار اقدام" (a combined new-requests feed). This is
 * a real, scoped v1 of that feed — pending agency requests + refunds
 * awaiting admin review, both from endpoints SITE_ADMIN already has real
 * access to — rather than the design's fuller multi-widget composition,
 * which stays a deferred polish item (see Phase 18 notes in
 * docs/DB_SCHEMA.md).
 */
export default function SiteAdminDashboardPage() {
  const [requests, setRequests] = useState<AgencyMembershipRequest[] | null>(null);
  const [refunds, setRefunds] = useState<RefundsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAgencyRequests('PENDING'), fetchRefunds()])
      .then(([reqs, refundResult]) => {
        setRequests(reqs);
        setRefunds(refundResult);
      })
      .catch(() => setError('خطا در دریافت اطلاعات داشبورد.'));
  }, []);

  const awaitingRefunds = refunds?.requests.filter(
    (r) => r.status === 'SUBMITTED' || r.status === 'REVIEW',
  ) ?? [];

  return (
    <div className="p-6">
      <h1 className="text-lg font-bold text-ink">داشبورد</h1>
      <p className="mt-1 text-xs text-muted">درخواست‌ها، استرداد بلیط و کارهای در انتظار اقدام</p>

      {error && <p className="mt-4 text-xs text-danger">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">درخواست‌های عضویت آژانس در انتظار</h2>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
              {faDigits(requests?.length ?? 0)}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {requests === null && <li className="text-xs text-muted">در حال بارگذاری…</li>}
            {requests?.length === 0 && (
              <li className="text-xs text-muted">درخواست در انتظاری وجود ندارد.</li>
            )}
            {requests?.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/panel/agencies/requests/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs transition hover:bg-surface"
                >
                  <span className="font-bold text-ink">{r.applicantName}</span>
                  <span className="text-muted">{formatJalaliDate(r.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">استرداد بلیط در انتظار بررسی</h2>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
              {faDigits(awaitingRefunds.length)}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {refunds === null && <li className="text-xs text-muted">در حال بارگذاری…</li>}
            {refunds && awaitingRefunds.length === 0 && (
              <li className="text-xs text-muted">درخواست استرداد در انتظاری وجود ندارد.</li>
            )}
            {awaitingRefunds.map((r) => (
              <li key={r.id}>
                <Link
                  to="/panel/refund"
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs transition hover:bg-surface"
                >
                  <span className="font-bold text-ink">{r.passengerName}</span>
                  <span className="text-muted">{formatJalaliDate(r.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
