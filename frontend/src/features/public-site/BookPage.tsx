import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { createBooking, fetchClubPoints, fetchSavedPassengers, fetchSeatMap } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import type { CabinClass, SavedPassenger, SeatMapCell } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';
import BookSeatMap from '../../components/public/checkout/BookSeatMap';
import { useIsMobile } from '../../hooks/useIsMobile';
import SavedPassengerAutofill, { savedPassengerToDraft } from './SavedPassengerAutofill';

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
    business: string;
    available: string;
    reserved: string;
    selectedSeat: string;
    none: string;
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
    business: 'بیزینس',
    available: 'آزاد',
    reserved: 'رزرو شده',
    selectedSeat: 'صندلی انتخاب‌شده',
    none: '—',
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
    business: 'Business',
    available: 'Available',
    reserved: 'Taken',
    selectedSeat: 'Selected seat',
    none: '—',
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
    business: 'درجة الأعمال',
    available: 'متاح',
    reserved: 'محجوز',
    selectedSeat: 'المقعد المختار',
    none: '—',
  },
};

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
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.otpPhonePlaceholder}
            className="rounded-lg border border-[#eef1f5] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
          <button type="submit" className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white">
            {t.otpRequest}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-3">
          <input
            data-testid="otp-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t.otpCodePlaceholder}
            className="font-num rounded-lg border border-[#eef1f5] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
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
  const isMobile = useIsMobile();

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
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: isMobile ? '12px 16px 32px' : '16px 26px 39px',
        }}
      >
        <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: '#0d2640' }}>{t.title}</h1>
        {cabin === 'BUSINESS' && businessLocked && (
          <p
            data-testid="business-seat-lock"
            style={{ margin: '0 0 16px', fontSize: 10.5, fontWeight: 600, color: '#96701a' }}
          >
            {t.businessLock}
          </p>
        )}
        {error && (
          <p style={{ marginBottom: 16, borderRadius: 10, background: '#fef2f2', padding: 12, fontSize: 12, color: '#dc2626' }}>
            {error}
          </p>
        )}

        {seats === null ? (
          <p style={{ fontSize: 14, color: '#6b7b94' }}>{t.seatMapLoading}</p>
        ) : (
          <section
            style={{
              marginBottom: 24,
              background: '#fff',
              border: '1px solid #eef1f5',
              borderRadius: 15,
              padding: '16px 17px',
            }}
          >
            <BookSeatMap
              seats={seats}
              selectedSeats={selectedSeats}
              businessLocked={businessLocked}
              labels={{
                business: t.business,
                available: t.available,
                reserved: t.reserved,
                selectedSeat: t.selectedSeat,
                none: t.none,
              }}
              onToggle={toggleSeat}
            />
          </section>
        )}

        {selectedSeats.length > 0 && (
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SavedPassengerAutofill
              passengers={savedPassengers}
              activeIndex={activePassengerIndex}
              usedIds={usedSavedIds}
              onSelect={applySavedPassenger}
            />
            {passengers.map((p, i) => (
              <div
                key={selectedSeats[i]}
                style={{
                  borderRadius: 13,
                  border: activePassengerIndex === i ? '1px solid #1668c4' : '1px solid #eef1f5',
                  background: '#fff',
                  padding: 16,
                  boxShadow: activePassengerIndex === i ? '0 0 0 1px #1668c4' : undefined,
                }}
                onFocusCapture={() => setActivePassengerIndex(i)}
              >
                <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#6b7b94' }}>
                  {t.passengerSeat(selectedSeats[i])}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
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
                    style={{
                      borderRadius: 10,
                      border: '1.5px solid #e2e7ee',
                      padding: '10px 14px',
                      fontSize: 14,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
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
                    className="font-num"
                    style={{
                      borderRadius: 10,
                      border: '1.5px solid #e2e7ee',
                      padding: '10px 14px',
                      fontSize: 14,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
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
                    className="font-num"
                    style={{
                      borderRadius: 10,
                      border: '1.5px solid #e2e7ee',
                      padding: '10px 14px',
                      fontSize: 14,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={submitting}
              data-testid="book-submit"
              style={{
                borderRadius: 14,
                background: '#1668c4',
                color: '#fff',
                border: 'none',
                padding: '14px 24px',
                fontSize: 15,
                fontWeight: 800,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                fontFamily: 'inherit',
                boxShadow: '0 12px 24px -12px rgba(22,104,196,.55)',
              }}
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </form>
        )}
      </div>
    </PublicPageShell>
  );
}
