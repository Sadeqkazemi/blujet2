import type { StoredLocale } from '../../../hooks/useLocale';
import type { HomeSearchCopy } from './HomeSearchCard';

type BaseCopy = {
  heroCta: string;
  tabBook: string;
  tabManage: string;
  tabCheckin: string;
  svcDomestic: string;
  svcIntl: string;
  lblReturnDate: string;
  lblPaxClass: string;
  lblFlightType: string;
  btnSearch: string;
  btnConfirm: string;
  lblAdults: string;
  lblAdultsAge: string;
  lblChildren: string;
  lblChildrenAge: string;
  lblInfants: string;
  lblInfantsAge: string;
  lblCabinClass: string;
  cabinEconomy: string;
  cabinBusiness: string;
  manageIntro: string;
  lblBookingCode: string;
  phBookingCode: string;
  lblLastName: string;
  phLastName: string;
  btnViewBooking: string;
  checkinIntro: string;
  lblFlightNo: string;
  phFlightNo: string;
  lblFlightDate: string;
  phFlightDate: string;
  btnViewStatus: string;
  fromPrice: string;
  airlineBadge: string;
  airlineTitle: string;
  airlineSub: string;
  airlineBtn: string;
  appMockup: string;
  offerImgTags: Record<string, string>;
  destImgTags: Record<string, string>;
  cabinOffer: string;
};

export const HOME_EXTRA: Record<StoredLocale, BaseCopy> = {
  fa: {
    heroCta: 'مشاهده پیشنهادهای ویژه',
    tabBook: 'رزرو پرواز',
    tabManage: 'مدیریت رزرو',
    tabCheckin: 'وضعیت پرواز',
    svcDomestic: 'پرواز داخلی',
    svcIntl: 'پرواز خارجی',
    lblReturnDate: 'تاریخ برگشت',
    lblPaxClass: 'مسافران و کلاس',
    lblFlightType: 'نوع پرواز:',
    btnSearch: 'جستجو',
    btnConfirm: 'تأیید',
    lblAdults: 'بزرگسال',
    lblAdultsAge: '۱۲ سال به بالا',
    lblChildren: 'کودک',
    lblChildrenAge: '۲ تا ۱۲ سال',
    lblInfants: 'نوزاد',
    lblInfantsAge: 'زیر ۲ سال',
    lblCabinClass: 'کلاس پروازی',
    cabinEconomy: 'اکونومی',
    cabinBusiness: 'بیزنس',
    manageIntro: 'برای مشاهده، تغییر یا استرداد رزرو، کد رهگیری و نام خانوادگی مسافر را وارد کنید.',
    lblBookingCode: 'کد رهگیری',
    phBookingCode: 'مثلاً 4XKCT2',
    lblLastName: 'نام خانوادگی',
    phLastName: 'مثلاً رضایی',
    btnViewBooking: 'مشاهده رزرو',
    checkinIntro: 'آخرین وضعیت زمان‌بندی، تأخیر و گیت پرواز خود را با شماره پرواز یا مسیر و تاریخ بررسی کنید.',
    lblFlightNo: 'شماره پرواز',
    phFlightNo: 'مثلاً EP-521',
    lblFlightDate: 'تاریخ پرواز',
    phFlightDate: 'انتخاب تاریخ',
    btnViewStatus: 'مشاهده وضعیت پرواز',
    fromPrice: 'از',
    airlineBadge: 'ایرلاین‌های شریک',
    airlineTitle: 'پرواز با ۴۵+ ایرلاین معتبر بین‌المللی',
    airlineSub: 'تمام پروازها با ایرلاین‌های دارای مجوز رسمی و پوشش بیمه مسافرتی رزرو می‌شوند.',
    airlineBtn: 'مشاهده ایرلاین‌ها',
    appMockup: '[ موکاپ اپلیکیشن ]',
    offerImgTags: { 'THR-IST': '[ عکس استانبول ]', 'THR-DXB': '[ عکس دبی ]', 'MHD-KIH': '[ عکس کیش ]', 'THR-MHD': '[ عکس مشهد ]' },
    destImgTags: { IST: '[ عکس استانبول ]', DXB: '[ عکس دبی ]', MHD: '[ عکس مشهد ]', KIH: '[ عکس کیش ]' },
    cabinOffer: 'اکونومی',
  },
  en: {
    heroCta: 'See offers',
    tabBook: 'Book Flight',
    tabManage: 'Manage Booking',
    tabCheckin: 'Flight Status',
    svcDomestic: 'Domestic',
    svcIntl: 'International',
    lblReturnDate: 'Return date',
    lblPaxClass: 'Passengers & class',
    lblFlightType: 'Flight type:',
    btnSearch: 'Search',
    btnConfirm: 'Confirm',
    lblAdults: 'Adults',
    lblAdultsAge: 'Age 12+',
    lblChildren: 'Children',
    lblChildrenAge: 'Age 2–12',
    lblInfants: 'Infants',
    lblInfantsAge: 'Under 2',
    lblCabinClass: 'Cabin class',
    cabinEconomy: 'Economy',
    cabinBusiness: 'Business',
    manageIntro: 'Enter your booking reference and last name to view, change, or cancel your reservation.',
    lblBookingCode: 'Booking Reference',
    phBookingCode: 'e.g. 4XKCT2',
    lblLastName: 'Last Name',
    phLastName: 'e.g. Smith',
    btnViewBooking: 'View Booking',
    checkinIntro: 'Check the latest schedule, delay, and gate status with your flight number or route and date.',
    lblFlightNo: 'Flight Number',
    phFlightNo: 'e.g. EP-521',
    lblFlightDate: 'Flight Date',
    phFlightDate: 'Select date',
    btnViewStatus: 'View Flight Status',
    fromPrice: 'From',
    airlineBadge: 'Partner Airlines',
    airlineTitle: 'Fly with 45+ trusted international airlines',
    airlineSub: 'All flights are booked with officially licensed airlines and travel insurance coverage.',
    airlineBtn: 'View Airlines',
    appMockup: '[ App mockup ]',
    offerImgTags: { 'THR-IST': '[ Istanbul photo ]', 'THR-DXB': '[ Dubai photo ]', 'MHD-KIH': '[ Kish photo ]', 'THR-MHD': '[ Mashhad photo ]' },
    destImgTags: { IST: '[ Istanbul photo ]', DXB: '[ Dubai photo ]', MHD: '[ Mashhad photo ]', KIH: '[ Kish photo ]' },
    cabinOffer: 'Economy',
  },
  ar: {
    heroCta: 'عرض العروض',
    tabBook: 'حجز رحلة',
    tabManage: 'إدارة الحجز',
    tabCheckin: 'حالة الرحلة',
    svcDomestic: 'رحلات داخلية',
    svcIntl: 'رحلات دولية',
    lblReturnDate: 'تاريخ العودة',
    lblPaxClass: 'المسافرون والدرجة',
    lblFlightType: 'نوع الرحلة:',
    btnSearch: 'بحث',
    btnConfirm: 'تأكيد',
    lblAdults: 'بالغ',
    lblAdultsAge: '١٢ سنة فأكثر',
    lblChildren: 'طفل',
    lblChildrenAge: 'من ٢ إلى ١٢',
    lblInfants: 'رضيع',
    lblInfantsAge: 'أقل من ٢',
    lblCabinClass: 'درجة السفر',
    cabinEconomy: 'اقتصادية',
    cabinBusiness: 'رجال الأعمال',
    manageIntro: 'أدخل رمز الحجز واسم العائلة لعرض الحجز أو تغييره أو استرداده.',
    lblBookingCode: 'رمز الحجز',
    phBookingCode: 'مثلاً 4XKCT2',
    lblLastName: 'اسم العائلة',
    phLastName: 'مثلاً رضائي',
    btnViewBooking: 'عرض الحجز',
    checkinIntro: 'تحقق من آخر حالة للجدول والتأخير والبوابة برقم الرحلة أو المسار والتاريخ.',
    lblFlightNo: 'رقم الرحلة',
    phFlightNo: 'مثلاً EP-521',
    lblFlightDate: 'تاريخ الرحلة',
    phFlightDate: 'اختر التاريخ',
    btnViewStatus: 'عرض حالة الرحلة',
    fromPrice: 'من',
    airlineBadge: 'شركات طيران شريكة',
    airlineTitle: 'طِر مع أكثر من ٤٥ شركة طيران دولية موثوقة',
    airlineSub: 'جميع الرحلات محجوزة مع شركات طيران مرخصة رسمياً وتغطية تأمين السفر.',
    airlineBtn: 'عرض شركات الطيران',
    appMockup: '[ موكاپ التطبيق ]',
    offerImgTags: { 'THR-IST': '[ صورة إسطنبول ]', 'THR-DXB': '[ صورة دبي ]', 'MHD-KIH': '[ صورة كيش ]', 'THR-MHD': '[ صورة مشهد ]' },
    destImgTags: { IST: '[ صورة إسطنبول ]', DXB: '[ صورة دبي ]', MHD: '[ صورة مشهد ]', KIH: '[ صورة كيش ]' },
    cabinOffer: 'اقتصادية',
  },
};

export function buildSearchCopy(
  locale: StoredLocale,
  base: {
    tripOneWay: string;
    tripRoundTrip: string;
    tripMultiCity: string;
    lblOrigin: string;
    lblDestination: string;
    lblDepartDate: string;
    selectPlaceholder: string;
    originPlaceholder: string;
    destPlaceholder: string;
    destNeedOriginPlaceholder: string;
    cityEmptyLabel: string;
    cityListLabel: string;
    popularRoutesTitle: string;
    popularRoutesSub: string;
    toman: string;
    missing: string;
    sameCity: string;
  },
): HomeSearchCopy {
  const extra = HOME_EXTRA[locale];
  return { ...extra, ...base };
}
