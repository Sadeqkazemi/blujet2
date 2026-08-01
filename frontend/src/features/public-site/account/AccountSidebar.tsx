import type { AuthUser } from '../../../types/auth';
import { faDigits, faMoney } from '../../../lib/fa-format';
import { useLocale, type StoredLocale } from '../../../hooks/useLocale';
import type { TabKey } from './account-types';

const TIER_LABEL: Record<string, Record<StoredLocale, string>> = {
  SILVER: { fa: 'عضو نقره‌ای باشگاه', en: 'Silver Club Member', ar: 'عضو فضية النادي' },
  GOLD: { fa: 'عضو طلایی باشگاه', en: 'Gold Club Member', ar: 'عضو ذهبية النادي' },
  PLATINUM: { fa: 'عضو پلاتین باشگاه', en: 'Platinum Club Member', ar: 'عضو بلاتينية النادي' },
};

const STR: Record<
  StoredLocale,
  {
    loyaltyPoints: string;
    walletLink: string;
    logout: string;
    defaultUserName: string;
    newMember: string;
  }
> = {
  fa: {
    loyaltyPoints: 'امتیاز باشگاه',
    walletLink: 'کیف پول',
    logout: 'خروج از حساب',
    defaultUserName: 'کاربر',
    newMember: 'عضو جدید باشگاه',
  },
  en: {
    loyaltyPoints: 'Loyalty Points',
    walletLink: 'Wallet',
    logout: 'Log Out',
    defaultUserName: 'User',
    newMember: 'New Club Member',
  },
  ar: {
    loyaltyPoints: 'نقاط الولاء',
    walletLink: 'المحفظة',
    logout: 'تسجيل الخروج',
    defaultUserName: 'مستخدم',
    newMember: 'عضو جديد النادي',
  },
};

type NavItem = { key: TabKey; label: Record<StoredLocale, string>; icon: React.ReactNode };

const PRIMARY_NAV: NavItem[] = [
  {
    key: 'profile',
    label: { fa: 'پروفایل من', en: 'My Profile', ar: 'ملفي الشخصي' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21" />
        <circle cx="12" cy="7.5" r="4" />
      </svg>
    ),
  },
  {
    key: 'account-info',
    label: { fa: 'اطلاعات حساب', en: 'Account Information', ar: 'معلومات الحساب' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
  {
    key: 'trips',
    label: { fa: 'سفرها و خریدها', en: 'Trips & Purchases', ar: 'الرحلات والمشتريات' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5v2.2a1.6 1.6 0 0 0 0 2.6v2.2A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 15.5v-2.2a1.6 1.6 0 0 0 0-2.6Z" />
        <path d="M14 7v12" strokeDasharray="1.5 2.5" />
      </svg>
    ),
  },
  {
    key: 'refunds',
    label: { fa: 'استرداد بلیط', en: 'Refund Ticket', ar: 'استرداد التذكرة' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10a6 6 0 0 1 6 6v1" />
      </svg>
    ),
  },
  {
    key: 'wallet',
    label: { fa: 'کیف پول و امتیاز', en: 'Wallet & Points', ar: 'المحفظة والنقاط' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 11V7.5A1.5 1.5 0 0 0 19.5 6H5a2 2 0 0 1 0-4h13" />
        <path d="M3 4v14a2 2 0 0 0 2 2h14.5a1.5 1.5 0 0 0 1.5-1.5V15" />
        <path d="M21 11h-4a2 2 0 0 0 0 4h4Z" />
      </svg>
    ),
  },
  {
    key: 'club',
    label: { fa: 'باشگاه مشتریان', en: 'Loyalty Club', ar: 'نادي الولاء' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 8.5 7 12l5-7 5 7 4-3.5-1.8 9.5a1 1 0 0 1-1 .8H5.8a1 1 0 0 1-1-.8Z" />
        <circle cx="12" cy="3.6" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

const ACCOUNT_NAV: NavItem[] = [
  {
    key: 'saved',
    label: { fa: 'نشان‌شده‌ها', en: 'Saved', ar: 'المحفوظة' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
      </svg>
    ),
  },
  {
    key: 'price-locks',
    label: { fa: 'قفل قیمت', en: 'Price Lock', ar: 'قفل السعر' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
  {
    key: 'passengers',
    label: { fa: 'مسافران', en: 'Passengers', ar: 'المسافرون' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
  {
    key: 'tickets',
    label: { fa: 'پیام به پشتیبانی', en: 'Message Support', ar: 'رسالة للدعم' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    key: 'identity',
    label: { fa: 'احراز هویت', en: 'Identity Verification', ar: 'التحقق من الهوية' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="11" r="2" />
        <path d="M13 10h5M13 14h4M5.5 16a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    key: 'security',
    label: { fa: 'امنیت حساب', en: 'Account Security', ar: 'أمان الحساب' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" />
      </svg>
    ),
  },
  {
    key: 'banks',
    label: { fa: 'حساب‌های بانکی', en: 'Bank Accounts', ar: 'الحسابات البنكية' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    key: 'referral',
    label: { fa: 'معرفی دوستان', en: 'Invite Friends', ar: 'دعوة الأصدقاء' },
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

function NavButton({
  item,
  active,
  locale,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  locale: StoredLocale;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`account-tab-${item.key}`}
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        padding: '9px 12px',
        borderRadius: 11,
        cursor: 'pointer',
        fontSize: 13,
        whiteSpace: 'nowrap',
        fontWeight: active ? 700 : 600,
        color: active ? '#1668c4' : '#3b4554',
        background: active ? '#eef4fb' : 'transparent',
        marginBottom: 2,
        border: 'none',
        fontFamily: 'inherit',
        textAlign: 'inherit',
      }}
    >
      <span
        style={{
          position: 'absolute',
          right: -1,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: active ? 18 : 0,
          borderRadius: 3,
          background: '#1668c4',
          transition: 'height .15s',
        }}
      />
      <span
        style={{
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? '#1668c4' : '#8a96a6',
          flex: 'none',
        }}
      >
        {item.icon}
      </span>
      {item.label[locale]}
    </button>
  );
}

interface Props {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  user: AuthUser | null;
  club: { isMember: boolean; level: string | null; balance: number } | null;
  onSignOut: () => void;
  isMobile: boolean;
}

export default function AccountSidebar({
  tab,
  onTabChange,
  user,
  club,
  onSignOut,
  isMobile,
}: Props) {
  const { locale } = useLocale();
  const t = STR[locale];
  const displayName = user?.fullName ?? t.defaultUserName;
  const membershipBadge =
    club?.isMember && club.level
      ? (TIER_LABEL[club.level]?.[locale] ?? club.level)
      : t.newMember;

  return (
    <aside
      data-testid="account-sidebar"
      style={{
        position: isMobile ? 'static' : 'sticky',
        top: isMobile ? 0 : 86,
        alignSelf: 'start',
        background: '#fff',
        border: '1px solid #e9eef4',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 20px 44px -32px rgba(13,38,102,.55)',
      }}
    >
      <div
        style={{
          padding: '16px 15px 15px',
          background: 'linear-gradient(150deg,#123a62 0%,#0c243d 100%)',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#ffffff2e,#ffffff0f)',
              border: '1.5px solid #ffffff59',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-9 2.69-9 6v2h18v-2c0-3.31-3.67-6-9-6z" />
            </svg>
          </div>
          <div style={{ minWidth: 0, lineHeight: 1.4 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800 }}>{displayName}</div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 6,
                fontSize: 10,
                fontWeight: 700,
                color: '#f2d98a',
                background: '#ffffff17',
                border: '1px solid #ffffff29',
                padding: '3px 9px',
                borderRadius: 12,
                whiteSpace: 'nowrap',
              }}
            >
              {membershipBadge}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff12',
            border: '1px solid #ffffff24',
            borderRadius: 12,
            padding: '9px 8px 9px 12px',
          }}
        >
          <div style={{ lineHeight: 1.35, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, color: '#aac4e2', whiteSpace: 'nowrap' }}>{t.loyaltyPoints}</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2, whiteSpace: 'nowrap' }}>
              {faDigits(club?.balance ?? 0)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTabChange('wallet')}
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#0d2640',
              background: '#f2d98a',
              padding: '7px 11px',
              borderRadius: 9,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              border: 'none',
              fontFamily: 'inherit',
            }}
          >
            {t.walletLink} ›
          </button>
        </div>
      </div>
      <div style={{ padding: 9 }}>
        {PRIMARY_NAV.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={tab === item.key}
            locale={locale}
            onSelect={() => onTabChange(item.key)}
          />
        ))}
        <div style={{ height: 6 }} />
        {ACCOUNT_NAV.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={tab === item.key}
            locale={locale}
            onSelect={() => onTabChange(item.key)}
          />
        ))}
        <div style={{ height: 1, background: '#eef1f5', margin: '11px 6px 7px' }} />
        <button
          type="button"
          data-testid="account-logout"
          onClick={() => void onSignOut()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            width: '100%',
            padding: '9px 12px',
            borderRadius: 11,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            color: '#e5484d',
            whiteSpace: 'nowrap',
            border: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </span>
          {t.logout}
        </button>
      </div>
    </aside>
  );
}
