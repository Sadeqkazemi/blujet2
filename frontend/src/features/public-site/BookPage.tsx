import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createBooking, fetchClubPoints, fetchSeatMap } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import type { CabinClass, SeatMapCell } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';

// Business seat selection is a design-confirmed perk gate: at least 15,000
// club points (the پلاتین threshold) are required, matching the design's
// «انتخاب صندلی بیزینس نیازمند حداقل ۱۵٬۰۰۰ امتیاز باشگاه است» note.
const BUSINESS_SEAT_MIN_POINTS = 15_000;

function OtpLoginInline() {
  const { requestOtp, verifyOtp } = useAuth();
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
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ارسال کد.');
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await verifyOtp!(challengeId!, code);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'کد نامعتبر است.');
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-[#e5e9f0] bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-extrabold text-[#0d2640]">ورود با شماره موبایل</h2>
      <p className="mb-4 text-xs text-[#6b7b94]">برای ادامه رزرو، شماره موبایل خود را تأیید کنید.</p>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600">{error}</p>}
      {!challengeId ? (
        <form onSubmit={onRequest} className="flex flex-col gap-3">
          <input
            data-testid="otp-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09121234567"
            className="rounded-lg border border-[#e5e9f0] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
          <button type="submit" className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white">
            دریافت کد
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-3">
          <input
            data-testid="otp-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="کد ۶ رقمی"
            className="font-num rounded-lg border border-[#e5e9f0] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
          <button type="submit" className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white">
            تأیید و ورود
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
  const navigate = useNavigate();

  const [seats, setSeats] = useState<SeatMapCell[] | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<PassengerDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clubBalance, setClubBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!flightInstanceId) return;
    fetchSeatMap(flightInstanceId)
      .then((m) => setSeats(m.seats.filter((s) => s.cabin === cabin)))
      .catch(() => setError('خطا در دریافت نقشه صندلی.'));
  }, [flightInstanceId, cabin]);

  useEffect(() => {
    if (status !== 'authenticated' || cabin !== 'BUSINESS') return;
    fetchClubPoints()
      .then((c) => setClubBalance(c.balance))
      .catch(() => setClubBalance(0));
  }, [status, cabin]);

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
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedSeats.length === 0) {
      setError('حداقل یک صندلی انتخاب کنید.');
      return;
    }
    if (passengers.some((p) => !p.fullName.trim())) {
      setError('نام همه مسافران را وارد کنید.');
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
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ثبت رزرو.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>
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
      <h1 className="mb-1 text-lg font-extrabold text-[#0d2640]">انتخاب صندلی و اطلاعات مسافران</h1>
      {cabin === 'BUSINESS' && businessLocked && (
        <p data-testid="business-seat-lock" className="mb-4 text-[10.5px] font-semibold text-[#96701a]">
          🔒 انتخاب صندلی بیزینس نیازمند حداقل ۱۵٬۰۰۰ امتیاز باشگاه است
        </p>
      )}
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

      {seats === null ? (
        <p className="text-sm text-[#6b7b94]">در حال بارگذاری نقشه صندلی…</p>
      ) : (
        <div className="mb-6 flex flex-wrap gap-2" data-testid="seat-grid">
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
                    : 'border border-[#e5e9f0] bg-white text-[#0d2640] hover:border-[#1668c4]'
              }`}
            >
              {s.seatCode}
            </button>
          ))}
        </div>
      )}

      {selectedSeats.length > 0 && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {passengers.map((p, i) => (
            <div key={selectedSeats[i]} className="rounded-xl border border-[#e5e9f0] bg-white p-4">
              <div className="mb-2 text-xs font-bold text-[#6b7b94]">مسافر صندلی {selectedSeats[i]}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  data-testid={`pax-name-${i}`}
                  value={p.fullName}
                  onChange={(e) =>
                    setPassengers((arr) => arr.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)))
                  }
                  placeholder="نام و نام خانوادگی"
                  className="rounded-lg border border-[#e5e9f0] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                />
                <input
                  value={p.nationalId}
                  onChange={(e) =>
                    setPassengers((arr) => arr.map((x, j) => (j === i ? { ...x, nationalId: e.target.value } : x)))
                  }
                  placeholder="کد ملی (اختیاری)"
                  className="font-num rounded-lg border border-[#e5e9f0] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                />
                <input
                  value={p.mobile}
                  onChange={(e) =>
                    setPassengers((arr) => arr.map((x, j) => (j === i ? { ...x, mobile: e.target.value } : x)))
                  }
                  placeholder="موبایل (اختیاری)"
                  className="font-num rounded-lg border border-[#e5e9f0] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                />
              </div>
            </div>
          ))}
          <button
            type="submit"
            disabled={submitting}
            data-testid="book-submit"
            className="rounded-lg bg-[#1668c4] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? 'در حال ثبت…' : 'ادامه به پرداخت'}
          </button>
        </form>
      )}
    </div>
    </PublicPageShell>
  );
}
