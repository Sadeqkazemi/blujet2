import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { createBooking, fetchClubPoints, fetchSavedPassengers, fetchSeatMap } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import type { CabinClass, SavedPassenger, SeatMapCell } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';
import SavedPassengerAutofill, { savedPassengerToDraft } from './SavedPassengerAutofill';
import { latinDigits } from '../../lib/fa-format';

const BUSINESS_SEAT_MIN_POINTS = 15_000;

const STR: Record<
  StoredLocale,
  {
    loading: string;
    otpTitle: string;
    otpSub: string;
    otpRequest: string;
    otpVerify: string;
    otpPhonePlaceholder: string;
    otpCodePlaceholder: string;
    otpSendError: string;
    otpInvalid: string;
    title: string;
    businessLock: string;
    seatMapLoading: string;
    seatMapError: string;
    passengerSeat: (seat: string) => string;
    namePlaceholder: string;
    nationalIdPlaceholder: string;
    mobilePlaceholder: string;
    noSeat: string;
    noName: string;
    submit: string;
    submitting: string;
    bookError: string;
  }
> = {
  fa: {
    loading: 'در حال بارگذاری…',
    otpTitle: 'ورود با شماره موبایل',
    otpSub: 'برای ادامه رزرو، شماره موبایل خود را تأیید کنید.',
    otpRequest: 'دریافت کد',
    otpVerify: 'تأیید و ورود',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: 'کد ۶ رقمی',
    otpSendError: 'خطا در ارسال کد.',
    otpInvalid: 'کد نامعتبر است.',
    title: 'انتخاب صندلی و اطلاعات مسافران',
    businessLock: '🔒 انتخاب صندلی بیزینس نیازمند حداقل ۱۵٬۰۰۰ امتیاز باشگاه است',
    seatMapLoading: 'در حال بارگذاری نقشه صندلی…',
    seatMapError: 'خطا در دریافت نقشه صندلی.',
    passengerSeat: (seat) => `مسافر صندلی ${seat}`,
    namePlaceholder: 'نام و نام خانوادگی',
    nationalIdPlaceholder: 'کد ملی (اختیاری)',
    mobilePlaceholder: 'موبایل (اختیاری)',
    noSeat: 'حداقل یک صندلی انتخاب کنید.',
    noName: 'نام همه مسافران را وارد کنید.',
    submit: 'ادامه به تکمیل خرید',
    submitting: 'در حال ثبت…',
    bookError: 'خطا در ثبت رزرو.',
  },
  en: {
    loading: 'Loading…',
    otpTitle: 'Sign in with mobile',
    otpSub: 'Verify your mobile number to continue booking.',
    otpRequest: 'Send code',
    otpVerify: 'Verify & sign in',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: '6-digit code',
    otpSendError: 'Failed to send code.',
    otpInvalid: 'Invalid code.',
    title: 'Seat selection & passenger details',
    businessLock: '🔒 Business seat selection requires at least 15,000 club points',
    seatMapLoading: 'Loading seat map…',
    seatMapError: 'Failed to load seat map.',
    passengerSeat: (seat) => `Passenger — seat ${seat}`,
    namePlaceholder: 'Full name',
    nationalIdPlaceholder: 'National ID (optional)',
    mobilePlaceholder: 'Mobile (optional)',
    noSeat: 'Select at least one seat.',
    noName: 'Enter a name for every passenger.',
    submit: 'Continue to checkout',
    submitting: 'Saving…',
    bookError: 'Failed to create booking.',
  },
  ar: {
    loading: 'جارٍ التحميل…',
    otpTitle: 'تسجيل الدخول برقم الجوال',
    otpSub: 'تحقق من رقم جوالك لمتابعة الحجز.',
    otpRequest: 'إرسال الرمز',
    otpVerify: 'تأكيد وتسجيل الدخول',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: 'رمز من ٦ أرقام',
    otpSendError: 'فشل إرسال الرمز.',
    otpInvalid: 'رمز غير صالح.',
    title: 'اختيار المقعد وبيانات المسافرين',
    businessLock: '🔒 اختيار مقعد درجة الأعمال يتطلب ١٥٬٠٠٠ نقطة على الأقل',
    seatMapLoading: 'جارٍ تحميل خريطة المقاعد…',
    seatMapError: 'فشل تحميل خريطة المقاعد.',
    passengerSeat: (seat) => `مسافر — مقعد ${seat}`,
    namePlaceholder: 'الاسم الكامل',
    nationalIdPlaceholder: 'الرقم الوطني (اختياري)',
    mobilePlaceholder: 'الجوال (اختياري)',
    noSeat: 'اختر مقعداً واحداً على الأقل.',
    noName: 'أدخل اسم كل مسافر.',
    submit: 'المتابعة إلى إتمام الشراء',
    submitting: 'جارٍ الحفظ…',
    bookError: 'فشل إنشاء الحجز.',
  },
};

function sanitizeMobileInput(raw: string) {
  return latinDigits(raw).replace(/[^\d]/g, '').slice(0, 11);
}

function sanitizeOtpInput(raw: string) {
  return latinDigits(raw).replace(/\D/g, '').slice(0, 6);
}

function OtpLoginInline() {
  const { requestOtp, verifyOtp } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const id = await requestOtp!(phone);
      setChallengeId(id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.otpSendError);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await verifyOtp!(challengeId!, code);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.otpInvalid);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-[#eef1f5] bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-extrabold text-[#0d2640]">{t.otpTitle}</h2>
      <p className="mb-4 text-xs text-[#6b7b94]">{t.otpSub}</p>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600">{error}</p>}
      {!challengeId ? (
        <form onSubmit={onRequest} className="flex flex-col gap-3">
          <input
            data-testid="otp-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(sanitizeMobileInput(e.target.value))}
            placeholder={t.otpPhonePlaceholder}
            className="rounded-lg border border-[#eef1f5] px-3.5 py-2.5 text-sm text-[#16202e] outline-none focus:border-[#1668c4]"
          />
          <button type="submit" className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white">
            {t.otpRequest}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-3">
          <input
            data-testid="otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            value={code}
            onChange={(e) => setCode(sanitizeOtpInput(e.target.value))}
            placeholder={t.otpCodePlaceholder}
            maxLength={6}
            className="font-num rounded-lg border border-[#eef1f5] px-3.5 py-2.5 text-sm text-[#16202e] outline-none focus:border-[#1668c4]"
          />
          {import.meta.env.DEV && (
            <p data-testid="otp-dev-hint" className="text-center text-[11px] text-[#6b7585]">
              {locale === 'en' ? 'Dev OTP code: 123456' : 'کد توسعه (OTP): ۱۲۳۴۵۶'}
            </p>
          )}
          <button type="submit" className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white">
            {t.otpVerify}
          </button>
        </form>
      )}
    </div>
  );
}

interface PassengerDraft {
  fullName: string;
  nationalId: string;
  mobile: string;
}

export default function BookPage() {
  const { flightInstanceId } = useParams<{ flightInstanceId: string }>();
  const [params] = useSearchParams();
  const cabin = (params.get('cabin') as CabinClass) ?? 'ECONOMY';
  const { status } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const navigate = useNavigate();

  const [seats, setSeats] = useState<SeatMapCell[] | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<PassengerDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clubBalance, setClubBalance] = useState<number | null>(null);
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[]>([]);
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);
  const [passengerSourceIds, setPassengerSourceIds] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (!flightInstanceId) return;
    fetchSeatMap(flightInstanceId)
      .then((m) => setSeats(m.seats.filter((s) => s.cabin === cabin)))
      .catch(() => setError(t.seatMapError));
  }, [flightInstanceId, cabin, t.seatMapError]);

  useEffect(() => {
    if (status !== 'authenticated' || cabin !== 'BUSINESS') return;
    fetchClubPoints()
      .then((c) => setClubBalance(c.balance))
      .catch(() => setClubBalance(0));
  }, [status, cabin]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchSavedPassengers()
      .then(setSavedPassengers)
      .catch(() => setSavedPassengers([]));
  }, [status]);

  const usedSavedIds = useMemo(
    () => new Set(passengerSourceIds.filter((id): id is string => Boolean(id))),
    [passengerSourceIds],
  );

  const businessLocked = cabin === 'BUSINESS' && (clubBalance ?? 0) < BUSINESS_SEAT_MIN_POINTS;

  function toggleSeat(seatCode: string) {
    setSelectedSeats((prev) => {
      const next = prev.includes(seatCode) ? prev.filter((s) => s !== seatCode) : [...prev, seatCode];
      setPassengers((p) => {
        const arr = [...p];
        while (arr.length < next.length) arr.push({ fullName: '', nationalId: '', mobile: '' });
        while (arr.length > next.length) arr.pop();
        return arr;
      });
      setPassengerSourceIds((ids) => {
        const arr = [...ids];
        while (arr.length < next.length) arr.push(null);
        while (arr.length > next.length) arr.pop();
        return arr;
      });
      if (next.length > 0 && activePassengerIndex >= next.length) {
        setActivePassengerIndex(next.length - 1);
      }
      return next;
    });
  }

  function applySavedPassenger(saved: SavedPassenger, index: number) {
    const draft = savedPassengerToDraft(saved);
    setPassengers((arr) => arr.map((x, j) => (j === index ? draft : x)));
    setPassengerSourceIds((arr) => arr.map((id, j) => (j === index ? saved.id : id)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedSeats.length === 0) {
      setError(t.noSeat);
      return;
    }
    if (passengers.some((p) => !p.fullName.trim())) {
      setError(t.noName);
      return;
    }
    setSubmitting(true);
    try {
      const booking = await createBooking({
        flightInstanceId: flightInstanceId!,
        cabin,
        passengers: passengers.map((p, i) => ({
          fullName: p.fullName,
          nationalId: p.nationalId || undefined,
          mobile: p.mobile || undefined,
          seatCode: selectedSeats[i],
        })),
      });
      navigate(`/checkout/${booking.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.bookError);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-[#6b7b94]">{t.loading}</p>
      </PublicPageShell>
    );
  }
  if (status === 'unauthenticated') {
    return (
      <PublicPageShell>
        <div className="p-6">
          <OtpLoginInline />
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <FlowStepper current="seat" onBack={() => navigate(-1)} />
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-1 text-lg font-extrabold text-[#0d2640]">{t.title}</h1>
        {cabin === 'BUSINESS' && businessLocked && (
          <p data-testid="business-seat-lock" className="mb-4 text-[10.5px] font-semibold text-[#96701a]">
            {t.businessLock}
          </p>
        )}
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

        {seats === null ? (
          <p className="text-sm text-[#6b7b94]">{t.seatMapLoading}</p>
        ) : (
          <div
            className="mb-6 rounded-2xl border border-[#eef1f5] bg-white p-4"
            data-testid="seat-grid"
          >
            <div className="flex flex-wrap gap-2">
              {seats.map((s) => (
                <button
                  key={s.seatCode}
                  type="button"
                  disabled={s.status === 'TAKEN' || businessLocked}
                  onClick={() => toggleSeat(s.seatCode)}
                  data-testid={`seat-${s.seatCode}`}
                  className={`font-num h-10 w-10 rounded-lg text-xs font-bold ${
                    s.status === 'TAKEN'
                      ? 'cursor-not-allowed bg-[#e5e9f0] text-[#9fb0c7]'
                      : selectedSeats.includes(s.seatCode)
                        ? 'bg-[#1668c4] text-white'
                        : 'border border-[#eef1f5] bg-white text-[#0d2640] hover:border-[#1668c4]'
                  }`}
                >
                  {s.seatCode}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSeats.length > 0 && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <SavedPassengerAutofill
              passengers={savedPassengers}
              activeIndex={activePassengerIndex}
              usedIds={usedSavedIds}
              onSelect={applySavedPassenger}
            />
            {passengers.map((p, i) => (
              <div
                key={selectedSeats[i]}
                className="rounded-2xl border border-[#eef1f5] bg-white p-4"
                style={
                  activePassengerIndex === i
                    ? { borderColor: '#1668c4', boxShadow: '0 0 0 1px #1668c4' }
                    : undefined
                }
                onFocusCapture={() => setActivePassengerIndex(i)}
              >
                <div className="mb-2 text-xs font-bold text-[#6b7b94]">
                  {t.passengerSeat(selectedSeats[i])}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    data-testid={`pax-name-${i}`}
                    value={p.fullName}
                    onChange={(e) => {
                      setPassengers((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)),
                      );
                      setPassengerSourceIds((arr) => arr.map((id, j) => (j === i ? null : id)));
                    }}
                    placeholder={t.namePlaceholder}
                    className="rounded-lg border border-[#eef1f5] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                  />
                  <input
                    data-testid={`pax-national-id-${i}`}
                    value={p.nationalId}
                    onChange={(e) => {
                      setPassengers((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, nationalId: e.target.value } : x)),
                      );
                      setPassengerSourceIds((arr) => arr.map((id, j) => (j === i ? null : id)));
                    }}
                    placeholder={t.nationalIdPlaceholder}
                    className="font-num rounded-lg border border-[#eef1f5] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                  />
                  <input
                    data-testid={`pax-mobile-${i}`}
                    value={p.mobile}
                    onChange={(e) => {
                      setPassengers((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, mobile: e.target.value } : x)),
                      );
                      setPassengerSourceIds((arr) => arr.map((id, j) => (j === i ? null : id)));
                    }}
                    placeholder={t.mobilePlaceholder}
                    className="font-num rounded-lg border border-[#eef1f5] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                  />
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={submitting}
              data-testid="book-submit"
              className="rounded-xl bg-[#1668c4] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </form>
        )}
      </div>
    </PublicPageShell>
  );
}
