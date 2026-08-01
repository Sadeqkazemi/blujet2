import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAgencyRequests } from '../../api/agencies';
import { fetchRefunds } from '../../api/refunds';
import { fetchRecentContactMessages } from '../../api/support-tickets';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import type { AgencyMembershipRequest } from '../../types/agencies';
import type { RefundsResult } from '../../types/refunds';
import type { ContactMessageRow } from '../../types/support-tickets';
import PanelAlert from '../panel/PanelAlert';
import PanelCard from '../panel/PanelCard';
import { panelElevated, panelLink, panelMuted } from '../panel/panel-theme';

/**
 * پنل ادمین سایت.dc.html's dashboard sub-title is "درخواست‌ها، استرداد
 * بلیط و کارهای در انتظار اقدام" (a combined new-requests feed). This is
 * a real, scoped v1 of that feed — pending agency requests, refunds
 * awaiting admin review, and (Phase 20) recent تماس با ما messages, all
 * from endpoints SITE_ADMIN already has real access to — rather than the
 * design's fuller multi-widget composition, which stays a deferred polish
 * item (see Phase 18/20 notes in docs/DB_SCHEMA.md). ContactMessage has no
 * dedicated review UI of its own — this feed IS its admin surface.
 */
export default function SiteAdminDashboardPage() {
  const [requests, setRequests] = useState<AgencyMembershipRequest[] | null>(null);
  const [refunds, setRefunds] = useState<RefundsResult | null>(null);
  const [messages, setMessages] = useState<ContactMessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAgencyRequests('PENDING'), fetchRefunds(), fetchRecentContactMessages()])
      .then(([reqs, refundResult, recentMessages]) => {
        setRequests(reqs);
        setRefunds(refundResult);
        setMessages(recentMessages);
      })
      .catch(() => setError('خطا در دریافت اطلاعات داشبورد.'));
  }, []);

  const awaitingRefunds = refunds?.requests.filter(
    (r) => r.status === 'SUBMITTED' || r.status === 'REVIEW',
  ) ?? [];

  return (
    <div>
      {error && <PanelAlert>{error}</PanelAlert>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PanelCard
          title="درخواست‌های عضویت آژانس در انتظار"
          actions={
            <span className="rounded-full bg-[rgba(59,130,246,.16)] px-2 py-0.5 text-xs font-bold text-panel-link">
              {faDigits(requests?.length ?? 0)}
            </span>
          }
        >
          <ul className="flex flex-col gap-2">
            {requests === null && <li className={`text-xs ${panelMuted}`}>در حال بارگذاری…</li>}
            {requests?.length === 0 && (
              <li className={`text-xs ${panelMuted}`}>درخواست در انتظاری وجود ندارد.</li>
            )}
            {requests?.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/panel/agencies/requests/${r.id}`}
                  className={`flex items-center justify-between rounded-lg border border-panel-border-2 px-3 py-2 text-xs transition hover:bg-white/5 ${panelElevated}`}
                >
                  <span className="font-bold text-white">{r.applicantName}</span>
                  <span className={panelMuted}>{formatJalaliDate(r.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard
          title="استرداد بلیط در انتظار بررسی"
          actions={
            <span className="rounded-full bg-[rgba(59,130,246,.16)] px-2 py-0.5 text-xs font-bold text-panel-link">
              {faDigits(awaitingRefunds.length)}
            </span>
          }
        >
          <ul className="flex flex-col gap-2">
            {refunds === null && <li className={`text-xs ${panelMuted}`}>در حال بارگذاری…</li>}
            {refunds && awaitingRefunds.length === 0 && (
              <li className={`text-xs ${panelMuted}`}>درخواست استرداد در انتظاری وجود ندارد.</li>
            )}
            {awaitingRefunds.map((r) => (
              <li key={r.id}>
                <Link
                  to="/panel/refund"
                  className={`flex items-center justify-between rounded-lg border border-panel-border-2 px-3 py-2 text-xs transition hover:bg-white/5 ${panelElevated}`}
                >
                  <span className="font-bold text-white">{r.passengerName}</span>
                  <span className={panelMuted}>{formatJalaliDate(r.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard
          title="آخرین پیام‌های تماس با ما"
          actions={
            <span className="rounded-full bg-[rgba(59,130,246,.16)] px-2 py-0.5 text-xs font-bold text-panel-link">
              {faDigits(messages?.length ?? 0)}
            </span>
          }
        >
          <ul className="flex flex-col gap-2">
            {messages === null && <li className={`text-xs ${panelMuted}`}>در حال بارگذاری…</li>}
            {messages?.length === 0 && <li className={`text-xs ${panelMuted}`}>پیامی ثبت نشده است.</li>}
            {messages?.map((m) => (
              <li
                key={m.id}
                className={`flex items-center justify-between rounded-lg border border-panel-border-2 px-3 py-2 text-xs ${panelElevated}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-bold text-white">{m.name}</span>
                  <span className={`mr-1 ${panelMuted}`}>— {m.subject}</span>
                </span>
                <span className={`mr-2 shrink-0 ${panelMuted}`}>{formatJalaliDate(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>
    </div>
  );
}
