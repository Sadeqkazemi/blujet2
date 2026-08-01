import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchAgencyRequests } from '../../api/agencies';
import { fetchRefunds } from '../../api/refunds';
import { fetchRecentContactMessages } from '../../api/support-tickets';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { AgencyMembershipRequest } from '../../types/agencies';
import type { RefundsResult } from '../../types/refunds';
import type { ContactMessageRow } from '../../types/support-tickets';

function agencyInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'AG';
}

function FeedCard({
  title,
  count,
  countColor,
  countBg,
  loading,
  empty,
  children,
  footer,
}: {
  title: string;
  count: number | null;
  countColor: string;
  countBg: string;
  loading: boolean;
  empty: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        background: STAFF_PANEL.cardBg,
        border: `1px solid ${STAFF_PANEL.cardBorderAlt}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
        }}
      >
        <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', margin: 0, flex: 1 }}>{title}</h3>
        {count !== null && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: countColor,
              background: countBg,
              padding: '2px 9px',
              borderRadius: 18,
            }}
          >
            {faDigits(count)} در انتظار
          </span>
        )}
      </div>
      <div style={{ padding: '5px 8px' }}>
        {loading && <p style={{ padding: '16px 11px', textAlign: 'center', color: STAFF_PANEL.textMuted, fontSize: 11.5, margin: 0 }}>در حال بارگذاری…</p>}
        {!loading && empty && (
          <p style={{ padding: '16px 11px', textAlign: 'center', color: STAFF_PANEL.textMuted, fontSize: 11.5, margin: 0 }}>{empty}</p>
        )}
        {children}
      </div>
      {footer}
    </div>
  );
}

export default function SiteAdminDashboardPage() {
  const isMobile = useIsMobile();
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

  const awaitingRefunds = refunds?.requests.filter((r) => r.status === 'SUBMITTED' || r.status === 'REVIEW') ?? [];

  return (
    <div data-testid="site-admin-dashboard">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20.5, fontWeight: 900, color: '#fff', margin: 0 }}>داشبورد</h1>
        <div style={{ fontSize: 11.5, color: STAFF_PANEL.textMuted, marginTop: 4 }}>
          درخواست‌ها، استرداد بلیط و کارهای در انتظار اقدام
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: STAFF_PANEL.danger, marginBottom: 16 }}>{error}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 15,
        }}
      >
        <FeedCard
          title="درخواست‌های عضویت آژانس"
          count={requests?.length ?? null}
          countColor={STAFF_PANEL.warning}
          countBg="rgba(245,158,11,0.14)"
          loading={requests === null}
          empty="درخواست در انتظاری وجود ندارد."
          footer={
            <Link
              to="/panel/agencies"
              style={{
                display: 'block',
                padding: '11px 14px',
                borderTop: `1px solid ${STAFF_PANEL.sidebarBorder}`,
                textAlign: 'center',
                fontSize: 11.5,
                fontWeight: 700,
                color: STAFF_PANEL.link,
                textDecoration: 'none',
              }}
            >
              مدیریت آژانس‌ها ←
            </Link>
          }
        >
          {requests?.map((r) => (
            <Link
              key={r.id}
              to={`/panel/agencies/requests/${r.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 11,
                padding: '10px 9px',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: '#1d2a40',
                    color: STAFF_PANEL.warning,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 11,
                    flex: 'none',
                  }}
                >
                  {agencyInitial(r.applicantName)}
                </span>
                <div style={{ minWidth: 0, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: STAFF_PANEL.text, fontSize: 12 }}>{r.applicantName}</div>
                  <div style={{ fontSize: 10.5, color: STAFF_PANEL.textMuted }}>
                    مدیر: {r.managerName} · {r.city}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: STAFF_PANEL.link, flex: 'none' }}>بررسی ←</span>
            </Link>
          ))}
        </FeedCard>

        <FeedCard
          title="استرداد بلیط در انتظار بررسی"
          count={refunds ? awaitingRefunds.length : null}
          countColor={STAFF_PANEL.warning}
          countBg="rgba(245,158,11,0.14)"
          loading={refunds === null}
          empty="درخواست استرداد در انتظاری وجود ندارد."
          footer={
            <Link
              to="/panel/refund"
              style={{
                display: 'block',
                padding: '11px 14px',
                borderTop: `1px solid ${STAFF_PANEL.sidebarBorder}`,
                textAlign: 'center',
                fontSize: 11.5,
                fontWeight: 700,
                color: STAFF_PANEL.link,
                textDecoration: 'none',
              }}
            >
              مدیریت استرداد ←
            </Link>
          }
        >
          {awaitingRefunds.map((r) => (
            <Link
              key={r.id}
              to="/panel/refund"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 11,
                padding: '10px 9px',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: STAFF_PANEL.text, fontSize: 12 }}>{r.passengerName}</div>
                <div style={{ fontSize: 10.5, color: STAFF_PANEL.textMuted }}>{formatJalaliDate(r.createdAt)}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: STAFF_PANEL.link, flex: 'none' }}>بررسی ←</span>
            </Link>
          ))}
        </FeedCard>

        <FeedCard
          title="آخرین پیام‌های تماس با ما"
          count={messages?.length ?? null}
          countColor={STAFF_PANEL.link}
          countBg="rgba(96,165,250,0.14)"
          loading={messages === null}
          empty="پیامی ثبت نشده است."
        >
          {messages?.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 11,
                padding: '10px 9px',
                borderRadius: 10,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: STAFF_PANEL.text, fontSize: 12 }}>{m.name}</div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: STAFF_PANEL.textMuted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.subject}
                </div>
              </div>
              <span style={{ fontSize: 10.5, color: STAFF_PANEL.textMuted, flex: 'none' }}>
                {formatJalaliDate(m.createdAt)}
              </span>
            </div>
          ))}
        </FeedCard>
      </div>
    </div>
  );
}
