import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import AccountRefundsTab from './AccountRefundsTab';
import AccountSidebar from './account/AccountSidebar';
import AccountProfileTab from './account/AccountProfileTab';
import AccountInfoTab from './account/AccountInfoTab';
import AccountPrivacyPanel from './account/AccountPrivacyPanel';
import type { TabKey } from './account/account-types';
import { isAccountTabKey } from './account/account-nav-items';
import { useIsMobile } from '../../hooks/useIsMobile';

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
  lblUserCode: string;
  lblMemberSince: string;
  btnSecurity: string;
  profileCompletionHint: string;
  hdrProfileIncomplete: string;
  subProfileIncomplete: string;
  statCompletedTrips: string;
  statLoyaltyPoints: string;
  statWalletBalance: string;
  statSavedPassengers: string;
  fieldNotSet: string;
  // trips
  tripsHeading: string;
  tripsSub: string;
  tripsEmptyText: string;
  tripsEmptySub: string;
  bookFlightBtn: string;
  searchFlightLink: string;
  pnrLabel: string;
  priceLockedBadge: string;
  viewTicketLink: string;
  downloadTicketBtn: string;
  detailsLink: string;
  requestRefundBtn: string;
  // wallet
  walletBalanceHeading: string;
  loyaltyPointsHeading: string;
  pointsUnit: string;
  pointsLogHeading: string;
  noTransactionsHeading: string;
  noTransactionsSub: string;
  topupBtn: string;
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
  locksHeading: string;
  locksSub: string;
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
  ticketsHeading: string;
  ticketsSub: string;
  ticketsNewBtn: string;
  ticketsEmptyText: string;
  ticketsEmptySub: string;
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
    lblUserCode: 'کد کاربری',
    lblMemberSince: 'عضویت از',
    btnSecurity: 'تنظیمات امنیت',
    profileCompletionHint: 'با تکمیل شماره گذرنامه و تأیید ایمیل، پروفایل را کامل کنید و ۲۰۰ امتیاز بگیرید.',
    hdrProfileIncomplete: 'پروفایل شما تکمیل نشده است',
    subProfileIncomplete: 'برای استفاده کامل از امکانات (رزرو سریع‌تر، احراز هویت و صدور کارت)، اطلاعات هویتی، ایمیل و آدرس خود را تکمیل کنید.',
    statCompletedTrips: 'سفرهای انجام‌شده',
    statLoyaltyPoints: 'امتیاز باشگاه',
    statWalletBalance: 'موجودی کیف پول',
    statSavedPassengers: 'مسافران ذخیره‌شده',
    fieldNotSet: 'تکمیل نشده',
    tripsHeading: 'سفرها و خریدهای من',
    tripsSub: 'لیست پروازهای رزرو شده، وضعیت بلیط و جزئیات سفر.',
    tripsEmptyText: 'هنوز سفری ثبت نکرده‌اید',
    tripsEmptySub: 'اولین پرواز خود را جستجو کنید و بلیط را آنلاین بخرید.',
    bookFlightBtn: 'جستجوی پرواز',
    searchFlightLink: 'جستجوی پرواز',
    pnrLabel: 'کد رزرو',
    priceLockedBadge: '🔒 قیمت قفل‌شده',
    viewTicketLink: 'مشاهده بلیط',
    downloadTicketBtn: 'دانلود PDF',
    detailsLink: 'جزئیات ‹',
    requestRefundBtn: 'درخواست استرداد',
    walletBalanceHeading: 'موجودی کیف پول',
    loyaltyPointsHeading: 'امتیاز باشگاه',
    pointsUnit: 'امتیاز',
    pointsLogHeading: 'گردش امتیاز',
    noTransactionsHeading: 'تراکنشی ثبت نشده است!',
    noTransactionsSub: 'با خرید بلیط یا استفاده از خدمات، امتیاز و گردش کیف پول اینجا نمایش داده می‌شود.',
    topupBtn: 'شارژ کیف پول',
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
    locksHeading: 'قفل قیمت',
    locksSub: 'پروازهایی که نرخ آن‌ها را برای مدت محدود قفل کرده‌اید.',
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
    ticketsHeading: 'پیام به پشتیبانی',
    ticketsSub: 'پیگیری گفت‌وگوهای شما با تیم پشتیبانی',
    ticketsNewBtn: 'تیکت جدید',
    ticketsEmptyText: 'هنوز تیکتی ثبت نکرده‌اید.',
    ticketsEmptySub: 'صندوق درخواست‌های پشتیبانی شما خالی است.',
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
    lblUserCode: 'User code',
    lblMemberSince: 'member since',
    btnSecurity: 'Security Settings',
    profileCompletionHint: 'Complete your passport number and verify your email to finish your profile and earn 200 points.',
    hdrProfileIncomplete: 'Your profile is incomplete',
    subProfileIncomplete: 'Complete your identity, email, and address info to fully use the features (faster booking, verification, and card issuance).',
    statCompletedTrips: 'Completed Trips',
    statLoyaltyPoints: 'Loyalty Points',
    statWalletBalance: 'Wallet Balance',
    statSavedPassengers: 'Saved Passengers',
    fieldNotSet: 'Not completed',
    tripsHeading: 'My Trips & Purchases',
    tripsSub: 'Your booked flights, ticket status, and trip details.',
    tripsEmptyText: "You haven't booked any trips yet",
    tripsEmptySub: 'Search for your first flight and buy a ticket online.',
    bookFlightBtn: 'Search Flights',
    searchFlightLink: 'Search Flights',
    pnrLabel: 'PNR',
    priceLockedBadge: '🔒 Price Locked',
    viewTicketLink: 'View Ticket',
    downloadTicketBtn: 'Download PDF',
    detailsLink: 'Details ‹',
    requestRefundBtn: 'Request Refund',
    walletBalanceHeading: 'Wallet Balance',
    loyaltyPointsHeading: 'Loyalty Points',
    pointsUnit: 'points',
    pointsLogHeading: 'Points History',
    noTransactionsHeading: 'No transactions recorded yet!',
    noTransactionsSub: 'Points and wallet activity will appear here once you buy a ticket or use a service.',
    topupBtn: 'Top Up Wallet',
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
    locksHeading: 'Price Lock',
    locksSub: 'Flights whose fares you have locked for a limited time.',
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
    ticketsHeading: 'Message Support',
    ticketsSub: 'Track your conversations with the support team',
    ticketsNewBtn: 'New Ticket',
    ticketsEmptyText: 'You have not submitted any support tickets yet.',
    ticketsEmptySub: 'Your support ticket inbox is empty.',
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
    lblUserCode: 'رمز المستخدم',
    lblMemberSince: 'عضو منذ',
    btnSecurity: 'إعدادات الأمان',
    profileCompletionHint: 'أكمل رقم جواز السفر وتحقق من بريدك الإلكتروني لإنهاء ملفك الشخصي والحصول على ٢٠٠ نقطة.',
    hdrProfileIncomplete: 'ملفك الشخصي غير مكتمل',
    subProfileIncomplete: 'أكمل معلومات هويتك وبريدك وعنوانك لاستخدام جميع الميزات (حجز أسرع، التحقق، وإصدار البطاقة).',
    statCompletedTrips: 'الرحلات المكتملة',
    statLoyaltyPoints: 'نقاط النادي',
    statWalletBalance: 'رصيد المحفظة',
    statSavedPassengers: 'المسافرون المحفوظون',
    fieldNotSet: 'لم يكتمل',
    tripsHeading: 'رحلاتي ومشترياتي',
    tripsSub: 'قائمة الرحلات المحجوزة وحالة التذكرة وتفاصيل السفر.',
    tripsEmptyText: 'لم تحجز أي رحلة بعد',
    tripsEmptySub: 'ابحث عن رحلتك الأولى واشترِ التذكرة عبر الإنترنت.',
    bookFlightBtn: 'البحث عن رحلة',
    searchFlightLink: 'البحث عن رحلة',
    pnrLabel: 'رمز الحجز',
    priceLockedBadge: '🔒 السعر مقفل',
    viewTicketLink: 'عرض التذكرة',
    downloadTicketBtn: 'تنزيل PDF',
    detailsLink: 'التفاصيل ‹',
    requestRefundBtn: 'طلب الاسترداد',
    walletBalanceHeading: 'رصيد المحفظة',
    loyaltyPointsHeading: 'نقاط النادي',
    pointsUnit: 'نقطة',
    pointsLogHeading: 'سجل النقاط',
    noTransactionsHeading: 'لا توجد معاملات مسجّلة بعد!',
    noTransactionsSub: 'ستظهر نقاطك وحركة المحفظة هنا عند شراء تذكرة أو استخدام خدمة.',
    topupBtn: 'شحن المحفظة',
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
    locksHeading: 'قفل السعر',
    locksSub: 'الرحلات التي أقفلت أسعارها لفترة محدودة.',
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
    ticketsHeading: 'رسالة للدعم',
    ticketsSub: 'تتبع محادثاتك مع فريق الدعم',
    ticketsNewBtn: 'تذكرة جديدة',
    ticketsEmptyText: 'لم تُقدّم أي تذكرة دعم بعد.',
    ticketsEmptySub: 'صندوق طلبات الدعم الخاص بك فارغ.',
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
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [tab, setTab] = useState<TabKey>(() => (isAccountTabKey(urlTab) ? urlTab : 'trips'));
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

  const selectTab = (next: TabKey) => {
    setTab(next);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('tab', next);
        return params;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (isAccountTabKey(urlTab) && urlTab !== tab) {
      setTab(urlTab);
    }
  }, [urlTab, tab]);

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
          gridTemplateColumns: isMobile ? '1fr' : '262px 1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <AccountSidebar
          tab={tab}
          onTabChange={selectTab}
          user={user}
          club={club}
          onSignOut={() => void signOut().then(() => navigate('/', { replace: true }))}
          isMobile={isMobile}
        />

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
                onClick={() => selectTab('account-info')}
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
          <AccountProfileTab
            user={user}
            profile={profile}
            bookings={bookings}
            clubBalance={club?.balance ?? 0}
            walletBalanceIrr={wallet?.balanceIrr ?? null}
            passengerCount={savedPassengers?.length ?? 0}
            isMobile={isMobile}
            onNavigateTab={selectTab}
          />
        )}

        {tab === 'account-info' && (
          <AccountInfoTab
            profile={profile}
            profileForm={profileForm}
            onProfileFormChange={setProfileForm}
            onSaveProfile={onSaveProfile}
            profileSaving={profileSaving}
            profileError={profileError}
            profileNotice={profileNotice}
            isMobile={isMobile}
            emailChallengeId={emailChallengeId}
            emailCode={emailCode}
            onEmailCodeChange={setEmailCode}
            onRequestEmailVerify={onRequestEmailVerify}
            onVerifyEmail={onVerifyEmail}
          />
        )}

        {tab === 'trips' && (
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px', color: '#0d2640' }}>{t.tripsHeading}</h2>
            <p style={{ fontSize: '11.5px', color: '#8a96a6', margin: '0 0 20px' }}>{t.tripsSub}</p>
            {bookings === null && <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>}
            {bookings?.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px 20px 34px' }}>
                <div style={{ width: 84, height: 84, margin: '0 auto 20px', borderRadius: 24, background: '#fef6e6', color: '#e0a53a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5v2.2a1.6 1.6 0 0 0 0 2.6v2.2A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 15.5v-2.2a1.6 1.6 0 0 0 0-2.6Z" />
                    <path d="M14 7v12" strokeDasharray="1.5 2.5" />
                  </svg>
                  <span style={{ position: 'absolute', top: -6, left: -6, width: 26, height: 26, borderRadius: 8, background: '#f0a83c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, border: '3px solid #fff' }}>!</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#16202e' }}>{t.tripsEmptyText}</div>
                <div style={{ fontSize: 12, color: '#9aa4b2', marginTop: 8 }}>{t.tripsEmptySub}</div>
                <Link
                  to="/"
                  style={{ display: 'inline-flex', marginTop: 18, height: 46, padding: '0 22px', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: '#1668c4', color: '#fff', fontSize: '12.5px', fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  {t.bookFlightBtn}
                </Link>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {bookings?.map((b) => {
                const st = STATUS_LABEL[b.status] ?? { label: { fa: b.status, en: b.status, ar: b.status }, bg: '#f1f4f8', color: '#5a6678' };
                const isUpcoming = b.status === 'TICKETED' || b.status === 'PAID' || b.status === 'HELD';
                return (
                  <div key={b.id} data-testid="account-trip" style={{ border: '1px solid #eef1f5', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ lineHeight: 1.5 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#16202e' }}>
                            {b.originCode} <span style={{ color: '#9aa4b2' }}>←</span> {b.destCode}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#9aa4b2' }}>
                            {b.flightNo} · {formatJalaliDateTime(b.departureAt)}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'Roboto Mono, monospace', color: '#5a6678', background: '#f6f8fb', padding: '4px 10px', borderRadius: 8 }} dir="ltr">
                          {b.pnr}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                        {b.isPriceLocked && (
                          <span data-testid="trip-price-locked-badge" style={{ fontSize: '10.5px', fontWeight: 700, color: '#9a7d22', background: '#fff7e6', padding: '5px 11px', borderRadius: 18 }}>
                            {t.priceLockedBadge}
                          </span>
                        )}
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: st.color, background: st.bg, padding: '5px 11px', borderRadius: 18 }}>{st.label[locale]}</span>
                        <div style={{ textAlign: locale === 'en' ? 'right' : 'left' }}>
                          <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#1668c4' }}>{faMoney(b.priceIrr)}</div>
                          <div style={{ fontSize: 10, color: '#9aa4b2' }}>{t.toman}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 11, borderTop: '1px solid #f2f4f7', alignItems: 'center', flexWrap: 'wrap' }}>
                      {b.pnr && (
                        <Link
                          to={`/ticket/${b.pnr}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '11.5px', color: '#1668c4', border: '1.5px solid #1668c4', padding: '7px 12px', borderRadius: 9, fontWeight: 700, textDecoration: 'none' }}
                        >
                          ↓ {t.downloadTicketBtn}
                        </Link>
                      )}
                      {isUpcoming && b.pnr && (
                        <Link
                          to={`/manage-booking?pnr=${encodeURIComponent(b.pnr)}`}
                          style={{ fontSize: '11.5px', color: '#e5484d', border: '1.5px solid #f3c9cc', padding: '7px 12px', borderRadius: 9, fontWeight: 700, textDecoration: 'none' }}
                        >
                          {t.requestRefundBtn}
                        </Link>
                      )}
                      {b.pnr && (
                        <Link to={`/ticket/${b.pnr}`} style={{ marginInlineStart: 'auto', fontSize: 11, color: '#9aa4b2', fontWeight: 600, textDecoration: 'none' }}>
                          {t.detailsLink}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'wallet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 15 }}>
              <div style={{ background: 'linear-gradient(135deg,#1668c4,#0d3b66)', borderRadius: 16, padding: 18, color: '#fff', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '11.5px', opacity: 0.85, marginBottom: 10 }}>{t.walletBalanceHeading}</div>
                <div data-testid="wallet-balance" style={{ fontSize: 27, fontWeight: 900 }}>
                  {wallet ? faMoney(wallet.balanceIrr) : '—'}{' '}
                  <span style={{ fontSize: '12.5px', opacity: 0.8, fontWeight: 400 }}>{t.toman}</span>
                </div>
                <button
                  type="button"
                  onClick={() => document.getElementById('wallet-topup-form')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ marginTop: 16, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', color: '#0d3b66', fontSize: 12, fontWeight: 800, padding: '9px 15px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  + {t.topupBtn}
                </button>
              </div>
              <div style={{ background: 'linear-gradient(135deg,#caa53a,#9a7d22)', borderRadius: 16, padding: 18, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '11.5px', opacity: 0.9, marginBottom: 10 }}>{t.loyaltyPointsHeading}</div>
                <div style={{ fontSize: 27, fontWeight: 900 }}>
                  {club ? faDigits(club.balance) : '—'}{' '}
                  <span style={{ fontSize: '12.5px', opacity: 0.8, fontWeight: 400 }}>{t.pointsUnit}</span>
                </div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18, flex: 1 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 16px', color: '#0d2640' }}>{t.pointsLogHeading}</h3>
              <div style={{ textAlign: 'center', padding: '34px 10px 14px' }}>
                <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 18, background: '#fef6e6', color: '#e0a53a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11V7.5A1.5 1.5 0 0 0 19.5 6H5a2 2 0 0 1 0-4h13" />
                    <path d="M3 4v14a2 2 0 0 0 2 2h14.5a1.5 1.5 0 0 0 1.5-1.5V15" />
                    <path d="M21 11h-4a2 2 0 0 0 0 4h4Z" />
                  </svg>
                  <span style={{ position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: 7, background: '#f0a83c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, border: '3px solid #fff' }}>!</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#16202e' }}>{t.noTransactionsHeading}</div>
                <div style={{ fontSize: 11, color: '#9aa4b2', marginTop: 6 }}>{t.noTransactionsSub}</div>
              </div>
            </div>
            <form id="wallet-topup-form" onSubmit={onTopup} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18, display: 'flex', gap: 11, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>{t.topupAmountLabel}</label>
                <input
                  data-testid="wallet-topup-amount"
                  dir="ltr"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder={t.topupPlaceholder}
                  style={{ width: '100%', boxSizing: 'border-box', height: 46, border: '1.5px solid #e2e7ee', borderRadius: 11, background: '#fafbfd', padding: '0 12px', fontFamily: 'inherit', fontSize: '12.5px', outline: 'none' }}
                />
              </div>
              <button
                type="submit"
                data-testid="wallet-topup-submit"
                disabled={topupBusy}
                style={{ border: 'none', borderRadius: 11, background: '#1668c4', color: '#fff', padding: '11px 22px', height: 46, fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
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
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px', color: '#0d2640' }}>{t.locksHeading}</h2>
            <p style={{ fontSize: '11.5px', color: '#8a96a6', margin: '0 0 20px' }}>{t.locksSub}</p>
            {lockError && <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 12 }}>{lockError}</p>}
            {priceLocks === null && <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>}
            {priceLocks?.length === 0 && (
              <div style={{ textAlign: 'center', padding: '34px 20px 24px', color: '#8a96a6', fontSize: 13, lineHeight: 1.8 }}>
                {t.locksEmptyText}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {priceLocks?.map((l) => {
              const st = LOCK_STATUS_LABEL[l.status] ?? { label: { fa: l.status, en: l.status, ar: l.status }, bg: '#f1f4f8', color: '#5a6678' };
              return (
                <div key={l.id} data-testid="account-price-lock" style={{ border: '1px solid #eef1f5', borderRadius: 14, padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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
            onGoProfile={() => selectTab('profile')}
          />
        )}
        {tab === 'identity' && identity === null && (
          <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>
        )}

        {tab === 'refunds' && <AccountRefundsTab />}

        {tab === 'tickets' && (
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, whiteSpace: 'nowrap', color: '#0d2640' }}>{t.ticketsHeading}</h2>
              <Link
                to="/support"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '11.5px', fontWeight: 700, background: '#1668c4', color: '#fff', padding: '9px 13px', borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                + {t.ticketsNewBtn}
              </Link>
            </div>
            <p style={{ fontSize: '11.5px', color: '#8a96a6', margin: '0 0 20px' }}>{t.ticketsSub}</p>
            {ticketsError && <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 12 }}>{ticketsError}</p>}
            {tickets === null && <p style={{ fontSize: 13, color: '#6b7787' }}>{t.loading}</p>}
            {tickets?.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px 24px' }}>
                <div style={{ width: 72, height: 72, margin: '0 auto 18px', borderRadius: 20, background: '#fef6e6', color: '#e0a53a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span style={{ position: 'absolute', top: -6, left: -6, width: 24, height: 24, borderRadius: 7, background: '#f0a83c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, border: '3px solid #fff' }}>!</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#16202e' }}>{t.ticketsEmptySub}</div>
                <div style={{ fontSize: '11.5px', color: '#9aa4b2', marginTop: 7 }}>{t.ticketsEmptyText}</div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {tickets?.map((tk) => {
              const st = TICKET_STATUS_LABEL[tk.status];
              const expanded = expandedTicketId === tk.id;
              return (
                <div key={tk.id} data-testid="account-ticket" style={{ border: '1px solid #eef1f5', borderRadius: 14, padding: '13px 14px', cursor: 'pointer' }}>
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
          </div>
        )}

        {tab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: isMobile ? '100%' : 520 }}>
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
            <AccountPrivacyPanel
              exportBusy={exportBusy}
              exportError={exportError}
              onExportData={onExportData}
              deleteConfirmOpen={deleteConfirmOpen}
              deleteBusy={deleteBusy}
              deleteError={deleteError}
              onDeleteOpen={() => setDeleteConfirmOpen(true)}
              onDeleteCancel={() => setDeleteConfirmOpen(false)}
              onDeleteConfirm={onConfirmDelete}
            />
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
