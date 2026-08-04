import type { StoredLocale } from '../../hooks/useLocale';

export type DocSectionKey = 'intro' | 'auth' | 'endpoints' | 'errors' | 'changelog';

export interface DocEndpoint {
  id: string;
  method: string;
  path: string;
  locked: boolean;
  desc: Record<StoredLocale, string>;
  req: string;
  res: string;
}

export interface DocGroup {
  key: string;
  title: Record<StoredLocale, string>;
  eps: DocEndpoint[];
}

export const DOC_SECTIONS: { key: DocSectionKey; label: Record<StoredLocale, string> }[] = [
  { key: 'intro', label: { fa: 'معرفی', en: 'Introduction', ar: 'مقدمة' } },
  { key: 'auth', label: { fa: 'احراز هویت', en: 'Authentication', ar: 'المصادقة' } },
  { key: 'endpoints', label: { fa: 'متدها (Endpoints)', en: 'Endpoints', ar: 'نقاط النهاية' } },
  { key: 'errors', label: { fa: 'کدهای خطا', en: 'Error Codes', ar: 'رموز الخطأ' } },
  { key: 'changelog', label: { fa: 'تاریخچه نسخه‌ها', en: 'Changelog', ar: 'سجل الإصدارات' } },
];

export const API_DOC_GROUPS: DocGroup[] = [
  {
    key: 'Token',
    title: { fa: 'توکن', en: 'Token', ar: 'الرمز' },
    eps: [
      {
        id: 'getAuthorizeToken',
        method: 'POST',
        path: '/api/v2/accounting/getAuthorizeToken',
        locked: false,
        desc: {
          fa: 'دریافت توکن دسترسی با نام کاربری و رمز عبور آژانس. این توکن را در تمام درخواست‌های بعدی به‌صورت هدر Bearer ارسال کنید.',
          en: 'Obtain an access token using your agency username and password. Send this token as a Bearer header on every subsequent call.',
          ar: 'الحصول على رمز وصول باستخدام اسم المستخدم وكلمة مرور الوكالة. أرسل هذا الرمز في كل طلب لاحق كـ Bearer.',
        },
        req: `POST /api/v2/accounting/getAuthorizeToken\nContent-Type: application/json\n\n{\n  "username": "agency_user",\n  "password": "********",\n  "grant_type": "password"\n}`,
        res: `{\n  "access_token": "eyJhbGciOiJIUzI1NiIs...",\n  "token_type": "bearer",\n  "expires_in": 3600\n}`,
      },
    ],
  },
  {
    key: 'Flight',
    title: { fa: 'پرواز', en: 'Flight', ar: 'الرحلة' },
    eps: [
      {
        id: 'FlightSearch',
        method: 'POST',
        path: '/api/v2/flight/FlightSearch',
        locked: true,
        desc: {
          fa: 'جست‌وجوی پروازها و نرخ‌های موجود برای یک تاریخ سفر مشخص.',
          en: 'Search available flights and fares for an exact travel date.',
          ar: 'البحث عن الرحلات والأسعار المتاحة لتاريخ سفر محدد.',
        },
        req: `POST /api/v2/flight/FlightSearch\nAuthorization: Bearer {access_token}\n\n{\n  "origin": "THR",\n  "destination": "MHD",\n  "date": "2026-08-12",\n  "adult": 1\n}`,
        res: `{\n  "err": null,\n  "data": { "outbound": [{ "flightId": "BJ-4021", "price": 14800000 }] }\n}`,
      },
      {
        id: 'Book',
        method: 'POST',
        path: '/api/v2/flight/Book',
        locked: true,
        desc: {
          fa: 'ایجاد رزرو (PNR) برای پرواز قیمت‌گذاری‌شده همراه با اطلاعات مسافران.',
          en: 'Create a reservation (PNR) for the priced flight with passenger details.',
          ar: 'إنشاء حجز (PNR) للرحلة المُسعّرة مع بيانات المسافرين.',
        },
        req: `POST /api/v2/flight/Book\nAuthorization: Bearer {access_token}\n\n{\n  "flightId": "BJ-4021",\n  "passengers": [{ "firstName": "Ali", "lastName": "Rezaei" }]\n}`,
        res: `{\n  "err": null,\n  "data": { "pnr": "BJ7X2K", "seats": [{ "passenger": "Ali Rezaei", "seat": "12A" }] }\n}`,
      },
      {
        id: 'AirDemandTicket',
        method: 'POST',
        path: '/api/v2/flight/AirDemandTicket',
        locked: true,
        desc: {
          fa: 'درخواست صدور بلیت برای رزرو تأییدشده.',
          en: 'Request ticket issuance for a confirmed reservation.',
          ar: 'طلب إصدار التذكرة لحجز مؤكد.',
        },
        req: `POST /api/v2/flight/AirDemandTicket\nAuthorization: Bearer {access_token}\n\n{\n  "pnr": "BJ7X2K"\n}`,
        res: `{\n  "err": null,\n  "data": { "tickets": [{ "ticketNumber": "081-2456879213" }] }\n}`,
      },
    ],
  },
  {
    key: 'Accounting',
    title: { fa: 'مالی', en: 'Accounting', ar: 'المحاسبة' },
    eps: [
      {
        id: 'myCredit',
        method: 'POST',
        path: '/api/v2/accounting/myCredit',
        locked: true,
        desc: {
          fa: 'دریافت موجودی و سقف اعتبار فعلی آژانس شما.',
          en: "Get your agency's current credit balance and limit.",
          ar: 'الحصول على رصيد وسقف ائتمان وكالتك الحالي.',
        },
        req: `POST /api/v2/accounting/myCredit\nAuthorization: Bearer {access_token}`,
        res: `{\n  "err": null,\n  "data": { "credit": 1285000000, "creditLimit": 5000000000, "currency": "IRR" }\n}`,
      },
    ],
  },
];

export const ERROR_ROWS: { code: string; title: Record<StoredLocale, string>; desc: Record<StoredLocale, string> }[] = [
  {
    code: '401',
    title: { fa: 'عدم احراز هویت', en: 'Unauthorized', ar: 'غير مصرّح' },
    desc: {
      fa: 'کلید API ارسال نشده یا نامعتبر است.',
      en: 'Missing or invalid API key.',
      ar: 'مفتاح API مفقود أو غير صالح.',
    },
  },
  {
    code: '403',
    title: { fa: 'دسترسی مجاز نیست', en: 'Forbidden', ar: 'محظور' },
    desc: {
      fa: 'پلن وب‌سرویس غیرفعال یا معلق شده است.',
      en: 'Web service plan inactive or suspended.',
      ar: 'خطة خدمة الويب غير نشطة أو معلّقة.',
    },
  },
  {
    code: '429',
    title: { fa: 'تعداد درخواست بیش از حد', en: 'Too Many Requests', ar: 'طلبات كثيرة جداً' },
    desc: {
      fa: 'محدودیت نرخ درخواست رد شده — ۶۰ درخواست در دقیقه.',
      en: 'Rate limit exceeded — 60 requests per minute per API key.',
      ar: 'تم تجاوز حد المعدل — ٦٠ طلباً في الدقيقة.',
    },
  },
];

export const CHANGELOG_ROWS: { v: string; date: Record<StoredLocale, string>; note: Record<StoredLocale, string> }[] = [
  {
    v: 'v1.1',
    date: { fa: '۱۴۰۴/۰۸/۲۹', en: '2025-11-20', ar: '٢٠٢٥-١١-٢٠' },
    note: {
      fa: 'افزوده‌شدن متد POST /bookings/{pnr}/issue.',
      en: 'Added POST /bookings/{pnr}/issue endpoint.',
      ar: 'إضافة نقطة POST /bookings/{pnr}/issue.',
    },
  },
  {
    v: 'v1.0',
    date: { fa: '۱۴۰۴/۰۵/۱۰', en: '2025-08-01', ar: '٢٠٢٥-٠٨-٠١' },
    note: {
      fa: 'انتشار عمومی اولیه وب‌سرویس رزرو آژانس.',
      en: 'Initial public release of the agency booking API.',
      ar: 'الإصدار العام الأول لواجهة حجز الوكالة.',
    },
  },
];

export const DOC_COPY: Record<
  StoredLocale,
  {
    title: string;
    subtitle: string;
    baseUrlLabel: string;
    formatLabel: string;
    formatVal: string;
    rateLabel: string;
    rateVal: string;
    authTitle: string;
    authP1: string;
    authP2: string;
    endpointsHint: string;
    reqLabel: string;
    resLabel: string;
    errorsHint: string;
    lockedHint: string;
    activePlanHint: string;
    loading: string;
  }
> = {
  fa: {
    title: 'وب‌سرویس رزرو آژانس',
    subtitle: 'راهنمای یکپارچه‌سازی با اینترفیس رزرو آژانس',
    baseUrlLabel: 'آدرس پایه',
    formatLabel: 'قالب داده',
    formatVal: 'همه درخواست‌ها و پاسخ‌ها با فرمت JSON (UTF-8) هستند.',
    rateLabel: 'محدودیت نرخ درخواست',
    rateVal: '۶۰ درخواست در دقیقه به ازای هر کلید API. عبور از این حد، خطای HTTP 429 برمی‌گرداند.',
    authTitle: 'احراز هویت درخواست‌ها',
    authP1: 'کلید API آژانس خود را به‌صورت Bearer token در هدر Authorization هر درخواست ارسال کنید.',
    authP2: 'کلید API شما پس از تأیید و فعال‌شدن پلن، در تب «وب سرویس» در دسترس است.',
    endpointsHint: 'همه مسیرهای زیر نسبت به آدرس پایه ذکرشده در بخش «معرفی» هستند.',
    reqLabel: 'درخواست',
    resLabel: 'پاسخ',
    errorsHint: 'در صورت خطا، بدنه پاسخ شامل یک شیء "error" با همین کد است.',
    lockedHint: 'پس از فعال‌شدن وب‌سرویس در دسترس می‌شود',
    activePlanHint: 'پلن وب‌سرویس شما فعال است — همه متدها در دسترس‌اند.',
    loading: 'در حال بارگذاری…',
  },
  en: {
    title: 'Agency Booking API',
    subtitle: 'Integration guide for the agency booking API',
    baseUrlLabel: 'Base URL',
    formatLabel: 'Data format',
    formatVal: 'All requests and responses use JSON (UTF-8).',
    rateLabel: 'Rate limit',
    rateVal: '60 requests per minute per API key. Exceeding this returns HTTP 429.',
    authTitle: 'Authenticating requests',
    authP1: "Send your agency's API key as a Bearer token in the Authorization header of every request.",
    authP2: 'Your API key is available in the Web Service tab once your plan is approved and active.',
    endpointsHint: 'All paths below are relative to the base URL shown in the Introduction section.',
    reqLabel: 'Request',
    resLabel: 'Response',
    errorsHint: 'On failure, the response body includes a matching "error" object with this code.',
    lockedHint: 'Available after your web service plan is activated',
    activePlanHint: 'Your web service plan is active — all endpoints are available.',
    loading: 'Loading…',
  },
  ar: {
    title: 'واجهة حجز الوكالة',
    subtitle: 'دليل التكامل مع واجهة حجز الوكالة',
    baseUrlLabel: 'العنوان الأساسي',
    formatLabel: 'تنسيق البيانات',
    formatVal: 'جميع الطلبات والاستجابات بصيغة JSON (UTF-8).',
    rateLabel: 'حد المعدل',
    rateVal: '٦٠ طلباً في الدقيقة لكل مفتاح API. تجاوز ذلك يُرجع HTTP 429.',
    authTitle: 'مصادقة الطلبات',
    authP1: 'أرسل مفتاح API الخاص بوكالتك كـ Bearer token في رأس Authorization لكل طلب.',
    authP2: 'مفتاح API متاح في تبويب خدمة الويب بعد الموافقة على خطتك وتفعيلها.',
    endpointsHint: 'جميع المسارات أدناه نسبةً للعنوان الأساسي في قسم المقدمة.',
    reqLabel: 'الطلب',
    resLabel: 'الاستجابة',
    errorsHint: 'عند الفشل، يتضمن جسم الاستجابة كائناً "error" بهذا الرمز.',
    lockedHint: 'متاح بعد تفعيل خطة خدمة الويب',
    activePlanHint: 'خطة خدمة الويب نشطة — جميع النقاط متاحة.',
    loading: 'جارٍ التحميل…',
  },
};
