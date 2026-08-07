// صندلی‌های تخصیص‌یافته — real per-flight allotments (Phase 16), replacing
// the earlier mock/sample data with GET /agency-portal/allotments. The
// info banner and Allocated/Sold/Remaining labels reuse
// design-reference-v2/پنل آژانس.dc.html's own isEN vocabulary for this
// exact tab (seatsInfoBanner, allocatedLabel, soldLabel, remainingLabel);
// AR has no counterpart there and is hand-translated.
import { useEffect, useState } from 'react';
import { createAllotmentBooking, fetchAllotments } from '../../api/agency-portal';
import { fetchSeatMap } from '../../api/publicSite';
import { faDigits } from '../../lib/fa-format';
import { publicCabinLabel } from '../../lib/flight-definition';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyAllotmentRow } from '../../types/agency-portal';
import type { CabinClass, SeatMapResult } from '../../types/public-site';

const STR: Record<
  StoredLocale,
  {
    infoBanner: string;
    errorFallback: string;
    empty: string;
    activeBadge: string;
    releasedBadge: string;
    allocatedLabel: string;
    soldLabel: string;
    remainingLabel: string;
    sell: string;
    passengerName: string;
    nationalId: string;
    mobile: string;
    cabin: string;
    seat: string;
    issue: string;
    cancel: string;
  }
> = {
  fa: {
    infoBanner:
      'صندلی‌های تخصیص‌یافته از سوی ایرلاین بر اساس میزان تقاضای آژانس شما، برای پروازهایی که مجوز پرواز آن‌ها صادر شده است. این ظرفیت برای فروش در اختیار شما قرار گرفته است.',
    errorFallback: 'خطا در دریافت سهمیه‌های صندلی.',
    empty: 'هنوز سهمیه‌ای برای آژانس شما ثبت نشده است.',
    activeBadge: 'فعال',
    releasedBadge: 'آزادشده',
    allocatedLabel: 'تخصیص‌یافته',
    soldLabel: 'فروخته',
    remainingLabel: 'باقی‌مانده',
    sell: 'ثبت فروش',
    passengerName: 'نام و نام خانوادگی مسافر',
    nationalId: 'کد ملی',
    mobile: 'شماره موبایل',
    cabin: 'کلاس پروازی',
    seat: 'صندلی',
    issue: 'صدور قطعی بلیت',
    cancel: 'انصراف',
  },
  en: {
    infoBanner:
      "Seats allocated by the airline based on your agency's demand, for flights whose operating license has been issued. This capacity is available for you to sell.",
    errorFallback: 'Error loading seat allotments.',
    empty: 'No allotment has been recorded for your agency yet.',
    activeBadge: 'Active',
    releasedBadge: 'Released',
    allocatedLabel: 'Allocated',
    soldLabel: 'Sold',
    remainingLabel: 'Remaining',
    sell: 'Sell ticket',
    passengerName: 'Passenger full name',
    nationalId: 'National ID',
    mobile: 'Mobile',
    cabin: 'Cabin',
    seat: 'Seat',
    issue: 'Issue ticket',
    cancel: 'Cancel',
  },
  ar: {
    infoBanner:
      'مقاعد مخصصة من شركة الطيران بناءً على طلب وكالتك، للرحلات التي صدر لها تصريح تشغيل. هذه السعة متاحة لك للبيع.',
    errorFallback: 'خطأ في تحميل حصص المقاعد.',
    empty: 'لم يتم تسجيل أي حصة لوكالتك بعد.',
    activeBadge: 'نشط',
    releasedBadge: 'مُحرَّر',
    allocatedLabel: 'مخصَّص',
    soldLabel: 'مباع',
    remainingLabel: 'متبقٍ',
    sell: 'تسجيل البيع',
    passengerName: 'اسم المسافر الكامل',
    nationalId: 'رقم الهوية',
    mobile: 'رقم الجوال',
    cabin: 'الدرجة',
    seat: 'المقعد',
    issue: 'إصدار التذكرة',
    cancel: 'إلغاء',
  },
};

export default function AgencySeatsPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [rows, setRows] = useState<AgencyAllotmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMapResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    nationalId: '',
    mobile: '',
    cabin: 'ECONOMY' as CabinClass,
    seatCode: '',
  });

  async function reload() {
    setRows(await fetchAllotments());
  }

  useEffect(() => {
    fetchAllotments()
      .then(setRows)
      .catch(() => setError(t.errorFallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openSale(row: AgencyAllotmentRow) {
    setError(null);
    setNotice(null);
    setSelectedId(row.id);
    setSeatMap(null);
    setForm({
      fullName: '',
      nationalId: '',
      mobile: '',
      cabin: 'ECONOMY',
      seatCode: '',
    });
    try {
      setSeatMap(await fetchSeatMap(row.flightInstanceId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.errorFallback);
      setSelectedId(null);
    }
  }

  async function submitSale(row: AgencyAllotmentRow) {
    if (!form.fullName.trim() || !form.seatCode) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await createAllotmentBooking(
        row.id,
        {
          cabin: form.cabin,
          passengers: [
            {
              fullName: form.fullName.trim(),
              nationalId: form.nationalId.trim() || undefined,
              mobile: form.mobile.trim() || undefined,
              seatCode: form.seatCode,
            },
          ],
        },
        crypto.randomUUID(),
      );
      setNotice(`بلیت با کد رزرو ${booking.pnr} با موفقیت صادر شد.`);
      setSelectedId(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خطا در صدور بلیت.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-5 rounded-xl border border-[#d6e4f8] bg-[#f2f7fd] p-4 text-xs leading-6 text-[#3f546b]">
        {t.infoBanner}
      </div>

      {error && <p className="mb-4 text-xs text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-xl bg-[#e8f5ee] p-3 text-xs font-bold text-[#1f8a5b]">{notice}</p>}

      {rows && rows.length === 0 && <p className="text-center text-xs text-muted">{t.empty}</p>}

      <div className="flex flex-col gap-4">
        {(rows ?? []).map((f) => {
          const left = Math.max(f.seatsAllocated - f.seatsUsed, 0);
          return (
            <div
              key={f.id}
              data-testid="alloc-card"
              className="rounded-2xl border border-[#e8eef6] bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f7fd] text-base">
                    ✈
                  </span>
                  <div>
                    <div className="text-sm font-black text-[#0d2640]">{f.route}</div>
                    <div className="mt-0.5 text-[11px] text-[#8a96a6]">
                      <span dir="ltr">{f.flightNo}</span> · {formatJalaliDateTime(f.departureAt)}
                    </div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10.5px] font-extrabold ${
                    f.active ? 'bg-[#e8f5ee] text-[#1f8a5b]' : 'bg-surface text-muted'
                  }`}
                >
                  {f.active ? t.activeBadge : t.releasedBadge}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    [t.allocatedLabel, f.seatsAllocated, '#1668c4'],
                    [t.soldLabel, f.seatsUsed, '#1f8a5b'],
                    [t.remainingLabel, left, left === 0 ? '#d64545' : '#0d2640'],
                  ] as const
                ).map(([label, val, color]) => (
                  <div key={label} className="rounded-xl border border-[#eef1f5] bg-[#fafbfd] p-3 text-center">
                    <div className="mb-1 text-[10.5px] text-[#8a96a6]">{label}</div>
                    <div className="text-lg font-black" style={{ color }}>
                      {faDigits(val)}
                    </div>
                  </div>
                ))}
              </div>

              {f.active && left > 0 && selectedId !== f.id && (
                <button
                  type="button"
                  onClick={() => void openSale(f)}
                  className="mt-4 w-full rounded-xl bg-[#1668c4] px-4 py-3 text-xs font-black text-white"
                >
                  {t.sell}
                </button>
              )}

              {selectedId === f.id && (
                <div className="mt-4 rounded-xl border border-[#d6e4f8] bg-[#f8fbff] p-4">
                  {!seatMap ? (
                    <p className="text-center text-xs text-muted">در حال دریافت صندلی‌های آزاد…</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-[11px] font-bold text-[#3f546b] sm:col-span-2">
                        {t.passengerName}
                        <input
                          value={form.fullName}
                          onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-[#d6e4f8] bg-white p-2.5 text-sm outline-none"
                        />
                      </label>
                      <label className="text-[11px] font-bold text-[#3f546b]">
                        {t.nationalId}
                        <input
                          dir="ltr"
                          value={form.nationalId}
                          onChange={(event) => setForm({ ...form, nationalId: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-[#d6e4f8] bg-white p-2.5 text-sm outline-none"
                        />
                      </label>
                      <label className="text-[11px] font-bold text-[#3f546b]">
                        {t.mobile}
                        <input
                          dir="ltr"
                          value={form.mobile}
                          onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-[#d6e4f8] bg-white p-2.5 text-sm outline-none"
                        />
                      </label>
                      <label className="text-[11px] font-bold text-[#3f546b]">
                        {t.cabin}
                        <select
                          value={form.cabin}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              cabin: event.target.value as CabinClass,
                              seatCode: '',
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-[#d6e4f8] bg-white p-2.5 text-sm outline-none"
                        >
                          <option value="ECONOMY">
                            {publicCabinLabel('ECONOMY', locale)}
                          </option>
                          <option value="COMFORT">
                            {publicCabinLabel('COMFORT', locale)}
                          </option>
                          <option value="BUSINESS">
                            {publicCabinLabel('BUSINESS', locale)}
                          </option>
                        </select>
                      </label>
                      <label className="text-[11px] font-bold text-[#3f546b]">
                        {t.seat}
                        <select
                          value={form.seatCode}
                          onChange={(event) => setForm({ ...form, seatCode: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-[#d6e4f8] bg-white p-2.5 text-sm outline-none"
                        >
                          <option value="">—</option>
                          {seatMap.seats
                            .filter((seat) => seat.status === 'FREE' && seat.cabin === form.cabin)
                            .map((seat) => (
                              <option key={seat.seatCode} value={seat.seatCode}>
                                {seat.seatCode}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="flex gap-2 sm:col-span-2">
                        <button
                          type="button"
                          disabled={busy || !form.fullName.trim() || !form.seatCode}
                          onClick={() => void submitSale(f)}
                          className="flex-1 rounded-lg bg-[#1f8a5b] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                        >
                          {t.issue}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setSelectedId(null)}
                          className="rounded-lg border border-[#d6e4f8] bg-white px-4 py-2.5 text-xs font-bold text-[#3f546b]"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
