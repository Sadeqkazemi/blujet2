import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import {
  deleteMyAccount,
  fetchClubPoints,
  fetchMyBookings,
  fetchMyProfile,
  fetchMyRefunds,
  fetchPrivacyExport,
  fetchWallet,
  requestEmailVerify,
  topupWallet,
  updateMyProfile,
  verifyEmail,
} from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail, RefundRequestView, UserProfile } from '../../types/public-site';

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

type TabKey = 'trips' | 'wallet' | 'points' | 'passengers' | 'refunds' | 'profile';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'profile', label: 'پروفایل من', icon: '🪪' },
  { key: 'trips', label: 'سفرها', icon: '🧳' },
  { key: 'wallet', label: 'کیف پول', icon: '💳' },
  { key: 'points', label: 'امتیاز باشگاه', icon: '★' },
  { key: 'passengers', label: 'مسافران', icon: '👤' },
  { key: 'refunds', label: 'استرداد‌ها', icon: '↺' },
];

export default function AccountPage() {
  const { status, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('trips');
  const [bookings, setBookings] = useState<BookingDetail[] | null>(null);
  const [wallet, setWallet] = useState<{ balanceIrr: number } | null>(null);
  const [club, setClub] = useState<{ isMember: boolean; level: string | null; balance: number } | null>(null);
  const [refunds, setRefunds] = useState<RefundRequestView[] | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    nationalId: '',
    birthDate: '',
    passportNo: '',
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailChallengeId, setEmailChallengeId] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    fetchMyProfile()
      .then((p) => {
        setProfile(p);
        setProfileForm({
          fullName: p.fullName ?? '',
          nationalId: p.nationalId ?? '',
          birthDate: p.birthDate ? formatJalaliDate(p.birthDate) : '',
          passportNo: p.passportNo ?? '',
        });
      })
      .catch(() => setProfile(null));
  }, [status]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileNotice(null);
    setProfileSaving(true);
    try {
      const updated = await updateMyProfile({
        fullName: profileForm.fullName || undefined,
        nationalId: profileForm.nationalId || undefined,
        passportNo: profileForm.passportNo || undefined,
      });
      setProfile(updated);
      setProfileNotice('اطلاعات پروفایل ذخیره شد ✓');
    } catch (err) {
      setProfileError(err instanceof ApiRequestError ? err.message : 'خطا در ذخیره اطلاعات.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function onRequestEmailVerify() {
    setProfileError(null);
    try {
      const { challengeId } = await requestEmailVerify();
      setEmailChallengeId(challengeId);
      setProfileNotice('کد تأیید به ایمیل شما ارسال شد.');
    } catch (err) {
      setProfileError(err instanceof ApiRequestError ? err.message : 'خطا در ارسال کد تأیید.');
    }
  }

  async function onVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailChallengeId || emailCode.trim().length !== 6) {
      setProfileError('کد ۶ رقمی را کامل وارد کنید.');
      return;
    }
    setProfileError(null);
    try {
      await verifyEmail(emailChallengeId, emailCode.trim());
      setEmailChallengeId(null);
      setEmailCode('');
      const updated = await fetchMyProfile();
      setProfile(updated);
      setProfileNotice('ایمیل شما تأیید شد ✓');
    } catch (err) {
      setProfileError(err instanceof ApiRequestError ? err.message : 'کد وارد شده نادرست است.');
    }
  }

  async function onExportData() {
    setExportError(null);
    setExportBusy(true);
    try {
      const data = await fetchPrivacyExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'blujet-my-data.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof ApiRequestError ? err.message : 'خطا در دریافت اطلاعات.');
    } finally {
      setExportBusy(false);
    }
  }

  async function onConfirmDelete() {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await deleteMyAccount();
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof ApiRequestError ? err.message : 'خطا در حذف حساب کاربری.');
      setDeleteBusy(false);
    }
  }

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

        {profile && profile.completionPct < 100 && !bannerDismissed && tab !== 'profile' && (
          <div
            data-testid="profile-incomplete-banner"
            style={{
              marginBottom: 16,
              borderRadius: 12,
              background: '#fff8ec',
              border: '1px solid #f2e0b2',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12.5, color: '#8a6a1f' }}>
              پروفایل شما {faDigits(profile.completionPct)}٪ تکمیل شده است. برای تکمیل، اطلاعات هویتی خود
              را وارد کنید.
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setTab('profile')}
                style={{ border: 'none', borderRadius: 9, background: '#e7c66b', color: '#3b2f0e', padding: '7px 14px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                تکمیل پروفایل
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                style={{ border: 'none', background: 'transparent', color: '#8a6a1f', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                بعداً
              </button>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'linear-gradient(135deg,#0d2640,#16406e)', color: '#fff', borderRadius: 18, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
                <span style={{ color: '#aac4e2' }}>تکمیل پروفایل</span>
                <span style={{ fontWeight: 800, color: '#f2d98a' }}>
                  {profile ? faDigits(profile.completionPct) : '—'}٪
                </span>
              </div>
              <div style={{ height: 7, borderRadius: 6, background: '#ffffff1c', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${profile?.completionPct ?? 0}%`,
                    borderRadius: 6,
                    background: 'linear-gradient(90deg,#f2d98a,#caa53a)',
                  }}
                />
              </div>
            </div>

            {profileNotice && <p style={{ fontSize: 12, color: '#1f8a5b' }}>{profileNotice}</p>}
            {profileError && <p role="alert" style={{ fontSize: 12, color: '#e5484d' }}>{profileError}</p>}

            <form onSubmit={onSaveProfile} style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>اطلاعات حساب</h3>
              <div>
                <label htmlFor="profile-fullName" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                  نام و نام خانوادگی
                </label>
                <input
                  id="profile-fullName"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
              <div>
                <label htmlFor="profile-nationalId" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                  کد ملی
                </label>
                <input
                  id="profile-nationalId"
                  dir="ltr"
                  value={profileForm.nationalId}
                  onChange={(e) => setProfileForm((f) => ({ ...f, nationalId: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
              <div>
                <label htmlFor="profile-passportNo" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                  شماره گذرنامه
                </label>
                <input
                  id="profile-passportNo"
                  dir="ltr"
                  value={profileForm.passportNo}
                  onChange={(e) => setProfileForm((f) => ({ ...f, passportNo: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                style={{ border: 'none', borderRadius: 10, background: '#1668c4', color: '#fff', padding: '11px 22px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}
              >
                {profileSaving ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
              </button>
            </form>

            <div style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px' }}>ایمیل</h3>
              <p style={{ fontSize: 12, color: '#5a6678', marginBottom: 12 }}>
                {profile?.email ?? 'ایمیلی ثبت نشده است.'}{' '}
                {profile?.emailVerifiedAt && <span style={{ color: '#1f8a5b', fontWeight: 700 }}>· تأیید شده</span>}
              </p>
              {profile?.email && !profile.emailVerifiedAt && (
                <>
                  {!emailChallengeId ? (
                    <button
                      type="button"
                      onClick={() => void onRequestEmailVerify()}
                      style={{ border: '1px solid #1668c4', borderRadius: 10, background: 'transparent', color: '#1668c4', padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      ارسال کد تأیید
                    </button>
                  ) : (
                    <form onSubmit={onVerifyEmail} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div>
                        <label htmlFor="email-code" style={{ display: 'block', fontSize: 11, color: '#5a6678', marginBottom: 6 }}>
                          کد تأیید
                        </label>
                        <input
                          id="email-code"
                          dir="ltr"
                          inputMode="numeric"
                          maxLength={6}
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                          style={{ width: 140, boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, textAlign: 'center', letterSpacing: 4 }}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{ border: 'none', borderRadius: 10, background: '#1668c4', color: '#fff', padding: '11px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        تأیید
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px' }}>حریم خصوصی و داده‌های من</h3>
              {exportError && <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 10 }}>{exportError}</p>}
              <p style={{ fontSize: 12, color: '#5a6678', marginBottom: 12 }}>
                می‌توانید خروجی کامل اطلاعات شخصی خود (سفرها، مسافران، کیف پول، استرداد‌ها) را دریافت کنید یا حساب
                کاربری خود را برای همیشه حذف کنید.
              </p>
              <button
                type="button"
                data-testid="privacy-export-button"
                disabled={exportBusy}
                onClick={() => void onExportData()}
                style={{ border: '1px solid #1668c4', borderRadius: 10, background: 'transparent', color: '#1668c4', padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 }}
              >
                {exportBusy ? 'در حال آماده‌سازی…' : 'دانلود اطلاعات من'}
              </button>

              <div style={{ borderTop: '1px solid #f1f4f8', paddingTop: 16 }}>
                <h4 style={{ fontSize: 12.5, fontWeight: 800, color: '#e5484d', margin: '0 0 8px' }}>حذف حساب کاربری</h4>
                {!deleteConfirmOpen ? (
                  <button
                    type="button"
                    data-testid="privacy-delete-open"
                    onClick={() => setDeleteConfirmOpen(true)}
                    style={{ border: '1px solid #e5484d', borderRadius: 10, background: 'transparent', color: '#e5484d', padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    حذف حساب کاربری
                  </button>
                ) : (
                  <div style={{ background: '#fef2f2', border: '1px solid #fbd0d0', borderRadius: 12, padding: '14px 16px' }}>
                    <p style={{ fontSize: 12, color: '#8a2c2c', marginBottom: 12 }}>
                      این عملیات غیرقابل بازگشت است. حساب شما غیرفعال می‌شود، اطلاعات هویتی مسافران شما حذف/ناشناس
                      می‌شود و تمام نشست‌های فعال شما بسته خواهد شد.
                    </p>
                    {deleteError && <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 10 }}>{deleteError}</p>}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        data-testid="privacy-delete-confirm"
                        disabled={deleteBusy}
                        onClick={() => void onConfirmDelete()}
                        style={{ border: 'none', borderRadius: 10, background: '#e5484d', color: '#fff', padding: '9px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {deleteBusy ? 'در حال حذف…' : 'بله، حساب من حذف شود'}
                      </button>
                      <button
                        type="button"
                        data-testid="privacy-delete-cancel"
                        disabled={deleteBusy}
                        onClick={() => setDeleteConfirmOpen(false)}
                        style={{ border: '1px solid #e3e9f1', borderRadius: 10, background: '#fff', color: '#5a6678', padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
