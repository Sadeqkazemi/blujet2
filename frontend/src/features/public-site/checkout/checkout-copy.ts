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
    selectSaved: string;
    savedEmpty: string;
    addPax: string;
    remove: string;
    passenger: string;
    document: string;
    seat: string;
    seatMapCaption: (aircraft: string) => string;
    bizLockedHint: string;
    business: string;
    available: string;
    reserved: string;
    selectedSeat: string;
    totalSold: string;
    ofLabel: string;
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
    travelExtras: 'خدمات جانبی سفر',
    pickServices:
      'خدماتی که می‌خواهید انتخاب کنید — هزینه به مجموع شما اضافه می‌شود',
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
    nextExtras: 'ادامه',
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
    selectSaved: 'انتخاب از مسافران ذخیره‌شده:',
    savedEmpty: 'هنوز مسافری در حساب شما ذخیره نشده است.',
    addPax: 'مسافر جدید',
    remove: 'حذف',
    passenger: 'مسافر',
    document: 'مدرک',
    seat: 'صندلی',
    seatMapCaption: (aircraft) =>
      `انتخاب صندلی (اختیاری) — ${aircraft} · فرست‌کلاس ردیف ۳ تا ۶ (۲-۲) · بیزینس ردیف ۷ تا ۱۱ (۲-۳) · اکونومی ردیف ۱۲ تا ۳۲ (۲-۳)`,
    bizLockedHint: 'انتخاب صندلی بیزنس نیازمند حداقل ۱۵٬۰۰۰ امتیاز باشگاه است',
    business: 'بیزنس',
    available: 'موجود',
    reserved: 'رزرو شده',
    selectedSeat: 'صندلی انتخابی',
    totalSold: 'مجموع صندلی‌های فروخته‌شده',
    ofLabel: 'از',
    selectedExtras: 'خدمات جانبی انتخابی',
    nameChangeWarning:
      'پس از پرداخت، امکان تغییر نام مسافران وجود ندارد. لطفاً املای نام را با دقت بررسی کنید.',
    noneSelected: 'انتخاب نشده',
    toman: 'تومان',
    extras: {
      baggage: { title: 'بار اضافه (۱۰ کیلوگرم)', desc: 'علاوه بر مجاز ۲۰ کیلوگرمی' },
      meal: { title: 'غذای گرم داخل پرواز', desc: 'منوی ایرانی / بین‌المللی' },
      insurance: { title: 'بیمه مسافرتی', desc: 'پوشش کامل تأخیر و خسارت' },
      cip: { title: 'خدمات CIP فرودگاهی', desc: 'پذیرش و گیت اختصاصی' },
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
    travelExtras: 'Travel Extras',
    pickServices: "Pick the services you'd like — the cost is added to your total",
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
    nextExtras: 'Continue',
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
    selectSaved: 'Select from saved passengers:',
    savedEmpty: 'You have no saved passengers yet.',
    addPax: 'New passenger',
    remove: 'Remove',
    passenger: 'Passenger',
    document: 'Document',
    seat: 'Seat',
    seatMapCaption: (aircraft) =>
      `Seat selection (optional) — ${aircraft} · First Class rows 3–6 (2-2) · Business rows 7–11 (2-3) · Economy rows 12–32 (2-3)`,
    bizLockedHint: 'Selecting a Business seat requires at least 15,000 loyalty points',
    business: 'Business',
    available: 'Available',
    reserved: 'Reserved',
    selectedSeat: 'Selected seat',
    totalSold: 'Total seats sold',
    ofLabel: 'of',
    selectedExtras: 'Selected extras',
    nameChangeWarning:
      'Passenger names cannot be changed after payment. Please verify spelling carefully.',
    noneSelected: 'Not selected',
    toman: 'Toman',
    extras: {
      baggage: { title: 'Extra baggage (10 kg)', desc: 'On top of the 20 kg allowance' },
      meal: { title: 'Hot in-flight meal', desc: 'Iranian / international menu' },
      insurance: { title: 'Travel insurance', desc: 'Full delay & damage coverage' },
      cip: { title: 'Airport CIP services', desc: 'Dedicated check-in & gate' },
    },
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
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
    travelExtras: 'الخدمات الإضافية للسفر',
    pickServices: 'اختر الخدمات التي ترغب بها — تُضاف التكلفة إلى إجمالي الفاتورة',
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
    nextExtras: 'متابعة',
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
    selectSaved: 'اختر من المسافرين المحفوظين:',
    savedEmpty: 'لا يوجد مسافرون محفوظون في حسابك بعد.',
    addPax: 'مسافر جديد',
    remove: 'حذف',
    passenger: 'مسافر',
    document: 'الوثيقة',
    seat: 'المقعد',
    seatMapCaption: (aircraft) =>
      `اختيار المقعد (اختياري) — ${aircraft} · الدرجة الأولى صفوف 3–6 (2-2) · درجة الأعمال صفوف 7–11 (2-3) · الاقتصادية صفوف 12–32 (2-3)`,
    bizLockedHint: 'يتطلب اختيار مقعد درجة الأعمال 15,000 نقطة ولاء على الأقل',
    business: 'درجة الأعمال',
    available: 'متاح',
    reserved: 'محجوز',
    selectedSeat: 'المقعد المختار',
    totalSold: 'إجمالي المقاعد المباعة',
    ofLabel: 'من',
    selectedExtras: 'الخدمات الإضافية المختارة',
    nameChangeWarning: 'لا يمكن تغيير أسماء المسافرين بعد الدفع. يرجى التحقق من الإملاء.',
    noneSelected: 'لم يتم الاختيار',
    toman: 'تومان',
    extras: {
      baggage: { title: 'أمتعة إضافية (10 كجم)', desc: 'إضافة إلى الحد المسموح 20 كجم' },
      meal: { title: 'وجبة ساخنة على متن الرحلة', desc: 'قائمة إيرانية / عالمية' },
      insurance: { title: 'تأمين السفر', desc: 'تغطية كاملة للتأخير والأضرار' },
      cip: { title: 'خدمات CIP في المطار', desc: 'تسجيل وصول وبوابة مخصصة' },
    },
    months: [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ],
  },
};
