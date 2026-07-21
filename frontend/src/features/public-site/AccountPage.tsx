import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import { fetchClubPoints, fetchMyBookings, fetchMyRefunds, fetchWallet, topupWallet } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail, RefundRequestView } from '../../types/public-site';

// پنل کاربر — real data from the existing bookings/wallet/club-points/refunds
// endpoints (none of this is mock). Matches design-reference/پنل کاربر.dc.html's
// scope: سفرها، کیف پول، امتیاز باشگاه، مسافران، استردادها.

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'پیش‌نویس', bg: '#f1f4f8', color: '#5a6678' },
  HELD: { label: 'در انتظار پرداخت', bg: '#fff7e6', color: '#9a7d22' },
  PAID: { label: 'پرداخت‌شده', bg: '#eef4fb', color: '#1668c4' },
  TICKETED: { label: 'صادر شده', bg: '#e8f5ee', color: '#1f8a5b' },
  CANCELLED: { label: 'لغو شده', bg: '#f1f4f8', color: '#8a96a6' },
  EXPIRED: { label: 'منقضی شده', bg: '#fbf0ef', color: '#d64545' },
  REFUNDED: { label: 'مسترد شده', bg: '#f1f4f8', color: '#8a96a6' },
};

const REFUND_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'ثبت شده',
  REVIEW: 'در حال بررسی',
  FINANCE: 'در حال پردازش مالی',
  PAID: 'پرداخت شده',
};

const TIER_LABEL: Record<string, string> = { SILVER: 'نقره‌ای', GOLD: 'طلایی', PLATINUM: 'پلاتین' };

type TabKey = 'trips' | 'wallet' | 'points' | 'passengers' | 'refunds';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'trips', label: 'سفرها', icon: '🧳' },
  { key: 'wallet', label: 'کیف پول', icon: '💳' },
  { key: 'points', label: 'امتیاز باشگاه', icon: '★' },
  { key: 'passengers', label: 'مسافران', icon: '👤' },
  { key: 'refunds', label: 'استرداد‌ها', icon: '↺' },
];

export default function AccountPage() {
  const { status, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('trips');
  const [bookings, setBookings] = useState<BookingDetail[] | null>(null);
  const [wallet, setWallet] = useState<{ balanceIrr: number } | null>(null);
  const [club, setClub] = useState<{ isMember: boolean; level: string | null; balance: number } | null>(null);
  const [refunds, setRefunds] = useState<RefundRequestView[] | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/signin', { replace: true, state: { from: '/account' } });
    }
  }, [status, navigate]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchMyBookings().then(setBookings).catch(() => setBookings([]));
    fetchWallet().then(setWallet).catch(() => setWallet({ balanceIrr: 0 }));
    fetchClubPoints().then(setClub).catch(() => setClub(null));
    fetchMyRefunds().then(setRefunds).catch(() => setRefunds([]));
  }, [status]);

  async function onTopup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountToman = Number(topupAmount);
    if (!amountToman || amountToman <= 0) {
      setError('مبلغ معتبر وارد کنید.');
      return;
    }
    setTopupBusy(true);
    try {
      const result = await topupWallet(amountToman * 10);
      setWallet(result);
      setTopupAmount('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در شارژ کیف پول.');
    } finally {
      setTopupBusy(false);
    }
  }

  const passengerNames = bookings
    ? Array.from(new Set(bookings.flatMap((b) => b.passengers.map((p) => p.fullName)).filter(Boolean)))
    : [];

  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '36px 22px 30px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
            {(user?.fullName ?? 'کا').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('')}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>{user?.fullName ?? 'کاربر'}</h1>
            {club?.isMember && club.level && (
              <div style={{ fontSize: 12.5, color: '#e7c66b', fontWeight: 700 }}>★ عضو {TIER_LABEL[club.level] ?? club.level}</div>
            )}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 22px 60px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -20, marginBottom: 24 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              data-testid={`account-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                border: '1px solid #e6eaf0',
                background: tab === t.key ? '#1668c4' : '#fff',
                color: tab === t.key ? '#fff' : '#3b4554',
                borderRadius: 12,
                padding: '10px 16px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: tab === t.key ? '0 10px 24px -12px rgba(22,104,196,.5)' : '0 6px 16px -12px rgba(13,38,102,.3)',
                fontFamily: 'inherit',
              }}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {error && <p style={{ marginBottom: 16, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>}

        {tab === 'trips' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bookings === null && <p style={{ fontSize: 13, color: '#6b7787' }}>در حال بارگذاری…</p>}
            {bookings?.length === 0 && (
              <div style={{ background: '#fff', border: '1px dashed #e5e9f0', borderRadius: 16, padding: 40, textAlign: 'center', color: '#8a96a6', fontSize: 13 }}>
                هنوز سفری ثبت نکرده‌اید.{' '}
                <Link to="/" style={{ color: '#1668c4', fontWeight: 700 }}>
                  جستجوی پرواز
                </Link>
              </div>
            )}
            {bookings?.map((b) => {
              const st = STATUS_LABEL[b.status] ?? { label: b.status, bg: '#f1f4f8', color: '#5a6678' };
              return (
                <div key={b.id} data-testid="account-trip" style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0d2640' }}>
                      {b.originCode} <span style={{ color: '#b9c2cf' }}>←</span> {b.destCode}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 4 }}>
                      {b.flightNo} · {formatJalaliDateTime(b.departureAt)} · کد رزرو <span dir="ltr">{b.pnr}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, background: st.bg, color: st.color, padding: '5px 12px', borderRadius: 14 }}>{st.label}</span>
                    <Link to={b.pnr ? `/ticket/${b.pnr}` : '#'} style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
                      مشاهده بلیط
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'wallet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'linear-gradient(120deg,#1668c4,#0d3b66)', borderRadius: 18, padding: '22px 24px', color: '#fff' }}>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>موجودی کیف پول</div>
              <div data-testid="wallet-balance" style={{ fontSize: 26, fontWeight: 900 }}>
                {wallet ? faMoney(wallet.balanceIrr) : '—'} <span style={{ fontSize: 12, fontWeight: 400 }}>تومان</span>
              </div>
            </div>
            <form onSubmit={onTopup} style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '18px 20px', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>مبلغ شارژ (تومان)</label>
                <input
                  data-testid="wallet-topup-amount"
                  dir="ltr"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="مثلاً ۵۰۰۰۰۰"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
              <button
                type="submit"
                data-testid="wallet-topup-submit"
                disabled={topupBusy}
                style={{ border: 'none', borderRadius: 10, background: '#1668c4', color: '#fff', padding: '11px 22px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                شارژ کیف پول
              </button>
            </form>
          </div>
        )}

        {tab === 'points' && (
          <div style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 18, padding: '24px 26px' }}>
            {club?.isMember ? (
              <>
                <div style={{ fontSize: 12, color: '#8a96a6', marginBottom: 6 }}>امتیاز فعلی شما</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#1668c4', marginBottom: 10 }}>{faDigits(club.balance)}</div>
                <div style={{ fontSize: 12.5, color: '#caa53a', fontWeight: 700, marginBottom: 16 }}>★ سطح {TIER_LABEL[club.level ?? ''] ?? club.level}</div>
                <Link to="/club" style={{ fontSize: 12.5, color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
                  مشاهده شرایط و سطوح باشگاه ←
                </Link>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ fontSize: 13, color: '#6b7787', marginBottom: 14 }}>هنوز عضو باشگاه مشتریان نیستید.</p>
                <Link to="/club" style={{ background: '#1668c4', color: '#fff', padding: '10px 24px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, textDecoration: 'none' }}>
                  عضویت رایگان
                </Link>
              </div>
            )}
          </div>
        )}

        {tab === 'passengers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {passengerNames.length === 0 && <p style={{ fontSize: 13, color: '#8a96a6' }}>مسافری ثبت نشده است.</p>}
            {passengerNames.map((name) => (
              <div key={name} data-testid="account-passenger" style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1668c4,#0d3b66)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                  {name.trim().split(/\s+/).map((w) => w[0]).join('')}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16202e' }}>{name}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'refunds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {refunds?.length === 0 && <p style={{ fontSize: 13, color: '#8a96a6' }}>درخواست استردادی ثبت نشده است.</p>}
            {refunds?.map((r) => (
              <div key={r.id} data-testid="account-refund" style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>مبلغ قابل استرداد: {faMoney(r.refundableIrr)} تومان</div>
                  <div style={{ fontSize: 11, color: '#8a96a6', marginTop: 3 }}>جریمه {faDigits(r.penaltyPct)}٪</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 800, background: '#eef4fb', color: '#1668c4', padding: '5px 12px', borderRadius: 14 }}>
                  {REFUND_STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicPageShell>
  );
}
