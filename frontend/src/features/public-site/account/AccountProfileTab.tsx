import { useState } from 'react';
import type { AuthUser } from '../../../types/auth';
import { faDigits, faMoney } from '../../../lib/fa-format';
import { formatJalaliDate } from '../../../lib/jalali';
import { useLocale, type StoredLocale } from '../../../hooks/useLocale';
import type { BookingDetail, SavedPassenger, UserProfile } from '../../../types/public-site';
import AccountProfileSavedPax from '../AccountProfileSavedPax';

const STR: Record<
  StoredLocale,
  {
    userCode: string;
    memberSince: string;
    securityBtn: string;
    completionLabel: string;
    completionHint: string;
    incompleteHdr: string;
    incompleteSub: string;
    accountInfoHeading: string;
    editInfoBtn: string;
    notCompleted: string;
    fullNameLabel: string;
    nationalIdLabel: string;
    birthDateLabel: string;
    passportLabel: string;
    emailLabel: string;
    statTrips: string;
    statPoints: string;
    statWallet: string;
    statPassengers: string;
    saveButton: string;
    savingButton: string;
    emailHeading: string;
    emailNotSet: string;
    emailVerifiedTag: string;
    sendVerifyCodeBtn: string;
    codeLabel: string;
    verifyBtn: string;
    privacyHeading: string;
    privacyDesc: string;
    exportBtn: string;
    exportBusyBtn: string;
    deleteHeading: string;
    deleteWarning: string;
    deleteConfirmBtn: string;
    deleteBusyBtn: string;
    deleteCancelBtn: string;
  }
> = {
  fa: {
    userCode: 'کد کاربری',
    memberSince: 'عضویت از',
    securityBtn: 'تنظیمات امنیت',
    completionLabel: 'تکمیل پروفایل',
    completionHint: 'با تکمیل شماره گذرنامه و تأیید ایمیل، پروفایل را کامل کنید و ۲۰۰ امتیاز بگیرید.',
    incompleteHdr: 'پروفایل شما تکمیل نشده است',
    incompleteSub:
      'برای استفاده کامل از امکانات (رزرو سریع‌تر، احراز هویت و صدور کارت)، اطلاعات هویتی، ایمیل و آدرس خود را تکمیل کنید.',
    accountInfoHeading: 'اطلاعات حساب',
    editInfoBtn: 'ویرایش اطلاعات',
    notCompleted: 'تکمیل نشده',
    fullNameLabel: 'نام و نام خانوادگی',
    nationalIdLabel: 'کد ملی',
    birthDateLabel: 'تاریخ تولد',
    passportLabel: 'شماره گذرنامه',
    emailLabel: 'ایمیل',
    statTrips: 'سفرهای انجام‌شده',
    statPoints: 'امتیاز باشگاه',
    statWallet: 'موجودی کیف پول',
    statPassengers: 'مسافران ذخیره‌شده',
    saveButton: 'ذخیره اطلاعات',
    savingButton: 'در حال ذخیره…',
    emailHeading: 'ایمیل',
    emailNotSet: 'ایمیلی ثبت نشده است.',
    emailVerifiedTag: '· تأیید شده',
    sendVerifyCodeBtn: 'ارسال کد تأیید',
    codeLabel: 'کد تأیید',
    verifyBtn: 'تأیید',
    privacyHeading: 'حریم خصوصی و داده‌های من',
    privacyDesc:
      'می‌توانید خروجی کامل اطلاعات شخصی خود (سفرها، مسافران، کیف پول، استرداد‌ها) را دریافت کنید یا حساب کاربری خود را برای همیشه حذف کنید.',
    exportBtn: 'دانلود اطلاعات من',
    exportBusyBtn: 'در حال آماده‌سازی…',
    deleteHeading: 'حذف حساب کاربری',
    deleteWarning:
      'این عملیات غیرقابل بازگشت است. حساب شما غیرفعال می‌شود، اطلاعات هویتی مسافران شما حذف/ناشناس می‌شود و تمام نشست‌های فعال شما بسته خواهد شد.',
    deleteConfirmBtn: 'بله، حساب من حذف شود',
    deleteBusyBtn: 'در حال حذف…',
    deleteCancelBtn: 'انصراف',
  },
  en: {
    userCode: 'User code',
    memberSince: 'member since',
    securityBtn: 'Security Settings',
    completionLabel: 'Profile Completion',
    completionHint: 'Complete your passport number and verify your email to finish your profile and earn 200 points.',
    incompleteHdr: 'Your profile is incomplete',
    incompleteSub:
      'Complete your identity, email, and address info to fully use the features (faster booking, verification, and card issuance).',
    accountInfoHeading: 'Account Information',
    editInfoBtn: 'Edit Info',
    notCompleted: 'Not completed',
    fullNameLabel: 'Full Name',
    nationalIdLabel: 'National ID',
    birthDateLabel: 'Date of Birth',
    passportLabel: 'Passport Number',
    emailLabel: 'Email',
    statTrips: 'Completed Trips',
    statPoints: 'Loyalty Points',
    statWallet: 'Wallet Balance',
    statPassengers: 'Saved Passengers',
    saveButton: 'Save Info',
    savingButton: 'Saving…',
    emailHeading: 'Email',
    emailNotSet: 'No email on file.',
    emailVerifiedTag: '· Verified',
    sendVerifyCodeBtn: 'Send Verification Code',
    codeLabel: 'Verification Code',
    verifyBtn: 'Verify',
    privacyHeading: 'Privacy & My Data',
    privacyDesc:
      'You can download a full export of your personal data (trips, passengers, wallet, refunds) or permanently delete your account.',
    exportBtn: 'Download My Data',
    exportBusyBtn: 'Preparing…',
    deleteHeading: 'Delete Account',
    deleteWarning:
      'This action is irreversible. Your account will be deactivated, your passengers’ identity data will be deleted/anonymized, and all your active sessions will be closed.',
    deleteConfirmBtn: 'Yes, delete my account',
    deleteBusyBtn: 'Deleting…',
    deleteCancelBtn: 'Cancel',
  },
  ar: {
    userCode: 'رمز المستخدم',
    memberSince: 'عضو منذ',
    securityBtn: 'إعدادات الأمان',
    completionLabel: 'تكامل الملف الشخصي',
    completionHint: 'أكمل رقم جواز السفر وتحقق من بريدك الإلكتروني لإكمال ملفك والحصول على 200 نقطة.',
    incompleteHdr: 'ملفك الشخصي غير مكتمل',
    incompleteSub:
      'أكمل معلومات هويتك وبريدك الإلكتروني وعنوانك لاستخدام جميع الميزات (حجز أسرع، التحقق، وإصدار البطاقة).',
    accountInfoHeading: 'معلومات الحساب',
    editInfoBtn: 'تعديل المعلومات',
    notCompleted: 'لم يكتمل',
    fullNameLabel: 'الاسم الكامل',
    nationalIdLabel: 'الرقم الوطني',
    birthDateLabel: 'تاريخ الميلاد',
    passportLabel: 'رقم جواز السفر',
    emailLabel: 'البريد الإلكتروني',
    statTrips: 'الرحلات المكتملة',
    statPoints: 'نقاط الولاء',
    statWallet: 'رصيد المحفظة',
    statPassengers: 'المسافرون المحفوظون',
    saveButton: 'حفظ المعلومات',
    savingButton: 'جارٍ الحفظ…',
    emailHeading: 'البريد الإلكتروني',
    emailNotSet: 'لا يوجد بريد إلكتروني مسجّل.',
    emailVerifiedTag: '· تم التحقق',
    sendVerifyCodeBtn: 'إرسال رمز التحقق',
    codeLabel: 'رمز التحقق',
    verifyBtn: 'تحقق',
    privacyHeading: 'الخصوصية وبياناتي',
    privacyDesc:
      'يمكنك تنزيل نسخة كاملة من بياناتك الشخصية (الرحلات، المسافرون، المحفظة، الاستردادات) أو حذف حسابك نهائيًا.',
    exportBtn: 'تنزيل بياناتي',
    exportBusyBtn: 'جارٍ التحضير…',
    deleteHeading: 'حذف الحساب',
    deleteWarning:
      'هذا الإجراء لا رجعة فيه. سيتم إلغاء تفعيل حسابك، وحذف/إخفاء هوية بيانات المسافرين، وإغلاق جميع جلساتك النشطة.',
    deleteConfirmBtn: 'نعم، احذف حسابي',
    deleteBusyBtn: 'جارٍ الحذف…',
    deleteCancelBtn: 'إلغاء',
  },
};

function ProfileStat({
  label,
  value,
  accent,
  bg,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      data-testid="profile-stat"
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 14,
        padding: '13px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: bg,
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        {icon}
      </span>
      <div style={{ lineHeight: 1.5, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#16202e' }}>{value}</div>
        <div style={{ fontSize: 10, color: '#9aa4b2', whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  );
}

function FieldCell({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div style={{ background: '#f6f8fb', borderRadius: 12, padding: '11px 13px' }}>
      <div style={{ fontSize: 10.5, color: '#9aa4b2', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }} dir={dir}>
        {value}
      </div>
    </div>
  );
}

interface ProfileForm {
  fullName: string;
  nationalId: string;
  birthDate: string;
  passportNo: string;
}

interface Props {
  user: AuthUser | null;
  profile: UserProfile | null;
  profileForm: ProfileForm;
  onProfileFormChange: (next: ProfileForm) => void;
  onSaveProfile: (e: React.FormEvent) => void;
  profileSaving: boolean;
  profileError: string | null;
  profileNotice: string | null;
  bookings: BookingDetail[] | null;
  clubBalance: number;
  walletBalanceIrr: string | null;
  savedPassengers: SavedPassenger[] | null;
  isMobile: boolean;
  onGoSecurity: () => void;
  onAddPassenger: () => void;
  emailChallengeId: string | null;
  emailCode: string;
  onEmailCodeChange: (code: string) => void;
  onRequestEmailVerify: () => void;
  onVerifyEmail: (e: React.FormEvent) => void;
  exportBusy: boolean;
  exportError: string | null;
  onExportData: () => void;
  deleteConfirmOpen: boolean;
  deleteBusy: boolean;
  deleteError: string | null;
  onDeleteOpen: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}

export default function AccountProfileTab({
  user,
  profile,
  profileForm,
  onProfileFormChange,
  onSaveProfile,
  profileSaving,
  profileError,
  profileNotice,
  bookings,
  clubBalance,
  walletBalanceIrr,
  savedPassengers,
  isMobile,
  onGoSecurity,
  onAddPassenger,
  emailChallengeId,
  emailCode,
  onEmailCodeChange,
  onRequestEmailVerify,
  onVerifyEmail,
  exportBusy,
  exportError,
  onExportData,
  deleteConfirmOpen,
  deleteBusy,
  deleteError,
  onDeleteOpen,
  onDeleteCancel,
  onDeleteConfirm,
}: Props) {
  const { locale } = useLocale();
  const t = STR[locale];
  const [editing, setEditing] = useState(false);

  const displayName = profile?.fullName ?? user?.fullName ?? '—';
  const userCode = user ? `CM-${user.id.replace(/\D/g, '').slice(-4).padStart(4, '0')}` : '—';
  const completedTrips = bookings?.filter((b) => b.status === 'TICKETED').length ?? 0;
  const statsCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const fieldsCols = isMobile ? '1fr' : 'repeat(2, 1fr)';

  const fieldValue = (value: string | null | undefined) => value?.trim() || t.notCompleted;

  const profileFields = [
    { label: t.fullNameLabel, value: fieldValue(profile?.fullName ?? profileForm.fullName), dir: locale === 'en' ? ('ltr' as const) : ('rtl' as const) },
    { label: t.nationalIdLabel, value: fieldValue(profile?.nationalId ?? profileForm.nationalId), dir: 'ltr' as const },
    {
      label: t.birthDateLabel,
      value: profile?.birthDate ? formatJalaliDate(profile.birthDate) : fieldValue(profileForm.birthDate),
      dir: 'ltr' as const,
    },
    { label: t.passportLabel, value: fieldValue(profile?.passportNo ?? profileForm.passportNo), dir: 'ltr' as const },
    { label: t.emailLabel, value: fieldValue(profile?.email ?? undefined), dir: 'ltr' as const },
  ];

  return (
    <div data-testid="account-profile-tab" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          background: 'linear-gradient(135deg,#0d2640,#16406e)',
          color: '#fff',
          borderRadius: 18,
          padding: '20px 22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#ffffff22',
              border: '2px solid #ffffff55',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-9 2.69-9 6v2h18v-2c0-3.31-3.67-6-9-6z" />
            </svg>
          </div>
          <div style={{ lineHeight: 1.6, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{displayName}</div>
            <div style={{ fontSize: 11.5, color: '#aac4e2' }}>
              {t.userCode} <span dir="ltr">{userCode}</span>
            </div>
          </div>
          <button
            type="button"
            data-testid="profile-go-security"
            onClick={onGoSecurity}
            style={{
              marginRight: 'auto',
              fontSize: 11.5,
              fontWeight: 700,
              background: '#ffffff1e',
              border: '1px solid #ffffff33',
              padding: '9px 14px',
              borderRadius: 11,
              cursor: 'pointer',
              color: '#fff',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {t.securityBtn}
          </button>
        </div>
        <div
          style={{
            marginTop: 16,
            background: '#ffffff14',
            border: '1px solid #ffffff22',
            borderRadius: 12,
            padding: '11px 14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              marginBottom: 8,
            }}
          >
            <span style={{ color: '#aac4e2' }}>{t.completionLabel}</span>
            <span style={{ fontWeight: 800, color: '#f2d98a' }}>
              {profile ? `${faDigits(profile.completionPct)}٪` : '—'}
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
          <div style={{ fontSize: 10, color: '#8fa9cc', marginTop: 7 }}>{t.completionHint}</div>
        </div>
      </div>

      {profile && profile.completionPct < 100 && (
        <div
          data-testid="profile-incomplete-notice"
          style={{
            background: 'linear-gradient(135deg,#fff8ec,#fef2e0)',
            border: '1px solid #f6e0bb',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 13,
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f0a83c',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" />
              <path d="M12 9v3M12 16h.01" />
            </svg>
          </span>
          <div style={{ lineHeight: 1.6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#9a6a16' }}>{t.incompleteHdr}</div>
            <div style={{ fontSize: 11.5, color: '#b07f2a' }}>{t.incompleteSub}</div>
          </div>
        </div>
      )}

      <div data-testid="profile-stats-grid" style={{ display: 'grid', gridTemplateColumns: statsCols, gap: 11 }}>
        <ProfileStat
          label={t.statTrips}
          value={faDigits(completedTrips)}
          accent="#1668c4"
          bg="#eef4fb"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
            </svg>
          }
        />
        <ProfileStat
          label={t.statPoints}
          value={faDigits(clubBalance)}
          accent="#caa53a"
          bg="#fdf6e3"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 15.9 6.8 18.6l1-5.8L3.5 8.7l5.9-.9z" />
            </svg>
          }
        />
        <ProfileStat
          label={t.statWallet}
          value={walletBalanceIrr ? faMoney(walletBalanceIrr) : '—'}
          accent="#1f8a5b"
          bg="#e9f6ef"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="6" width="18" height="13" rx="2.5" />
              <path d="M3 10h18" />
              <circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          }
        />
        <ProfileStat
          label={t.statPassengers}
          value={faDigits(savedPassengers?.length ?? 0)}
          accent="#7c5cd6"
          bg="#f1edfb"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
              <path d="M16 4.5a3.2 3.2 0 0 1 0 6.4" />
              <path d="M21 20c0-2.8-1.7-5-4-5.7" />
            </svg>
          }
        />
      </div>

      {profileNotice && <p style={{ fontSize: 12, color: '#1f8a5b', margin: 0 }}>{profileNotice}</p>}
      {profileError && (
        <p role="alert" style={{ fontSize: 12, color: '#e5484d', margin: 0 }}>
          {profileError}
        </p>
      )}

      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{t.accountInfoHeading}</h3>
          <button
            type="button"
            data-testid="profile-edit-toggle"
            onClick={() => setEditing((v) => !v)}
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: '#1668c4',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.editInfoBtn}
          </button>
        </div>
        {editing ? (
          <form onSubmit={onSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label htmlFor="profile-fullName" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                {t.fullNameLabel}
              </label>
              <input
                id="profile-fullName"
                value={profileForm.fullName}
                onChange={(e) => onProfileFormChange({ ...profileForm, fullName: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>
            <div>
              <label htmlFor="profile-nationalId" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                {t.nationalIdLabel}
              </label>
              <input
                id="profile-nationalId"
                dir="ltr"
                value={profileForm.nationalId}
                onChange={(e) => onProfileFormChange({ ...profileForm, nationalId: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>
            <div>
              <label htmlFor="profile-passportNo" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                {t.passportLabel}
              </label>
              <input
                id="profile-passportNo"
                dir="ltr"
                value={profileForm.passportNo}
                onChange={(e) => onProfileFormChange({ ...profileForm, passportNo: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              style={{
                border: 'none',
                borderRadius: 10,
                background: '#1668c4',
                color: '#fff',
                padding: '11px 22px',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                alignSelf: 'flex-start',
              }}
            >
              {profileSaving ? t.savingButton : t.saveButton}
            </button>
          </form>
        ) : (
          <div data-testid="profile-fields-grid" style={{ display: 'grid', gridTemplateColumns: fieldsCols, gap: 11 }}>
            {profileFields.map((f) => (
              <FieldCell key={f.label} label={f.label} value={f.value} dir={f.dir} />
            ))}
          </div>
        )}
      </div>

      {savedPassengers && (
        <AccountProfileSavedPax passengers={savedPassengers} onAdd={onAddPassenger} />
      )}

      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>{t.emailHeading}</h3>
        <p style={{ fontSize: 12, color: '#5a6678', marginBottom: 12 }}>
          {profile?.email ?? t.emailNotSet}{' '}
          {profile?.emailVerifiedAt && <span style={{ color: '#1f8a5b', fontWeight: 700 }}>{t.emailVerifiedTag}</span>}
        </p>
        {profile?.email && !profile.emailVerifiedAt && (
          <>
            {!emailChallengeId ? (
              <button
                type="button"
                onClick={() => void onRequestEmailVerify()}
                style={{
                  border: '1px solid #1668c4',
                  borderRadius: 10,
                  background: 'transparent',
                  color: '#1668c4',
                  padding: '9px 18px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t.sendVerifyCodeBtn}
              </button>
            ) : (
              <form onSubmit={onVerifyEmail} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label htmlFor="email-code" style={{ display: 'block', fontSize: 11, color: '#5a6678', marginBottom: 6 }}>
                    {t.codeLabel}
                  </label>
                  <input
                    id="email-code"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailCode}
                    onChange={(e) => onEmailCodeChange(e.target.value.replace(/\D/g, ''))}
                    style={{
                      width: 140,
                      boxSizing: 'border-box',
                      padding: '10px 13px',
                      border: '1.5px solid #e3e9f1',
                      borderRadius: 10,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      textAlign: 'center',
                      letterSpacing: 4,
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    border: 'none',
                    borderRadius: 10,
                    background: '#1668c4',
                    color: '#fff',
                    padding: '11px 18px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.verifyBtn}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>{t.privacyHeading}</h3>
        {exportError && (
          <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 10 }}>
            {exportError}
          </p>
        )}
        <p style={{ fontSize: 12, color: '#5a6678', marginBottom: 12 }}>{t.privacyDesc}</p>
        <button
          type="button"
          data-testid="privacy-export-button"
          disabled={exportBusy}
          onClick={() => void onExportData()}
          style={{
            border: '1px solid #1668c4',
            borderRadius: 10,
            background: 'transparent',
            color: '#1668c4',
            padding: '9px 18px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: 18,
          }}
        >
          {exportBusy ? t.exportBusyBtn : t.exportBtn}
        </button>
        <div style={{ borderTop: '1px solid #f1f4f8', paddingTop: 16 }}>
          <h4 style={{ fontSize: 12.5, fontWeight: 800, color: '#e5484d', margin: '0 0 8px' }}>{t.deleteHeading}</h4>
          {!deleteConfirmOpen ? (
            <button
              type="button"
              data-testid="privacy-delete-open"
              onClick={onDeleteOpen}
              style={{
                border: '1px solid #e5484d',
                borderRadius: 10,
                background: 'transparent',
                color: '#e5484d',
                padding: '9px 18px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.deleteHeading}
            </button>
          ) : (
            <div style={{ background: '#fef2f2', border: '1px solid #fbd0d0', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: 12, color: '#8a2c2c', marginBottom: 12 }}>{t.deleteWarning}</p>
              {deleteError && (
                <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 10 }}>
                  {deleteError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid="privacy-delete-confirm"
                  disabled={deleteBusy}
                  onClick={() => void onDeleteConfirm()}
                  style={{
                    border: 'none',
                    borderRadius: 10,
                    background: '#e5484d',
                    color: '#fff',
                    padding: '9px 18px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {deleteBusy ? t.deleteBusyBtn : t.deleteConfirmBtn}
                </button>
                <button
                  type="button"
                  data-testid="privacy-delete-cancel"
                  disabled={deleteBusy}
                  onClick={onDeleteCancel}
                  style={{
                    border: '1px solid #e3e9f1',
                    borderRadius: 10,
                    background: '#fff',
                    color: '#5a6678',
                    padding: '9px 18px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.deleteCancelBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
