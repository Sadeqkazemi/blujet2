import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import {
  cancelPriceLock,
  deleteMyAccount,
  fetchClubMembership,
  fetchClubPoints,
  fetchMyBookings,
  fetchMyPriceLocks,
  fetchMyProfile,
  fetchMySessions,
  fetchPrivacyExport,
  fetchSavedFlights,
  fetchSavedPassengers,
  createSavedPassenger,
  updateSavedPassenger,
  removeSavedPassenger,
  fetchBankAccounts,
  createBankAccount,
  updateBankAccount,
  removeBankAccount,
  fetchMyReferral,
  fetchMyIdentity,
  uploadIdentityIdCard,
  submitIdentityVerification,
  revokeMySession,
  fetchWallet,
  removeSavedFlight,
  requestEmailVerify,
  topupWallet,
  updateMyProfile,
  verifyEmail,
} from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { fetchMySupportTickets } from '../../api/support-tickets';
import { changeOwnPassword, setPassword } from '../../api/auth';
import { faDigits, faMoney, parseTomanToRial } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { BookingDetail, PriceLock, SavedFlight, SavedPassenger, SavedBankAccount, CustomerReferralDashboard, CustomerIdentityView, ActiveSession, UserProfile } from '../../types/public-site';
import AccountSecuritySessions from './AccountSecuritySessions';
import type { ClubMembershipView } from '../../types/club-membership';
import type { MySupportTicketRow, SupportTicketStatus } from '../../types/support-tickets';
import AccountClubTab from './AccountClubTab';
import AccountSavedFlightsTab from './AccountSavedFlightsTab';
import AccountPassengersTab, { type SavedPassengerForm } from './AccountPassengersTab';
import AccountBankAccountsTab, { type BankAccountForm } from './AccountBankAccountsTab';
import AccountReferralTab from './AccountReferralTab';
import AccountIdentityTab from './AccountIdentityTab';
import AccountProfileSavedPax from './AccountProfileSavedPax';
import AccountRefundsTab from './AccountRefundsTab';

// پنل کاربر — real data from the existing bookings/wallet/club-points/refunds
// endpoints (none of this is mock). Matches design-reference/پنل کاربر.dc.html's
// scope: سفرها، کیف پول، امتیاز باشگاه، مسافران، استردادها.
// EN strings mostly extracted from the design bundle's own isEN ternaries
// (rich coverage for this page); AR is a mix of the design's own isAR
// branches where they exist and fresh hand-translation elsewhere — this
// page's own «قفل قیمت» (price lock) tab has no design counterpart at all,
// so its strings are hand-translated to match the real feature.

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

type StatusEntry = { label: Tr; bg: string; color: string };

const STATUS_LABEL: Record<string, StatusEntry> = {
  DRAFT: { label: { fa: 'پیش‌نویس', en: 'Draft', ar: 'مسودة' }, bg: '#f1f4f8', color: '#5a6678' },
  HELD: { label: { fa: 'در انتظار پرداخت', en: 'Awaiting Payment', ar: 'بانتظار الدفع' }, bg: '#fff7e6', color: '#9a7d22' },
  PAID: { label: { fa: 'پرداخت‌شده', en: 'Paid', ar: 'مدفوع' }, bg: '#eef4fb', color: '#1668c4' },
  TICKETED: { label: { fa: 'صادر شده', en: 'Ticketed', ar: 'تم إصدار التذكرة' }, bg: '#e8f5ee', color: '#1f8a5b' },
  CANCELLED: { label: { fa: 'لغو شده', en: 'Cancelled', ar: 'ملغى' }, bg: '#f1f4f8', color: '#8a96a6' },
  EXPIRED: { label: { fa: 'منقضی شده', en: 'Expired', ar: 'منتهي الصلاحية' }, bg: '#fbf0ef', color: '#d64545' },
  REFUNDED: { label: { fa: 'مسترد شده', en: 'Refunded', ar: 'تم الاسترداد' }, bg: '#f1f4f8', color: '#8a96a6' },
};

const TIER_LABEL: Record<string, Tr> = {
  SILVER: { fa: 'نقره‌ای', en: 'Silver', ar: 'فضية' },
  GOLD: { fa: 'طلایی', en: 'Gold', ar: 'ذهبية' },
  PLATINUM: { fa: 'پلاتین', en: 'Platinum', ar: 'بلاتينية' },
};

type TabKey = 'trips' | 'wallet' | 'club' | 'saved' | 'price-locks' | 'passengers' | 'refunds' | 'tickets' | 'security' | 'banks' | 'referral' | 'identity' | 'profile';

const TAB_LABEL: Record<TabKey, Tr> = {
  profile: { fa: 'پروفایل من', en: 'My Profile', ar: 'ملفي الشخصي' },
  trips: { fa: 'سفرها', en: 'Trips', ar: 'رحلاتي' },
  wallet: { fa: 'کیف پول', en: 'Wallet', ar: 'المحفظة' },
  club: { fa: 'باشگاه مشتریان', en: 'Loyalty Club', ar: 'نادي الولاء' },
  saved: { fa: 'نشان‌شده‌ها', en: 'Saved', ar: 'المحفوظة' },
  'price-locks': { fa: 'قفل قیمت', en: 'Price Lock', ar: 'قفل السعر' },
  passengers: { fa: 'مسافران', en: 'Passengers', ar: 'المسافرون' },
  refunds: { fa: 'استرداد‌ها', en: 'Refunds', ar: 'الاستردادات' },
  tickets: { fa: 'پیام به پشتیبانی', en: 'Message Support', ar: 'رسالة للدعم' },
  security: { fa: 'امنیت حساب', en: 'Account Security', ar: 'أمان الحساب' },
  banks: { fa: 'حساب‌های بانکی', en: 'Bank Accounts', ar: 'الحسابات البنكية' },
  referral: { fa: 'معرفی دوستان', en: 'Invite Friends', ar: 'دعوة الأصدقاء' },
  identity: { fa: 'احراز هویت', en: 'Identity Verification', ar: 'التحقق من الهوية' },
};

const PRIMARY_TABS: { key: TabKey; icon: string }[] = [
  { key: 'trips', icon: '🧳' },
  { key: 'wallet', icon: '💳' },
  { key: 'club', icon: '★' },
  { key: 'saved', icon: '🔖' },
  { key: 'price-locks', icon: '🔒' },
];

const ACCOUNT_TABS: { key: TabKey; icon: string }[] = [
  { key: 'profile', icon: '🪪' },
  { key: 'passengers', icon: '👤' },
  { key: 'refunds', icon: '↺' },
  { key: 'tickets', icon: '💬' },
  { key: 'security', icon: '🛡️' },
  { key: 'banks', icon: '🏦' },
  { key: 'referral', icon: '🎁' },
  { key: 'identity', icon: '🛡️' },
];

const TABS: { key: TabKey; icon: string }[] = [...PRIMARY_TABS, ...ACCOUNT_TABS];

const TICKET_STATUS_LABEL: Record<SupportTicketStatus, Tr> = {
  OPEN: { fa: 'باز', en: 'Open', ar: 'مفتوح' },
  IN_PROGRESS: { fa: 'در حال بررسی', en: 'In Progress', ar: 'قيد المعالجة' },
  ANSWERED: { fa: 'پاسخ داده‌شده', en: 'Answered', ar: 'تم الرد' },
  CLOSED: { fa: 'بسته‌شده', en: 'Closed', ar: 'مغلق' },
};

const CABIN_LABEL: Record<string, Tr> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

const LOCK_STATUS_LABEL: Record<string, StatusEntry> = {
  ACTIVE: { label: { fa: 'فعال', en: 'Active', ar: 'نشط' }, bg: '#e8f5ee', color: '#1f8a5b' },
  USED: { label: { fa: 'استفاده‌شده', en: 'Used', ar: 'مُستخدَم' }, bg: '#eef4fb', color: '#1668c4' },
  CANCELLED: { label: { fa: 'لغو شده', en: 'Cancelled', ar: 'ملغى' }, bg: '#f1f4f8', color: '#8a96a6' },
};

const STR: Record<StoredLocale, {
  defaultUserName: string;
  memberPrefix: string;
  loading: string;
  toman: string;
  // profile
  completionLabel: string;
  accountInfoHeading: string;
  fullNameLabel: string;
  nationalIdLabel: string;
  passportLabel: string;
  saveButton: string;
  savingButton: string;
  saveSuccess: string;
  saveErrorFallback: string;
  emailHeading: string;
  emailNotSet: string;
  emailVerifiedTag: string;
  sendVerifyCodeBtn: string;
  verifyCodeErrorFallback: string;
  codeLabel: string;
  verifyBtn: string;
  verifyCodeIncomplete: string;
  verifyCodeWrongFallback: string;
  emailVerifiedSuccess: string;
  emailVerifyRequestNotice: string;
  privacyHeading: string;
  privacyDesc: string;
  exportBtn: string;
  exportBusyBtn: string;
  exportErrorFallback: string;
  deleteHeading: string;
  deleteWarning: string;
  deleteConfirmBtn: string;
  deleteBusyBtn: string;
  deleteCancelBtn: string;
  deleteErrorFallback: string;
  bannerText: (pct: string) => string;
  bannerCompleteBtn: string;
  bannerLaterBtn: string;
  // trips
  tripsEmptyText: string;
  searchFlightLink: string;
  pnrLabel: string;
  priceLockedBadge: string;
  viewTicketLink: string;
  // wallet
  walletBalanceHeading: string;
  topupAmountLabel: string;
  topupPlaceholder: string;
  topupSubmit: string;
  topupAmountInvalid: string;
  topupErrorFallback: string;
  // points
  currentPointsLabel: string;
  pointsTierPrefix: string;
  viewClubLink: string;
  notMemberText: string;
  joinFreeBtn: string;
  // price-locks
  locksEmptyText: string;
  lockedRatePrefix: string;
  feePrefix: string;
  validUntilPrefix: string;
  validUntilSuffix: string;
  cancelBtn: string;
  cancelBusyBtn: string;
  cancelErrorFallback: string;
  // passengers
  passengersEmptyText: string;
  // refunds
  refundsEmptyText: string;
  refundableAmountPrefix: string;
  penaltyPrefix: string;
  penaltySuffix: string;
  // tickets
  ticketsEmptyText: string;
  ticketsNewLink: string;
  ticketsTrackingLabel: string;
  ticketsHistoryHeading: string;
  ticketsLoadError: string;
  // security
  securityHeading: string;
  securitySub: string;
  currentPasswordLabel: string;
  currentPasswordHint: string;
  newPasswordLabel: string;
  confirmPasswordLabel: string;
  savePasswordBtn: string;
  savingPasswordBtn: string;
  passwordSaved: string;
  passwordErrorFallback: string;
  passwordMismatch: string;
  passwordTooShort: string;
  sidebarPointsLabel: string;
  sidebarWalletLink: string;
  sidebarLogout: string;
}> = {
  fa: {
    defaultUserName: 'کاربر',
    memberPrefix: '★ عضو ',
    loading: 'در حال بارگذاری…',
    toman: 'تومان',
    completionLabel: 'تکمیل پروفایل',
    accountInfoHeading: 'اطلاعات حساب',
    fullNameLabel: 'نام و نام خانوادگی',
    nationalIdLabel: 'کد ملی',
    passportLabel: 'شماره گذرنامه',
    saveButton: 'ذخیره اطلاعات',
    savingButton: 'در حال ذخیره…',
    saveSuccess: 'اطلاعات پروفایل ذخیره شد ✓',
    saveErrorFallback: 'خطا در ذخیره اطلاعات.',
    emailHeading: 'ایمیل',
    emailNotSet: 'ایمیلی ثبت نشده است.',
    emailVerifiedTag: '· تأیید شده',
    sendVerifyCodeBtn: 'ارسال کد تأیید',
    verifyCodeErrorFallback: 'خطا در ارسال کد تأیید.',
    codeLabel: 'کد تأیید',
    verifyBtn: 'تأیید',
    verifyCodeIncomplete: 'کد ۶ رقمی را کامل وارد کنید.',
    verifyCodeWrongFallback: 'کد وارد شده نادرست است.',
    emailVerifiedSuccess: 'ایمیل شما تأیید شد ✓',
    emailVerifyRequestNotice: 'کد تأیید به ایمیل شما ارسال شد.',
    privacyHeading: 'حریم خصوصی و داده‌های من',
    privacyDesc: 'می‌توانید خروجی کامل اطلاعات شخصی خود (سفرها، مسافران، کیف پول، استرداد‌ها) را دریافت کنید یا حساب کاربری خود را برای همیشه حذف کنید.',
    exportBtn: 'دانلود اطلاعات من',
    exportBusyBtn: 'در حال آماده‌سازی…',
    exportErrorFallback: 'خطا در دریافت اطلاعات.',
    deleteHeading: 'حذف حساب کاربری',
    deleteWarning: 'این عملیات غیرقابل بازگشت است. حساب شما غیرفعال می‌شود، اطلاعات هویتی مسافران شما حذف/ناشناس می‌شود و تمام نشست‌های فعال شما بسته خواهد شد.',
    deleteConfirmBtn: 'بله، حساب من حذف شود',
    deleteBusyBtn: 'در حال حذف…',
    deleteCancelBtn: 'انصراف',
    deleteErrorFallback: 'خطا در حذف حساب کاربری.',
    bannerText: (pct) => `پروفایل شما ${pct}٪ تکمیل شده است. برای تکمیل، اطلاعات هویتی خود را وارد کنید.`,
    bannerCompleteBtn: 'تکمیل پروفایل',
    bannerLaterBtn: 'بعداً',
    tripsEmptyText: 'هنوز سفری ثبت نکرده‌اید.',
    searchFlightLink: 'جستجوی پرواز',
    pnrLabel: 'کد رزرو',
    priceLockedBadge: '🔒 قیمت قفل‌شده',
    viewTicketLink: 'مشاهده بلیط',
    walletBalanceHeading: 'موجودی کیف پول',
    topupAmountLabel: 'مبلغ شارژ (تومان)',
    topupPlaceholder: 'مثلاً ۵۰۰۰۰۰',
    topupSubmit: 'شارژ کیف پول',
    topupAmountInvalid: 'مبلغ معتبر وارد کنید.',
    topupErrorFallback: 'خطا در شارژ کیف پول.',
    currentPointsLabel: 'امتیاز فعلی شما',
    pointsTierPrefix: '★ سطح ',
    viewClubLink: 'مشاهده شرایط و سطوح باشگاه ←',
    notMemberText: 'هنوز عضو باشگاه مشتریان نیستید.',
    joinFreeBtn: 'عضویت رایگان',
    locksEmptyText: 'هنوز قفل قیمتی ثبت نکرده‌اید. در نتایج جستجوی پرواز، روی «🔒 قفل قیمت» بزنید (ویژه اعضای طلایی و بالاتر باشگاه مشتریان).',
    lockedRatePrefix: 'نرخ قفل‌شده: ',
    feePrefix: ' · کارمزد: ',
    validUntilPrefix: 'تا ',
    validUntilSuffix: ' معتبر است',
    cancelBtn: 'لغو',
    cancelBusyBtn: 'در حال لغو…',
    cancelErrorFallback: 'خطا در لغو قفل قیمت.',
    passengersEmptyText: 'مسافری ثبت نشده است.',
    refundsEmptyText: 'درخواست استردادی ثبت نشده است.',
    refundableAmountPrefix: 'مبلغ قابل استرداد: ',
    penaltyPrefix: 'جریمه ',
    penaltySuffix: '٪',
    ticketsEmptyText: 'هنوز تیکتی ثبت نکرده‌اید.',
    ticketsNewLink: 'ارسال پیام جدید به پشتیبانی',
    ticketsTrackingLabel: 'کد پیگیری',
    ticketsHistoryHeading: 'رویدادها',
    ticketsLoadError: 'خطا در دریافت تیکت‌ها.',
    securityHeading: 'تغییر رمز عبور',
    securitySub: 'برای امنیت بیشتر، رمز عبور خود را دوره‌ای تغییر دهید. اگر فقط با OTP وارد می‌شوید، فیلد رمز فعلی را خالی بگذارید.',
    currentPasswordLabel: 'رمز عبور فعلی',
    currentPasswordHint: '(اختیاری — فقط ورود با OTP)',
    newPasswordLabel: 'رمز عبور جدید',
    confirmPasswordLabel: 'تکرار رمز عبور جدید',
    savePasswordBtn: 'ثبت رمز عبور جدید',
    savingPasswordBtn: 'در حال ذخیره…',
    passwordSaved: 'رمز عبور با موفقیت تغییر کرد ✓',
    passwordErrorFallback: 'خطا در تغییر رمز عبور.',
    passwordMismatch: 'تکرار رمز عبور جدید مطابقت ندارد.',
    passwordTooShort: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.',
    sidebarPointsLabel: 'امتیاز باشگاه',
    sidebarWalletLink: 'کیف پول ›',
    sidebarLogout: 'خروج از حساب',
  },
  en: {
    defaultUserName: 'User',
    memberPrefix: '★ Member ',
    loading: 'Loading…',
    toman: 'Toman',
    completionLabel: 'Profile Completion',
    accountInfoHeading: 'Account Information',
    fullNameLabel: 'Full Name',
    nationalIdLabel: 'National ID',
    passportLabel: 'Passport Number',
    saveButton: 'Save Info',
    savingButton: 'Saving…',
    saveSuccess: 'Profile info saved ✓',
    saveErrorFallback: 'Error saving info.',
    emailHeading: 'Email',
    emailNotSet: 'No email on file.',
    emailVerifiedTag: '· Verified',
    sendVerifyCodeBtn: 'Send Verification Code',
    verifyCodeErrorFallback: 'Error sending the verification code.',
    codeLabel: 'Verification Code',
    verifyBtn: 'Verify',
    verifyCodeIncomplete: 'Enter the full 6-digit code.',
    verifyCodeWrongFallback: 'The code entered is incorrect.',
    emailVerifiedSuccess: 'Your email has been verified ✓',
    emailVerifyRequestNotice: 'A verification code was sent to your email.',
    privacyHeading: 'Privacy & My Data',
    privacyDesc: 'You can download a full export of your personal data (trips, passengers, wallet, refunds) or permanently delete your account.',
    exportBtn: 'Download My Data',
    exportBusyBtn: 'Preparing…',
    exportErrorFallback: 'Error fetching your data.',
    deleteHeading: 'Delete Account',
    deleteWarning: 'This action is irreversible. Your account will be deactivated, your passengers’ identity data will be deleted/anonymized, and all your active sessions will be closed.',
    deleteConfirmBtn: 'Yes, delete my account',
    deleteBusyBtn: 'Deleting…',
    deleteCancelBtn: 'Cancel',
    deleteErrorFallback: 'Error deleting your account.',
    bannerText: (pct) => `Your profile is ${pct}% complete. Enter your identity info to finish it.`,
    bannerCompleteBtn: 'Complete Profile',
    bannerLaterBtn: 'Later',
    tripsEmptyText: "You haven't booked any trips yet.",
    searchFlightLink: 'Search Flights',
    pnrLabel: 'PNR',
    priceLockedBadge: '🔒 Price Locked',
    viewTicketLink: 'View Ticket',
    walletBalanceHeading: 'Wallet Balance',
    topupAmountLabel: 'Top-Up Amount (Toman)',
    topupPlaceholder: 'e.g. 500000',
    topupSubmit: 'Top Up Wallet',
    topupAmountInvalid: 'Enter a valid amount.',
    topupErrorFallback: 'Error topping up the wallet.',
    currentPointsLabel: 'Your Current Points',
    pointsTierPrefix: '★ Tier ',
    viewClubLink: 'View club tiers & terms ←',
    notMemberText: "You're not a loyalty club member yet.",
    joinFreeBtn: 'Join for Free',
    locksEmptyText: 'You haven’t locked any prices yet. On the flight results page, click “🔒 Price Lock” (available to Gold-tier club members and above).',
    lockedRatePrefix: 'Locked rate: ',
    feePrefix: ' · Fee: ',
    validUntilPrefix: 'Valid until ',
    validUntilSuffix: '',
    cancelBtn: 'Cancel',
    cancelBusyBtn: 'Cancelling…',
    cancelErrorFallback: 'Error cancelling the price lock.',
    passengersEmptyText: 'No passengers on file.',
    refundsEmptyText: 'No refund requests on file.',
    refundableAmountPrefix: 'Refundable amount: ',
    penaltyPrefix: '',
    penaltySuffix: '% penalty',
    ticketsEmptyText: 'You have not submitted any support tickets yet.',
    ticketsNewLink: 'Send a new message to support',
    ticketsTrackingLabel: 'Tracking code',
    ticketsHistoryHeading: 'Timeline',
    ticketsLoadError: 'Error loading tickets.',
    securityHeading: 'Change Password',
    securitySub: 'Change your password periodically for extra security. If you only sign in with OTP, leave the current password field empty.',
    currentPasswordLabel: 'Current password',
    currentPasswordHint: '(optional — OTP-only login)',
    newPasswordLabel: 'New password',
    confirmPasswordLabel: 'Confirm new password',
    savePasswordBtn: 'Save new password',
    savingPasswordBtn: 'Saving…',
    passwordSaved: 'Password changed successfully ✓',
    passwordErrorFallback: 'Error changing password.',
    passwordMismatch: 'New password confirmation does not match.',
    passwordTooShort: 'New password must be at least 6 characters.',
    sidebarPointsLabel: 'Loyalty Points',
    sidebarWalletLink: 'Wallet ›',
    sidebarLogout: 'Sign Out',
  },
  ar: {
    defaultUserName: 'مستخدم',
    memberPrefix: '★ عضو ',
    loading: 'جارٍ التحميل…',
    toman: 'تومان',
    completionLabel: 'تكامل الملف الشخصي',
    accountInfoHeading: 'معلومات الحساب',
    fullNameLabel: 'الاسم الكامل',
    nationalIdLabel: 'الرقم الوطني',
    passportLabel: 'رقم جواز السفر',
    saveButton: 'حفظ المعلومات',
    savingButton: 'جارٍ الحفظ…',
    saveSuccess: 'تم حفظ معلومات الملف الشخصي ✓',
    saveErrorFallback: 'خطأ في حفظ المعلومات.',
    emailHeading: 'البريد الإلكتروني',
    emailNotSet: 'لا يوجد بريد إلكتروني مسجّل.',
    emailVerifiedTag: '· تم التحقق',
    sendVerifyCodeBtn: 'إرسال رمز التحقق',
    verifyCodeErrorFallback: 'خطأ في إرسال رمز التحقق.',
    codeLabel: 'رمز التحقق',
    verifyBtn: 'تحقق',
    verifyCodeIncomplete: 'أدخل الرمز المكوّن من ٦ أرقام كاملاً.',
    verifyCodeWrongFallback: 'الرمز المُدخل غير صحيح.',
    emailVerifiedSuccess: 'تم التحقق من بريدك الإلكتروني ✓',
    emailVerifyRequestNotice: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.',
    privacyHeading: 'الخصوصية وبياناتي',
    privacyDesc: 'يمكنك تنزيل نسخة كاملة من بياناتك الشخصية (الرحلات، المسافرون، المحفظة، الاستردادات) أو حذف حسابك نهائيًا.',
    exportBtn: 'تنزيل بياناتي',
    exportBusyBtn: 'جارٍ التحضير…',
    exportErrorFallback: 'خطأ في جلب بياناتك.',
    deleteHeading: 'حذف الحساب',
    deleteWarning: 'هذا الإجراء لا رجعة فيه. سيتم إلغاء تفعيل حسابك، وحذف/إخفاء هوية بيانات المسافرين، وإغلاق جميع جلساتك النشطة.',
    deleteConfirmBtn: 'نعم، احذف حسابي',
    deleteBusyBtn: 'جارٍ الحذف…',
    deleteCancelBtn: 'إلغاء',
    deleteErrorFallback: 'خطأ في حذف حسابك.',
    bannerText: (pct) => `ملفك الشخصي مكتمل بنسبة ${pct}٪. أدخل معلومات هويتك لإكماله.`,
    bannerCompleteBtn: 'إكمال الملف الشخصي',
    bannerLaterBtn: 'لاحقًا',
    tripsEmptyText: 'لم تحجز أي رحلة بعد.',
    searchFlightLink: 'البحث عن رحلة',
    pnrLabel: 'رمز الحجز',
    priceLockedBadge: '🔒 السعر مقفل',
    viewTicketLink: 'عرض التذكرة',
    walletBalanceHeading: 'رصيد المحفظة',
    topupAmountLabel: 'مبلغ الشحن (تومان)',
    topupPlaceholder: 'مثلاً ٥٠٠٠٠٠',
    topupSubmit: 'شحن المحفظة',
    topupAmountInvalid: 'أدخل مبلغًا صحيحًا.',
    topupErrorFallback: 'خطأ في شحن المحفظة.',
    currentPointsLabel: 'نقاطك الحالية',
    pointsTierPrefix: '★ المستوى ',
    viewClubLink: 'عرض شروط ومستويات النادي ←',
    notMemberText: 'لست عضوًا في نادي العملاء بعد.',
    joinFreeBtn: 'انضمام مجاني',
    locksEmptyText: 'لم تُقفل أي سعر بعد. في صفحة نتائج البحث عن الرحلات، اضغط “🔒 قفل السعر” (متاح لأعضاء المستوى الذهبي فما فوق).',
    lockedRatePrefix: 'السعر المقفل: ',
    feePrefix: ' · الرسوم: ',
    validUntilPrefix: 'صالح حتى ',
    validUntilSuffix: '',
    cancelBtn: 'إلغاء',
    cancelBusyBtn: 'جارٍ الإلغاء…',
    cancelErrorFallback: 'خطأ في إلغاء قفل السعر.',
    passengersEmptyText: 'لا يوجد مسافرون مسجّلون.',
    refundsEmptyText: 'لا توجد طلبات استرداد مسجّلة.',
    refundableAmountPrefix: 'المبلغ القابل للاسترداد: ',
    penaltyPrefix: '',
    penaltySuffix: '٪ جزاء',
    ticketsEmptyText: 'لم تُقدّم أي تذكرة دعم بعد.',
    ticketsNewLink: 'إرسال رسالة جديدة للدعم',
    ticketsTrackingLabel: 'رمز التتبع',
    ticketsHistoryHeading: 'الأحداث',
    ticketsLoadError: 'خطأ في تحميل التذاكر.',
    securityHeading: 'تغيير كلمة المرور',
    securitySub: 'غيّر كلمة مرورك بشكل دوري لمزيد من الأمان. إذا كنت تدخل فقط برمز OTP، اترك حقل كلمة المرور الحالية فارغاً.',
    currentPasswordLabel: 'كلمة المرور الحالية',
    currentPasswordHint: '(اختياري — دخول OTP فقط)',
    newPasswordLabel: 'كلمة المرور الجديدة',
    confirmPasswordLabel: 'تأكيد كلمة المرور الجديدة',
    savePasswordBtn: 'حفظ كلمة المرور الجديدة',
    savingPasswordBtn: 'جارٍ الحفظ…',
    passwordSaved: 'تم تغيير كلمة المرور بنجاح ✓',
    passwordErrorFallback: 'خطأ في تغيير كلمة المرور.',
    passwordMismatch: 'تأكيد كلمة المرور الجديدة غير متطابق.',
    passwordTooShort: 'يجب أن تكون كلمة المرور الجديدة ٦ أحرف على الأقل.',
    sidebarPointsLabel: 'نقاط النادي',
    sidebarWalletLink: 'المحفظة ›',
    sidebarLogout: 'تسجيل الخروج',
  },
};

export default function AccountPage() {
  const { status, user, signOut } = useAuth();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('trips');
  const [bookings, setBookings] = useState<BookingDetail[] | null>(null);
  const [wallet, setWallet] = useState<{ balanceIrr: string } | null>(null);
  const [club, setClub] = useState<{ isMember: boolean; level: string | null; balance: number } | null>(null);
  const [clubMembership, setClubMembership] = useState<ClubMembershipView | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLocks, setPriceLocks] = useState<PriceLock[] | null>(null);
  const [savedFlights, setSavedFlights] = useState<SavedFlight[] | null>(null);
  const [savedBusyId, setSavedBusyId] = useState<string | null>(null);
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[] | null>(null);
  const [passengerBusyId, setPassengerBusyId] = useState<string | null>(null);
  const [passengerFormBusy, setPassengerFormBusy] = useState(false);
  const [passengerFormError, setPassengerFormError] = useState<string | null>(null);
  const [passengerFormKey, setPassengerFormKey] = useState(0);
  const [passengersAddPending, setPassengersAddPending] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<SavedBankAccount[] | null>(null);
  const [bankBusyId, setBankBusyId] = useState<string | null>(null);
  const [bankFormBusy, setBankFormBusy] = useState(false);
  const [bankFormError, setBankFormError] = useState<string | null>(null);
  const [referral, setReferral] = useState<CustomerReferralDashboard | null>(null);
  const [referralCopyNotice, setReferralCopyNotice] = useState<string | null>(null);
  const [identity, setIdentity] = useState<CustomerIdentityView | null>(null);
  const [identityUploadBusy, setIdentityUploadBusy] = useState(false);
  const [identitySubmitBusy, setIdentitySubmitBusy] = useState(false);
  const [identityUploadError, setIdentityUploadError] = useState<string | null>(null);
  const [identitySubmitError, setIdentitySubmitError] = useState<string | null>(null);
  const [lockActionBusy, setLockActionBusy] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

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
  const [tickets, setTickets] = useState<MySupportTicketRow[] | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [pwCur, setPwCur] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/signin', { replace: true, state: { from: '/account' } });
    }
  }, [status, navigate]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchMyBookings().then(setBookings).catch(() => setBookings([]));
    fetchWallet().then(setWallet).catch(() => setWallet({ balanceIrr: '0' }));
    fetchClubPoints().then(setClub).catch(() => setClub(null));
    fetchClubMembership().then(setClubMembership).catch(() => setClubMembership(null));
    fetchMyPriceLocks().then(setPriceLocks).catch(() => setPriceLocks([]));
    fetchSavedFlights().then(setSavedFlights).catch(() => setSavedFlights([]));
    fetchSavedPassengers().then(setSavedPassengers).catch(() => setSavedPassengers([]));
    fetchMySessions().then(setSessions).catch(() => setSessions([]));
    fetchBankAccounts().then(setBankAccounts).catch(() => setBankAccounts([]));
    fetchMyReferral().then(setReferral).catch(() => setReferral(null));
    fetchMyIdentity().then(setIdentity).catch(() => setIdentity(null));
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
    fetchMySupportTickets()
      .then(setTickets)
      .catch(() => {
        setTickets([]);
        setTicketsError(STR.fa.ticketsLoadError);
      });
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
      setProfileNotice(t.saveSuccess);
    } catch (err) {
      setProfileError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
    } finally {
      setProfileSaving(false);
    }
  }

  async function onRequestEmailVerify() {
    setProfileError(null);
    try {
      const { challengeId } = await requestEmailVerify();
      setEmailChallengeId(challengeId);
      setProfileNotice(t.emailVerifyRequestNotice);
    } catch (err) {
      setProfileError(err instanceof ApiRequestError ? err.message : t.verifyCodeErrorFallback);
    }
  }

  async function onVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailChallengeId || emailCode.trim().length !== 6) {
      setProfileError(t.verifyCodeIncomplete);
      return;
    }
    setProfileError(null);
    try {
      await verifyEmail(emailChallengeId, emailCode.trim());
      setEmailChallengeId(null);
      setEmailCode('');
      const updated = await fetchMyProfile();
      setProfile(updated);
      setProfileNotice(t.emailVerifiedSuccess);
    } catch (err) {
      setProfileError(err instanceof ApiRequestError ? err.message : t.verifyCodeWrongFallback);
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
      setExportError(err instanceof ApiRequestError ? err.message : t.exportErrorFallback);
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
      setDeleteError(err instanceof ApiRequestError ? err.message : t.deleteErrorFallback);
      setDeleteBusy(false);
    }
  }

  async function onTopup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountRial = parseTomanToRial(topupAmount);
    if (!amountRial || amountRial <= 0) {
      setError(t.topupAmountInvalid);
      return;
    }
    setTopupBusy(true);
    try {
      const result = await topupWallet(amountRial);
      setWallet(result);
      setTopupAmount('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.topupErrorFallback);
    } finally {
      setTopupBusy(false);
    }
  }

  async function onRemoveSaved(id: string) {
    setSavedBusyId(id);
    try {
      await removeSavedFlight(id);
      setSavedFlights((prev) => (prev ? prev.filter((f) => f.id !== id) : prev));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
    } finally {
      setSavedBusyId(null);
    }
  }

  async function onRemovePassenger(id: string) {
    setPassengerBusyId(id);
    try {
      await removeSavedPassenger(id);
      setSavedPassengers((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
    } finally {
      setPassengerBusyId(null);
    }
  }

  async function onRevokeSession(id: string) {
    setSessionError(null);
    setSessionBusyId(id);
    try {
      await revokeMySession(id);
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    } catch (err) {
      setSessionError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
    } finally {
      setSessionBusyId(null);
    }
  }

  async function onRemoveBankAccount(id: string) {
    setBankBusyId(id);
    try {
      await removeBankAccount(id);
      setBankAccounts((prev) => {
        if (!prev) return prev;
        const next = prev.filter((a) => a.id !== id);
        if (next.length > 0 && !next.some((a) => a.isDefault)) {
          return next.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
    } finally {
      setBankBusyId(null);
    }
  }

  async function onSetDefaultBankAccount(id: string) {
    setBankBusyId(id);
    try {
      const updated = await updateBankAccount(id, { isDefault: true });
      setBankAccounts((prev) =>
        prev
          ? prev.map((a) =>
              a.id === updated.id ? updated : { ...a, isDefault: false },
            )
          : prev,
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
    } finally {
      setBankBusyId(null);
    }
  }

  async function onCreateBankAccount(form: BankAccountForm) {
    setBankFormError(null);
    setBankFormBusy(true);
    try {
      const created = await createBankAccount(form);
      setBankAccounts((prev) => (prev ? [created, ...prev] : [created]));
    } catch (err) {
      setBankFormError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
      throw err;
    } finally {
      setBankFormBusy(false);
    }
  }

  function onCopyReferralCode() {
    if (!referral) return;
    void navigator.clipboard.writeText(referral.referralCode).then(() => {
      setReferralCopyNotice(
        locale === 'fa'
          ? 'کد معرف کپی شد ✓'
          : locale === 'en'
            ? 'Referral code copied ✓'
            : 'تم نسخ رمز الإحالة ✓',
      );
      window.setTimeout(() => setReferralCopyNotice(null), 2500);
    });
  }

  function onShareReferralLink() {
    if (!referral) return;
    const url = `${window.location.origin}${referral.sharePath}`;
    if (navigator.share) {
      void navigator.share({ title: 'blujet', url }).catch(() => undefined);
    } else {
      void navigator.clipboard.writeText(url);
      setReferralCopyNotice(
        locale === 'fa'
          ? 'لینک دعوت کپی شد ✓'
          : locale === 'en'
            ? 'Invite link copied ✓'
            : 'تم نسخ رابط الدعوة ✓',
      );
      window.setTimeout(() => setReferralCopyNotice(null), 2500);
    }
  }

  async function onUploadIdentityIdCard(file: File) {
    setIdentityUploadError(null);
    setIdentityUploadBusy(true);
    try {
      await uploadIdentityIdCard(file);
      setIdentity(await fetchMyIdentity());
    } catch (err) {
      setIdentityUploadError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
      throw err;
    } finally {
      setIdentityUploadBusy(false);
    }
  }

  async function onSubmitIdentity() {
    setIdentitySubmitError(null);
    setIdentitySubmitBusy(true);
    try {
      setIdentity(await submitIdentityVerification());
    } catch (err) {
      setIdentitySubmitError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
      throw err;
    } finally {
      setIdentitySubmitBusy(false);
    }
  }

  async function onSavePassenger(form: SavedPassengerForm, editingId: string | null) {
    setPassengerFormError(null);
    setPassengerFormBusy(true);
    try {
      const dto = {
        fullName: form.fullName.trim(),
        latinName: form.latinName.trim(),
        nationalId: form.nationalId.trim() || undefined,
        passportNo: form.passportNo.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        isChild: form.isChild,
      };
      if (editingId) {
        const updated = await updateSavedPassenger(editingId, dto);
        setSavedPassengers((prev) =>
          prev ? prev.map((p) => (p.id === editingId ? updated : p)) : prev,
        );
      } else {
        const created = await createSavedPassenger(dto);
        setSavedPassengers((prev) => (prev ? [created, ...prev] : [created]));
      }
      setPassengerFormKey((k) => k + 1);
    } catch (err) {
      setPassengerFormError(err instanceof ApiRequestError ? err.message : t.saveErrorFallback);
      throw err;
    } finally {
      setPassengerFormBusy(false);
    }
  }

  async function onCancelLock(id: string) {
    setLockError(null);
    setLockActionBusy(id);
    try {
      const updated = await cancelPriceLock(id);
      setPriceLocks((prev) => (prev ? prev.map((l) => (l.id === id ? updated : l)) : prev));
    } catch (err) {
      setLockError(err instanceof ApiRequestError ? err.message : t.cancelErrorFallback);
    } finally {
      setLockActionBusy(null);
    }
  }

  async function onSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwNotice(null);
    if (pwNew.length < 6) {
      setPwError(t.passwordTooShort);
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError(t.passwordMismatch);
      return;
    }
    setPwSaving(true);
    try {
      if (pwCur.trim()) {
        await changeOwnPassword(pwCur, pwNew);
      } else {
        await setPassword(pwNew);
      }
      setPwNotice(t.passwordSaved);
      setPwCur('');
      setPwNew('');
      setPwConfirm('');
    } catch (err) {
      setPwError(err instanceof ApiRequestError ? err.message : t.passwordErrorFallback);
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <PublicPageShell>
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '20px 22px 44px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : locale === 'en' ? '290px 1fr' : '262px 1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <aside
          style={{
            position: isMobile ? 'static' : 'sticky',
            top: isMobile ? undefined : 86,
            alignSelf: 'start',
            background: '#fff',
            border: '1px solid #e9eef4',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 20px 44px -32px rgba(13,38,102,.55)',
          }}
        >
          <div style={{ padding: '16px 15px 15px', background: 'linear-gradient(150deg,#123a62 0%,#0c243d 100%)', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#ffffff2e,#ffffff0f)', border: '1.5px solid #ffffff59', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-9 2.69-9 6v2h18v-2c0-3.31-3.67-6-9-6z" /></svg>
              </div>
              <div style={{ minWidth: 0, lineHeight: 1.4 }}>
                <div style={{ fontSize: '15.5px', fontWeight: 800 }}>{user?.fullName ?? t.defaultUserName}</div>
                {club?.isMember && club.level && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, fontWeight: 700, color: '#f2d98a', background: '#ffffff17', border: '1px solid #ffffff29', padding: '3px 9px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                    {t.memberPrefix}
                    {TIER_LABEL[club.level]?.[locale] ?? club.level}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff12', border: '1px solid #ffffff24', borderRadius: 12, padding: '9px 8px 9px 12px' }}>
              <div style={{ lineHeight: 1.35, minWidth: 0 }}>
                <div style={{ fontSize: '9.5px', color: '#aac4e2', whiteSpace: 'nowrap' }}>{t.sidebarPointsLabel}</div>
                <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2, whiteSpace: 'nowrap' }}>{club ? faDigits(club.balance) : '—'}</div>
              </div>
              <button
                type="button"
                onClick={() => setTab('wallet')}
                style={{ border: 'none', fontSize: 10, fontWeight: 800, color: '#0d2640', background: '#f2d98a', padding: '7px 11px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
              >
                {t.sidebarWalletLink}
              </button>
            </div>
          </div>
          <div style={{ padding: 9 }}>
            {PRIMARY_TABS.map((tb) => (
              <SidebarNavItem key={tb.key} tb={tb} active={tab === tb.key} locale={locale} onSelect={() => setTab(tb.key)} />
            ))}
            <div style={{ height: 6 }} />
            {ACCOUNT_TABS.map((tb) => (
              <SidebarNavItem key={tb.key} tb={tb} active={tab === tb.key} locale={locale} onSelect={() => setTab(tb.key)} />
            ))}
            <div style={{ height: 1, background: '#eef1f5', margin: '11px 6px 7px' }} />
            <button
              type="button"
              onClick={() => void signOut()}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 12px', borderRadius: 11, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#e5484d', fontFamily: 'inherit' }}
            >
              <span style={{ width: 20, textAlign: 'center' }}>↩</span>
              {t.sidebarLogout}
            </button>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>

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
              {t.bannerText(faDigits(profile.completionPct))}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setTab('profile')}
                style={{ border: 'none', borderRadius: 9, background: '#e7c66b', color: '#3b2f0e', padding: '7px 14px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t.bannerCompleteBtn}
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                style={{ border: 'none', background: 'transparent', color: '#8a6a1f', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t.bannerLaterBtn}
              </button>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'linear-gradient(135deg,#0d2640,#16406e)', color: '#fff', borderRadius: 18, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
                <span style={{ color: '#aac4e2' }}>{t.completionLabel}</span>
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
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{t.accountInfoHeading}</h3>
              <div>
                <label htmlFor="profile-fullName" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                  {t.fullNameLabel}
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
                  {t.nationalIdLabel}
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
                  {t.passportLabel}
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
                {profileSaving ? t.savingButton : t.saveButton}
              </button>
            </form>

            {savedPassengers && (
              <AccountProfileSavedPax
                passengers={savedPassengers}
                onAdd={() => {
                  setPassengersAddPending(true);
                  setTab('passengers');
                }}
              />
            )}

            <div style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px' }}>{t.emailHeading}</h3>
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
                      style={{ border: '1px solid #1668c4', borderRadius: 10, background: 'transparent', color: '#1668c4', padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
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
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                          style={{ width: 140, boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, textAlign: 'center', letterSpacing: 4 }}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{ border: 'none', borderRadius: 10, background: '#1668c4', color: '#fff', padding: '11px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {t.verifyBtn}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px' }}>{t.privacyHeading}</h3>
              {exportError && <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 10 }}>{exportError}</p>}
              <p style={{ fontSize: 12, color: '#5a6678', marginBottom: 12 }}>{t.privacyDesc}</p>
              <button
                type="button"
                data-testid="privacy-export-button"
                disabled={exportBusy}
                onClick={() => void onExportData()}
                style={{ border: '1px solid #1668c4', borderRadius: 10, background: 'transparent', color: '#1668c4', padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 }}
              >
                {exportBusy ? t.exportBusyBtn : t.exportBtn}
              </button>

              <div style={{ borderTop: '1px solid #f1f4f8', paddingTop: 16 }}>
                <h4 style={{ fontSize: 12.5, fontWeight: 800, color: '#e5484d', margin: '0 0 8px' }}>{t.deleteHeading}</h4>
                {!deleteConfirmOpen ? (
                  <button
                    type="button"
                    data-testid="privacy-delete-open"
                    onClick={() => setDeleteConfirmOpen(true)}
                    style={{ border: '1px solid #e5484d', borderRadius: 10, background: 'transparent', color: '#e5484d', padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {t.deleteHeading}
                  </button>
                ) : (
                  <div style={{ background: '#fef2f2', border: '1px solid #fbd0d0', borderRadius: 12, padding: '14px 16px' }}>
                    <p style={{ fontSize: 12, color: '#8a2c2c', marginBottom: 12 }}>{t.deleteWarning}</p>
                    {deleteError && <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 10 }}>{deleteError}</p>}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        data-testid="privacy-delete-confirm"
                        disabled={deleteBusy}
                        onClick={() => void onConfirmDelete()}
                        style={{ border: 'none', borderRadius: 10, background: '#e5484d', color: '#fff', padding: '9px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {deleteBusy ? t.deleteBusyBtn : t.deleteConfirmBtn}
                      </button>
                      <button
                        type="button"
                        data-testid="privacy-delete-cancel"
                        disabled={deleteBusy}
                        onClick={() => setDeleteConfirmOpen(false)}
                        style={{ border: '1px solid #e3e9f1', borderRadius: 10, background: '#fff', color: '#5a6678', padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {t.deleteCancelBtn}
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
            {bookings === null && <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>}
            {bookings?.length === 0 && (
              <div style={{ background: '#fff', border: '1px dashed #e5e9f0', borderRadius: 16, padding: 40, textAlign: 'center', color: '#8a96a6', fontSize: 13 }}>
                {t.tripsEmptyText}{' '}
                <Link to="/" style={{ color: '#1668c4', fontWeight: 700 }}>
                  {t.searchFlightLink}
                </Link>
              </div>
            )}
            {bookings?.map((b) => {
              const st = STATUS_LABEL[b.status] ?? { label: { fa: b.status, en: b.status, ar: b.status }, bg: '#f1f4f8', color: '#5a6678' };
              return (
                <div key={b.id} data-testid="account-trip" style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0d2640' }}>
                      {b.originCode} <span style={{ color: '#b9c2cf' }}>←</span> {b.destCode}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 4 }}>
                      {b.flightNo} · {formatJalaliDateTime(b.departureAt)} · {t.pnrLabel} <span dir="ltr">{b.pnr}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {b.isPriceLocked && (
                      <span data-testid="trip-price-locked-badge" style={{ fontSize: 10.5, fontWeight: 800, background: '#fff7e6', color: '#9a7d22', padding: '5px 12px', borderRadius: 14 }}>
                        {t.priceLockedBadge}
                      </span>
                    )}
                    <span style={{ fontSize: 10.5, fontWeight: 800, background: st.bg, color: st.color, padding: '5px 12px', borderRadius: 14 }}>{st.label[locale]}</span>
                    <Link to={b.pnr ? `/ticket/${b.pnr}` : '#'} style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
                      {t.viewTicketLink}
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
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>{t.walletBalanceHeading}</div>
              <div data-testid="wallet-balance" style={{ fontSize: 26, fontWeight: 900 }}>
                {wallet ? faMoney(wallet.balanceIrr) : '—'} <span style={{ fontSize: 12, fontWeight: 400 }}>{t.toman}</span>
              </div>
            </div>
            <form onSubmit={onTopup} style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '18px 20px', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>{t.topupAmountLabel}</label>
                <input
                  data-testid="wallet-topup-amount"
                  dir="ltr"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder={t.topupPlaceholder}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', border: '1.5px solid #e3e9f1', borderRadius: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
              <button
                type="submit"
                data-testid="wallet-topup-submit"
                disabled={topupBusy}
                style={{ border: 'none', borderRadius: 10, background: '#1668c4', color: '#fff', padding: '11px 22px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t.topupSubmit}
              </button>
            </form>
          </div>
        )}

        {tab === 'club' && (
          clubMembership === null ? (
            <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>
          ) : (
            <AccountClubTab
              membership={clubMembership}
              onMembershipChange={(m) => {
                setClubMembership(m);
                setClub({ isMember: m.isMember, level: m.level, balance: m.balance });
              }}
            />
          )
        )}

        {tab === 'saved' && (
          savedFlights === null ? (
            <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>
          ) : (
            <AccountSavedFlightsTab
              flights={savedFlights}
              busyId={savedBusyId}
              onRemove={(id) => void onRemoveSaved(id)}
            />
          )
        )}

        {tab === 'price-locks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lockError && <p role="alert" style={{ fontSize: 12, color: '#e5484d' }}>{lockError}</p>}
            {priceLocks === null && <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>}
            {priceLocks?.length === 0 && (
              <div style={{ background: '#fff', border: '1px dashed #e5e9f0', borderRadius: 16, padding: 40, textAlign: 'center', color: '#8a96a6', fontSize: 13 }}>
                {t.locksEmptyText}
              </div>
            )}
            {priceLocks?.map((l) => {
              const st = LOCK_STATUS_LABEL[l.status] ?? { label: { fa: l.status, en: l.status, ar: l.status }, bg: '#f1f4f8', color: '#5a6678' };
              return (
                <div key={l.id} data-testid="account-price-lock" style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0d2640' }}>
                      {l.flight.originCode} <span style={{ color: '#b9c2cf' }}>←</span> {l.flight.destCode}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 4 }}>
                      {l.flight.flightNo} · {formatJalaliDateTime(l.flight.departureAt)} · {CABIN_LABEL[l.cabin]?.[locale] ?? l.cabin}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#3f546b', marginTop: 4 }}>
                      {t.lockedRatePrefix}{faMoney(l.lockedPriceIrr)} {t.toman}{t.feePrefix}{faMoney(l.feeIrr)} {t.toman}
                    </div>
                    {l.status === 'ACTIVE' && (
                      <div style={{ fontSize: 11, color: '#9a7d22', marginTop: 4 }}>
                        {t.validUntilPrefix}{formatJalaliDateTime(l.expiresAt)}{t.validUntilSuffix}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, background: st.bg, color: st.color, padding: '5px 12px', borderRadius: 14 }}>{st.label[locale]}</span>
                    {l.status === 'ACTIVE' && (
                      <button
                        type="button"
                        data-testid={`cancel-price-lock-${l.id}`}
                        disabled={lockActionBusy === l.id}
                        onClick={() => void onCancelLock(l.id)}
                        style={{ border: '1px solid #e5484d', borderRadius: 10, background: 'transparent', color: '#e5484d', padding: '7px 14px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {lockActionBusy === l.id ? t.cancelBusyBtn : t.cancelBtn}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'passengers' && savedPassengers && (
          <AccountPassengersTab
            key={passengerFormKey}
            passengers={savedPassengers}
            busyId={passengerBusyId}
            formBusy={passengerFormBusy}
            formError={passengerFormError}
            openAddOnMount={passengersAddPending}
            onAddModalOpened={() => setPassengersAddPending(false)}
            onRemove={onRemovePassenger}
            onSave={onSavePassenger}
          />
        )}
        {tab === 'passengers' && savedPassengers === null && (
          <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>
        )}

        {tab === 'banks' && bankAccounts && (
          <AccountBankAccountsTab
            accounts={bankAccounts}
            busyId={bankBusyId}
            formBusy={bankFormBusy}
            formError={bankFormError}
            onRemove={onRemoveBankAccount}
            onSetDefault={onSetDefaultBankAccount}
            onCreate={onCreateBankAccount}
          />
        )}
        {tab === 'banks' && bankAccounts === null && (
          <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>
        )}

        {tab === 'referral' && referral && (
          <AccountReferralTab
            data={referral}
            copyNotice={referralCopyNotice}
            onCopy={onCopyReferralCode}
            onShare={onShareReferralLink}
          />
        )}
        {tab === 'referral' && referral === null && (
          <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>
        )}

        {tab === 'identity' && identity && (
          <AccountIdentityTab
            data={identity}
            uploadBusy={identityUploadBusy}
            submitBusy={identitySubmitBusy}
            uploadError={identityUploadError}
            submitError={identitySubmitError}
            onUpload={onUploadIdentityIdCard}
            onSubmit={onSubmitIdentity}
            onGoProfile={() => setTab('profile')}
          />
        )}
        {tab === 'identity' && identity === null && (
          <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>
        )}

        {tab === 'refunds' && <AccountRefundsTab />}

        {tab === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ticketsError && <p role="alert" style={{ fontSize: 12, color: '#e5484d' }}>{ticketsError}</p>}
            <div style={{ marginBottom: 4 }}>
              <Link to="/support" style={{ fontSize: 12.5, color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
                {t.ticketsNewLink} →
              </Link>
            </div>
            {tickets === null && <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>}
            {tickets?.length === 0 && (
              <div style={{ background: '#fff', border: '1px dashed #e5e9f0', borderRadius: 16, padding: 40, textAlign: 'center', color: '#8a96a6', fontSize: 13 }}>
                {t.ticketsEmptyText}
              </div>
            )}
            {tickets?.map((tk) => {
              const st = TICKET_STATUS_LABEL[tk.status];
              const expanded = expandedTicketId === tk.id;
              return (
                <div key={tk.id} data-testid="account-ticket" style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedTicketId(expanded ? null : tk.id)}
                    style={{ width: '100%', border: 'none', background: 'transparent', padding: '14px 16px', textAlign: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ textAlign: locale === 'en' ? 'left' : 'right' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640' }}>{tk.subject}</div>
                        <div style={{ fontSize: 11, color: '#8a96a6', marginTop: 4 }}>
                          {t.ticketsTrackingLabel}: <span className="font-num" dir="ltr">{tk.trackingCode}</span>
                          {' · '}
                          {formatJalaliDateTime(tk.createdAt)}
                        </div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, background: '#eef4fb', color: '#1668c4', padding: '5px 12px', borderRadius: 14 }}>
                        {st?.[locale] ?? tk.status}
                      </span>
                    </div>
                  </button>
                  {expanded && (
                    <div style={{ borderTop: '1px solid #eef1f5', padding: '14px 16px', background: '#fafbfd' }}>
                      <p style={{ fontSize: 12.5, color: '#3b4554', lineHeight: 1.8, margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{tk.body}</p>
                      {tk.history.length > 0 && (
                        <>
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#6b7787', marginBottom: 8 }}>{t.ticketsHistoryHeading}</div>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {tk.history.map((h, i) => (
                              <li key={`${h.step}-${i}`} style={{ fontSize: 11.5, color: '#5a6678' }}>
                                <span style={{ color: '#8a96a6' }}>{formatJalaliDateTime(h.at)}</span>
                                {' — '}
                                {h.labelFa}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>{t.securityHeading}</h3>
            <p style={{ fontSize: 11.5, color: '#8a96a6', margin: '0 0 16px', lineHeight: 1.8 }}>{t.securitySub}</p>
            <form onSubmit={(e) => void onSavePassword(e)} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <label htmlFor="acct-pw-cur" style={{ display: 'block', fontSize: 11.5, color: '#6b7787', marginBottom: 6 }}>
                  {t.currentPasswordLabel} <span style={{ fontSize: 10 }}>{t.currentPasswordHint}</span>
                </label>
                <input
                  id="acct-pw-cur"
                  type="password"
                  value={pwCur}
                  onChange={(e) => setPwCur(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: 46, border: '1.5px solid #e3e8ef', borderRadius: 12, padding: '0 14px', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label htmlFor="acct-pw-new" style={{ display: 'block', fontSize: 11.5, color: '#6b7787', marginBottom: 6 }}>{t.newPasswordLabel}</label>
                <input
                  id="acct-pw-new"
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: 46, border: '1.5px solid #e3e8ef', borderRadius: 12, padding: '0 14px', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label htmlFor="acct-pw-confirm" style={{ display: 'block', fontSize: 11.5, color: '#6b7787', marginBottom: 6 }}>{t.confirmPasswordLabel}</label>
                <input
                  id="acct-pw-confirm"
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: 46, border: '1.5px solid #e3e8ef', borderRadius: 12, padding: '0 14px', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
              {pwError && <p role="alert" style={{ fontSize: 12, color: '#e5484d' }}>{pwError}</p>}
              {pwNotice && <p style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>{pwNotice}</p>}
              <button
                type="submit"
                data-testid="account-save-password"
                disabled={pwSaving}
                style={{ marginTop: 4, height: 44, borderRadius: 11, background: '#1668c4', color: '#fff', fontSize: 12.5, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {pwSaving ? t.savingPasswordBtn : t.savePasswordBtn}
              </button>
            </form>
            </div>
            {sessionError && (
              <p role="alert" style={{ fontSize: 12, color: '#e5484d', margin: 0 }}>{sessionError}</p>
            )}
            {sessions && (
              <AccountSecuritySessions
                sessions={sessions}
                busyId={sessionBusyId}
                onRevoke={onRevokeSession}
              />
            )}
          </div>
        )}
        </main>
      </div>
    </PublicPageShell>
  );
}

function SidebarNavItem({
  tb,
  active,
  locale,
  onSelect,
}: {
  tb: { key: TabKey; icon: string };
  active: boolean;
  locale: StoredLocale;
  onSelect: () => void;
}) {
  const barSide = locale === 'en' ? 'left' : 'right';
  return (
    <button
      type="button"
      data-testid={`account-tab-${tb.key}`}
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        padding: '9px 12px',
        borderRadius: 11,
        border: 'none',
        cursor: 'pointer',
        fontSize: locale === 'en' ? 12 : 13,
        whiteSpace: 'nowrap',
        fontWeight: active ? 800 : 600,
        color: active ? '#1668c4' : '#3b4554',
        background: active ? '#eef4fb' : 'transparent',
        marginBottom: 2,
        fontFamily: 'inherit',
        textAlign: locale === 'en' ? 'left' : 'right',
      }}
    >
      <span
        style={{
          position: 'absolute',
          [barSide]: -1,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: active ? 18 : 0,
          borderRadius: 3,
          background: '#1668c4',
          transition: 'height .15s',
        }}
      />
      <span style={{ width: 20, textAlign: 'center', flex: 'none' }}>{tb.icon}</span>
      {TAB_LABEL[tb.key][locale]}
    </button>
  );
}
