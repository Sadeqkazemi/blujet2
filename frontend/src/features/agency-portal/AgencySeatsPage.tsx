// صندلی‌های تخصیص‌یافته — real per-flight allotments (Phase 16), replacing
// the earlier mock/sample data with GET /agency-portal/allotments. The
// info banner and Allocated/Sold/Remaining labels reuse
// design-reference-v2/پنل آژانس.dc.html's own isEN vocabulary for this
// exact tab (seatsInfoBanner, allocatedLabel, soldLabel, remainingLabel);
// AR has no counterpart there and is hand-translated.
import { useEffect, useState } from 'react';
import {
  createAllotmentBooking,
  fetchAllotments,
  fetchSeatRequestOptions,
  requestAgencySeats,
} from '../../api/agency-portal';
import { fetchSeatMap } from '../../api/publicSite';
import { publicCabinLabel } from '../../lib/flight-definition';
import { formatLocaleDateTime, localeDigits } from '../../lib/locale-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyAllotmentRow } from '../../types/agency-portal';
import type { AgencySeatRequestOption } from '../../types/agency-portal';
import { airportCityLabel } from '../../lib/airport-cities';
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
  const [requestOptions, setRequestOptions] = useState<AgencySeatRequestOption[] | null>(null);
  const [originCode, setOriginCode] = useState('');
  const [destCode, setDestCode] = useState('');
  const [requestFlightId, setRequestFlightId] = useState('');
  const [requestedSeats, setRequestedSeats] = useState(1);
  const [preferredWeekdays, setPreferredWeekdays] = useState<number[]>([]);
  const [termMonths, setTermMonths] = useState<3 | 6 | 12>(3);
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
    Promise.all([fetchAllotments(), fetchSeatRequestOptions()])
      .then(([allotments, options]) => {
        setRows(allotments);
        setRequestOptions(options);
      })
      .catch(() => setError(t.errorFallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origins = Array.from(new Set((requestOptions ?? []).map((row) => row.originCode)));
  const destinations = Array.from(
    new Set(
      (requestOptions ?? [])
        .filter((row) => !originCode || row.originCode === originCode)
        .map((row) => row.destCode),
    ),
  );
  const matchingFlights = (requestOptions ?? []).filter(
    (row) => row.originCode === originCode && row.destCode === destCode,
  );
  const requestFlight = matchingFlights.find((row) => row.flightInstanceId === requestFlightId) ?? null;

  async function submitSeatRequest() {
    if (!requestFlight || requestedSeats < 1) return;
    setBusy(true);
    setError(null);
    try {
      await requestAgencySeats({
        flightInstanceId: requestFlight.flightInstanceId,
        seats: requestedSeats,
        preferredWeekdays,
        termMonths,
      });
      setNotice(
        locale === 'en'
          ? 'Your seat request was sent to the commercial manager.'
          : locale === 'ar'
            ? 'تم إرسال طلب المقاعد إلى المدير التجاري.'
            : 'درخواست صندلی با موفقیت برای مدیر بازرگانی ارسال شد.',
      );
      setRequestedSeats(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.errorFallback);
    } finally {
      setBusy(false);
    }
  }

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
      <section
        className="mb-5 rounded-2xl border border-[#e1e8f2] bg-white p-5 shadow-sm"
        data-testid="agency-seat-request-panel"
      >
        <div className="mb-4">
          <h2 className="text-base font-black text-[#0d2640]">
            {locale === 'en' ? 'Request allocated seats' : locale === 'ar' ? 'طلب مقاعد مخصصة' : 'درخواست صندلی اختصاصی'}
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-[#7d8ba0]">
            {locale === 'en'
              ? 'Choose an active route and flight; the request will be sent to the commercial manager.'
              : locale === 'ar'
                ? 'اختر المسار والرحلة النشطة لإرسال الطلب إلى المدير التجاري.'
                : 'مبدأ و مقصد از مسیرهای فعال مدیر بازرگانی بارگذاری می‌شود؛ سپس پرواز و تعداد صندلی را انتخاب کنید.'}
          </p>
        </div>

        <div
          className={`grid gap-3 ${matchingFlights.length > 1 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
        >
          <label className="text-[11px] font-bold text-[#3f546b]">
            {locale === 'en' ? 'Origin' : locale === 'ar' ? 'المغادرة' : 'مبدأ'}
            <select
              value={originCode}
              onChange={(event) => {
                setOriginCode(event.target.value);
                setDestCode('');
                setRequestFlightId('');
              }}
              className="mt-1 w-full rounded-xl border border-[#d6e4f8] bg-white p-3 text-sm outline-none"
              data-testid="agency-request-origin"
            >
              <option value="">—</option>
              {origins.map((code) => <option key={code} value={code}>{airportCityLabel(code, locale)}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-bold text-[#3f546b]">
            {locale === 'en' ? 'Destination' : locale === 'ar' ? 'الوجهة' : 'مقصد'}
            <select
              value={destCode}
              disabled={!originCode}
              onChange={(event) => {
                const nextDest = event.target.value;
                setDestCode(nextDest);
                const firstFlight = (requestOptions ?? []).find(
                  (row) => row.originCode === originCode && row.destCode === nextDest,
                );
                setRequestFlightId(firstFlight?.flightInstanceId ?? '');
              }}
              className="mt-1 w-full rounded-xl border border-[#d6e4f8] bg-white p-3 text-sm outline-none disabled:bg-[#f4f6f9]"
              data-testid="agency-request-destination"
            >
              <option value="">—</option>
              {destinations.map((code) => <option key={code} value={code}>{airportCityLabel(code, locale)}</option>)}
            </select>
          </label>
          <label
            className={`text-[11px] font-bold text-[#3f546b] ${matchingFlights.length <= 1 ? 'hidden' : ''}`}
          >
            {locale === 'en' ? 'Flight' : locale === 'ar' ? 'الرحلة' : 'پرواز'}
            <select
              value={requestFlightId}
              disabled={!destCode}
              onChange={(event) => setRequestFlightId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d6e4f8] bg-white p-3 text-sm outline-none disabled:bg-[#f4f6f9]"
              data-testid="agency-request-flight"
            >
              <option value="">—</option>
              {matchingFlights.map((row) => (
                <option key={row.flightInstanceId} value={row.flightInstanceId}>
                  {row.flightNo} · {formatLocaleDateTime(row.departureAt, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {requestFlight && (
          <div className="mt-4 rounded-2xl border border-[#d6e4f8] bg-[#f8fbff] p-4" data-testid="agency-request-flight-detail">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-black text-[#0d2640]">
                  {airportCityLabel(requestFlight.originCode, locale)} ← {airportCityLabel(requestFlight.destCode, locale)}
                </div>
                <div className="mt-1 text-[11px] text-[#7d8ba0]" dir="ltr">
                  {requestFlight.flightNo} · {requestFlight.aircraftType}
                </div>
              </div>
              <div className="grid min-w-[280px] flex-1 grid-cols-3 gap-2 md:max-w-[520px]">
                {[
                  [locale === 'en' ? 'Capacity' : locale === 'ar' ? 'السعة' : 'ظرفیت کل', requestFlight.capacity],
                  [locale === 'en' ? 'Allocated' : locale === 'ar' ? 'المخصص' : 'تخصیص‌یافته', requestFlight.agencyAllocated],
                  [locale === 'en' ? 'Available' : locale === 'ar' ? 'المتاح للطلب' : 'قابل درخواست', requestFlight.availableToRequest],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-white p-3 text-center">
                    <div className="text-[10px] text-[#7d8ba0]">{label}</div>
                    <div className="mt-1 text-lg font-black text-[#1668c4]">{localeDigits(value as number, locale)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr]">
              <label className="text-[11px] font-bold text-[#3f546b]">
                {locale === 'en' ? 'Seats needed' : locale === 'ar' ? 'عدد المقاعد المطلوبة' : 'تعداد صندلی مورد نیاز'}
                <input
                  type="number"
                  min={1}
                  max={requestFlight.availableToRequest}
                  value={requestedSeats}
                  onChange={(event) => setRequestedSeats(Math.max(1, Number(event.target.value) || 1))}
                  className="mt-1 w-full rounded-xl border border-[#d6e4f8] bg-white p-3 text-sm outline-none"
                  data-testid="agency-request-seat-count"
                />
              </label>
              <fieldset className="text-[11px] font-bold text-[#3f546b]">
                <legend>{locale === 'en' ? 'Preferred days' : locale === 'ar' ? 'الأيام المفضلة' : 'روزهای ترجیحی'}</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[['شنبه', 6], ['یکشنبه', 0], ['دوشنبه', 1], ['سه‌شنبه', 2], ['چهارشنبه', 3], ['پنجشنبه', 4]].map(([label, day]) => {
                    const selected = preferredWeekdays.includes(day as number);
                    return <button key={String(day)} type="button" onClick={() => setPreferredWeekdays(selected ? preferredWeekdays.filter((v) => v !== day) : [...preferredWeekdays, day as number])} className={`rounded-lg border px-3 py-2 ${selected ? 'border-[#1668c4] bg-[#eef5ff] text-[#1668c4]' : 'border-[#d6e4f8] bg-white'}`}>{label}</button>;
                  })}
                </div>
              </fieldset>
              <label className="text-[11px] font-bold text-[#3f546b]">
                {locale === 'en' ? 'Purchase term' : locale === 'ar' ? 'مدة الشراء' : 'دوره خرید'}
                <select value={termMonths} onChange={(event) => setTermMonths(Number(event.target.value) as 3 | 6 | 12)} className="mt-1 w-full rounded-xl border border-[#d6e4f8] bg-white p-3 text-sm outline-none">
                  <option value={3}>{locale === 'en' ? '3 months' : locale === 'ar' ? '٣ أشهر' : 'سه‌ماهه'}</option>
                  <option value={6}>{locale === 'en' ? '6 months' : locale === 'ar' ? '٦ أشهر' : 'شش‌ماهه'}</option>
                  <option value={12}>{locale === 'en' ? '12 months' : locale === 'ar' ? 'سنة واحدة' : 'یک‌ساله'}</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={busy || requestedSeats > requestFlight.availableToRequest || requestFlight.availableToRequest < 1}
              onClick={() => void submitSeatRequest()}
              className="mt-4 w-full rounded-xl bg-[#1668c4] px-4 py-3 text-xs font-black text-white disabled:opacity-50"
              data-testid="agency-submit-seat-request"
            >
              {locale === 'en' ? 'Send request to commercial manager' : locale === 'ar' ? 'إرسال الطلب إلى المدير التجاري' : 'ارسال درخواست به مدیر بازرگانی'}
            </button>
          </div>
        )}

        {requestOptions?.length === 0 && (
          <p className="rounded-xl bg-[#f7f9fc] p-4 text-center text-xs text-[#7d8ba0]">
            {locale === 'en' ? 'No scheduled flight route is available.' : locale === 'ar' ? 'لا يوجد مسار رحلة مجدول متاح حاليًا.' : 'هنوز مسیر پروازی زمان‌بندی‌شده‌ای برای درخواست وجود ندارد.'}
          </p>
        )}
      </section>

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
                      <span dir="ltr">{f.flightNo}</span> · {formatLocaleDateTime(f.departureAt, locale)}
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
                      {localeDigits(val, locale)}
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
