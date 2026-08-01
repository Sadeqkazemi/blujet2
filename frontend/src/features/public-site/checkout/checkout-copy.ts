import type { StoredLocale } from '../../../hooks/useLocale';

export const CHECKOUT_COPY: Record<
  StoredLocale,
  {
    title: string;
    loading: string;
    notFound: string;
    expired: string;
    searchAgain: string;
    steps: { pax: string; extras: string; review: string };
    enterPax: string;
    travelExtras: string;
    pickServices: string;
    confirmDetails: string;
    flightSummary: string;
    paymentDetails: string;
    description: string;
    amountToman: string;
    ticketPrice: (count: number) => string;
    taxesFees: string;
    total: string;
    securePayment: string;
    agreeTerms: string;
    termsLink: string;
    nextPax: string;
    nextExtras: string;
    nextReview: string;
    nextPay: string;
    backStep: string;
    completePaxError: string;
    adultLabel: (n: number) => string;
    nationalId: string;
    passport: string;
    scanDocument: string;
    firstNameLatin: string;
    lastNameLatin: string;
    gender: string;
    female: string;
    male: string;
    dateOfBirth: string;
    day: string;
    month: string;
    year: string;
    passportNo: string;
    fromSaved: string;
    addPax: string;
    remove: string;
    passenger: string;
    document: string;
    seat: string;
    selectedExtras: string;
    nameChangeWarning: string;
    noneSelected: string;
    toman: string;
    extras: Record<'baggage' | 'meal' | 'insurance' | 'cip', { title: string; desc: string }>;
    months: string[];
  }
> = {
  fa: {
    title: 'تکمیل خرید',
    loading: 'در حال بارگذاری…',
    notFound: 'اطلاعات رزرو یافت نشد.',
    expired: 'مهلت نگهداری این رزرو به پایان رسیده است.',
    searchAgain: 'جستجوی مجدد',
    steps: { pax: 'اطلاعات مسافر', extras: 'خدمات جانبی', review: 'بازبینی' },
    enterPax: 'وارد کردن اطلاعات مسافر',
    travelExtras: 'خدمات سفر',
    pickServices: 'خدمات اضافی مورد نیاز خود را انتخاب کنید.',
    confirmDetails: 'تأیید اطلاعات',
    flightSummary: 'خلاصه پرواز',
    paymentDetails: 'جزئیات پرداخت',
    description: 'شرح',
    amountToman: 'مبلغ (تومان)',
    ticketPrice: (n) => `قیمت بلیط (بزرگسال × ${n})`,
    taxesFees: 'مالیات و عوارض',
    total: 'جمع کل',
    securePayment: 'پرداخت امن و رمزگذاری‌شده',
    agreeTerms: 'با ادامه،',
    termsLink: 'قوانین و مقررات',
    nextPax: 'تأیید و ادامه',
    nextExtras: 'ادامه تا بازبینی',
    nextReview: 'ادامه به پرداخت',
    nextPay: 'ادامه به پرداخت',
    backStep: 'بازگشت به مرحله قبل',
    completePaxError: 'لطفاً اطلاعات همه مسافران را کامل کنید.',
    adultLabel: (n) => `${n}. بزرگسال`,
    nationalId: 'کد ملی',
    passport: 'گذرنامه',
    scanDocument: 'اسکن مدرک',
    firstNameLatin: 'نام (لاتین)',
    lastNameLatin: 'نام خانوادگی (لاتین)',
    gender: 'جنسیت',
    female: 'زن',
    male: 'مرد',
    dateOfBirth: 'تاریخ تولد',
    day: 'روز',
    month: 'ماه',
    year: 'سال',
    passportNo: 'شماره گذرنامه',
    fromSaved: 'از مسافران ذخیره‌شده',
    addPax: 'مسافر جدید',
    remove: 'حذف',
    passenger: 'مسافر',
    document: 'مدرک',
    seat: 'صندلی',
    selectedExtras: 'خدمات انتخاب‌شده',
    nameChangeWarning:
      'پس از پرداخت، امکان تغییر نام مسافران وجود ندارد. لطفاً املای نام را با دقت بررسی کنید.',
    noneSelected: '—',
    toman: 'تومان',
    extras: {
      baggage: { title: 'بار اضافه (+۲۳ کیلو)', desc: '۲۳ کیلوگرم بار اضافه' },
      meal: { title: 'غذای ویژه', desc: 'انتخاب منوی غذایی' },
      insurance: { title: 'بیمه مسافرتی', desc: 'پوشش تا ۵۰۰ میلیون ریال' },
      cip: { title: 'سالن تشریفات CIP', desc: 'ورود از سالن اختصاصی' },
    },
    months: [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
    ],
  },
  en: {
    title: 'Complete purchase',
    loading: 'Loading…',
    notFound: 'Booking information not found.',
    expired: 'The hold on this booking has expired.',
    searchAgain: 'Search again',
    steps: { pax: 'Passenger info', extras: 'Travel extras', review: 'Review' },
    enterPax: 'Enter passenger details',
    travelExtras: 'Travel extras',
    pickServices: 'Select any additional services you need.',
    confirmDetails: 'Confirm details',
    flightSummary: 'Flight summary',
    paymentDetails: 'Payment details',
    description: 'Description',
    amountToman: 'Amount (Toman)',
    ticketPrice: (n) => `Ticket price (adult × ${n})`,
    taxesFees: 'Taxes & fees',
    total: 'Total',
    securePayment: 'Secure encrypted payment',
    agreeTerms: 'By continuing, you accept the',
    termsLink: 'terms & conditions',
    nextPax: 'Confirm & continue',
    nextExtras: 'Continue to review',
    nextReview: 'Continue to payment',
    nextPay: 'Continue to payment',
    backStep: 'Back to previous step',
    completePaxError: 'Please complete all passenger information.',
    adultLabel: (n) => `${n}. Adult`,
    nationalId: 'National ID',
    passport: 'Passport',
    scanDocument: 'Scan document',
    firstNameLatin: 'First name (Latin)',
    lastNameLatin: 'Last name (Latin)',
    gender: 'Gender',
    female: 'Female',
    male: 'Male',
    dateOfBirth: 'Date of birth',
    day: 'Day',
    month: 'Month',
    year: 'Year',
    passportNo: 'Passport number',
    fromSaved: 'From saved passengers',
    addPax: 'New passenger',
    remove: 'Remove',
    passenger: 'Passenger',
    document: 'Document',
    seat: 'Seat',
    selectedExtras: 'Selected extras',
    nameChangeWarning:
      'Passenger names cannot be changed after payment. Please verify spelling carefully.',
    noneSelected: '—',
    toman: 'Toman',
    extras: {
      baggage: { title: 'Extra baggage (+23 kg)', desc: '23 kg additional baggage' },
      meal: { title: 'Special meal', desc: 'Choose a meal option' },
      insurance: { title: 'Travel insurance', desc: 'Coverage up to 500M IRR' },
      cip: { title: 'CIP lounge', desc: 'Private lounge access' },
    },
    months: [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ],
  },
  ar: {
    title: 'إتمام الشراء',
    loading: 'جارٍ التحميل…',
    notFound: 'لم تُعثر على معلومات الحجز.',
    expired: 'انتهت مهلة الاحتفاظ بهذا الحجز.',
    searchAgain: 'بحث مجدداً',
    steps: { pax: 'بيانات المسافر', extras: 'خدمات إضافية', review: 'مراجعة' },
    enterPax: 'إدخال بيانات المسافر',
    travelExtras: 'خدمات السفر',
    pickServices: 'اختر الخدمات الإضافية التي تحتاجها.',
    confirmDetails: 'تأكيد البيانات',
    flightSummary: 'ملخص الرحلة',
    paymentDetails: 'تفاصيل الدفع',
    description: 'الوصف',
    amountToman: 'المبلغ (تومان)',
    ticketPrice: (n) => `سعر التذكرة (بالغ × ${n})`,
    taxesFees: 'الضرائب والرسوم',
    total: 'الإجمالي',
    securePayment: 'دفع آمن ومشفر',
    agreeTerms: 'بالمتابعة، فإنك تقبل',
    termsLink: 'الشروط والأحكام',
    nextPax: 'تأكيد ومتابعة',
    nextExtras: 'المتابعة إلى المراجعة',
    nextReview: 'المتابعة إلى الدفع',
    nextPay: 'المتابعة إلى الدفع',
    backStep: 'العودة للخطوة السابقة',
    completePaxError: 'يرجى إكمال بيانات جميع المسافرين.',
    adultLabel: (n) => `${n}. بالغ`,
    nationalId: 'بطاقة الهوية',
    passport: 'جواز السفر',
    scanDocument: 'مسح المستند',
    firstNameLatin: 'الاسم (لاتيني)',
    lastNameLatin: 'اسم العائلة (لاتيني)',
    gender: 'الجنس',
    female: 'أنثى',
    male: 'ذكر',
    dateOfBirth: 'تاريخ الميلاد',
    day: 'يوم',
    month: 'شهر',
    year: 'سنة',
    passportNo: 'رقم جواز السفر',
    fromSaved: 'من المسافرين المحفوظين',
    addPax: 'مسافر جديد',
    remove: 'حذف',
    passenger: 'مسافر',
    document: 'الوثيقة',
    seat: 'المقعد',
    selectedExtras: 'الخدمات المختارة',
    nameChangeWarning: 'لا يمكن تغيير أسماء المسافرين بعد الدفع. يرجى التحقق من الإملاء.',
    noneSelected: '—',
    toman: 'تومان',
    extras: {
      baggage: { title: 'أمتعة إضافية (+23 كغ)', desc: '23 كغ أمتعة إضافية' },
      meal: { title: 'وجبة خاصة', desc: 'اختيار قائمة الوجبات' },
      insurance: { title: 'تأمين سفر', desc: 'تغطية حتى 500 مليون ريال' },
      cip: { title: 'صالة CIP', desc: 'دخول من الصالة الخاصة' },
    },
    months: [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ],
  },
};
