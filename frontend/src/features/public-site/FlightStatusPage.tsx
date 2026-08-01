import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlightStatusHelpLinks from '../../components/public/flight-status/FlightStatusHelpLinks';
import FlightStatusNotFound from '../../components/public/flight-status/FlightStatusNotFound';
import FlightStatusResultCard from '../../components/public/flight-status/FlightStatusResultCard';
import FlightStatusSearchForm from '../../components/public/flight-status/FlightStatusSearchForm';
import { fetchAirports } from '../../api/publicSite';
import { lookupFlightStatus } from '../../api/flight-status';
import { ApiRequestError } from '../../api/envelope';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { dayjs } from '../../lib/jalali';
import type { Airport } from '../../types/public-site';
import type { FlightStatusResult } from '../../types/flight-status';

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const STATUS_LABEL_TR: Record<string, Tr> = {
  'برنامه‌ریزی‌شده': { fa: 'برنامه‌ریزی‌شده', en: 'Scheduled', ar: 'مجدولة' },
  'لغو شد': { fa: 'لغو شد', en: 'Cancelled', ar: 'ملغاة' },
  'فرود آمد': { fa: 'فرود آمد', en: 'Landed', ar: 'هبطت' },
  'در حال پرواز': { fa: 'در حال پرواز', en: 'In flight', ar: 'في الجو' },
};

function statusLabel(statusLabelFa: string, locale: StoredLocale): string {
  return STATUS_LABEL_TR[statusLabelFa]?.[locale] ?? statusLabelFa;
}

const CITY_NAMES: Record<string, Record<StoredLocale, string>> = {
  THR: { fa: 'تهران — مهرآباد', en: 'Tehran — Mehrabad', ar: 'طهران — مهرآباد' },
  MHD: { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' },
  IST: { fa: 'استانبول', en: 'Istanbul', ar: 'إسطنبول' },
  DXB: { fa: 'دبی', en: 'Dubai', ar: 'دبي' },
  KIH: { fa: 'کیش', en: 'Kish', ar: 'كيش' },
  SYZ: { fa: 'شیراز', en: 'Shiraz', ar: 'شيراز' },
};

function cityName(code: string, fallbackFa: string, locale: StoredLocale): string {
  return CITY_NAMES[code]?.[locale] ?? fallbackFa;
}

function todayIso() {
  return dayjs().toDate().toISOString();
}

const STR: Record<
  StoredLocale,
  {
    title: string;
    subtitle: string;
    liveBadge: string;
    modeFlightNo: string;
    modeRoute: string;
    flightNoFieldLabel: string;
    flightNoPlaceholder: string;
    originFieldLabel: string;
    destFieldLabel: string;
    selectPlaceholder: string;
    dateFieldLabel: string;
    searchBtn: string;
    searchingBtn: string;
    errorFallback: string;
    notFoundTitle: string;
    notFoundMsg: string;
    airlineName: string;
    terminalLabel: string;
    terminalTba: string;
    aircraftLabel: string;
    gateLabel: string;
    gateTba: string;
    beltLabel: string;
    beltTba: string;
    delayLabel: string;
    onTimeLabel: string;
    cancelledLabel: string;
    directLabel: string;
    delayAlertTitle: string;
    delayAlertSub: string;
    manageBookingTitle: string;
    manageBookingSub: string;
    support24Title: string;
    support24Sub: string;
  }
> = {
  fa: {
    title: 'وضعیت پرواز',
    subtitle: 'با شماره پرواز یا مسیر و تاریخ، آخرین وضعیت پرواز را ببینید.',
    liveBadge: 'به‌روزرسانی زنده',
    modeFlightNo: 'شماره پرواز',
    modeRoute: 'مبدأ و مقصد',
    flightNoFieldLabel: 'شماره پرواز',
    flightNoPlaceholder: 'مثلاً BJ-410',
    originFieldLabel: 'مبدأ',
    destFieldLabel: 'مقصد',
    selectPlaceholder: 'انتخاب کنید',
    dateFieldLabel: 'تاریخ',
    searchBtn: 'جستجو',
    searchingBtn: 'در حال جستجو…',
    errorFallback: 'خطا در جستجوی وضعیت پرواز.',
    notFoundTitle: 'پروازی یافت نشد',
    notFoundMsg: 'اطلاعات وارد‌شده با هیچ پروازی مطابقت ندارد. شماره پرواز یا مسیر و تاریخ را بررسی کنید.',
    airlineName: 'blujet',
    terminalLabel: 'ترمینال',
    terminalTba: 'اعلام می‌شود',
    aircraftLabel: 'هواپیما',
    gateLabel: 'گیت',
    gateTba: 'اعلام می‌شود',
    beltLabel: 'تحویل بار',
    beltTba: 'اعلام می‌شود',
    delayLabel: 'تأخیر',
    onTimeLabel: 'بدون تأخیر',
    cancelledLabel: 'لغوشده',
    directLabel: 'مستقیم',
    delayAlertTitle: 'اطلاع‌رسانی تأخیر',
    delayAlertSub: 'فعال‌سازی پیامک تغییر وضعیت پرواز',
    manageBookingTitle: 'مدیریت رزرو',
    manageBookingSub: 'تغییر صندلی، دانلود بلیط یا استرداد',
    support24Title: 'پشتیبانی ۲۴ ساعته',
    support24Sub: 'در صورت هرگونه سؤال با ما تماس بگیرید',
  },
  en: {
    title: 'Flight Status',
    subtitle: 'Check the latest status of your flight by flight number or route and date.',
    liveBadge: 'Live updates',
    modeFlightNo: 'Flight number',
    modeRoute: 'Origin & Destination',
    flightNoFieldLabel: 'Flight number',
    flightNoPlaceholder: 'e.g. BJ-410',
    originFieldLabel: 'From',
    destFieldLabel: 'To',
    selectPlaceholder: 'Select',
    dateFieldLabel: 'Date',
    searchBtn: 'Search',
    searchingBtn: 'Searching…',
    errorFallback: 'Error searching for flight status.',
    notFoundTitle: 'Flight not found',
    notFoundMsg: 'No flight matches the information entered. Please check the flight number or route and date.',
    airlineName: 'blujet',
    terminalLabel: 'Terminal',
    terminalTba: 'TBA',
    aircraftLabel: 'Aircraft',
    gateLabel: 'Gate',
    gateTba: 'TBA',
    beltLabel: 'Baggage belt',
    beltTba: 'TBA',
    delayLabel: 'Delay',
    onTimeLabel: 'On time',
    cancelledLabel: 'Cancelled',
    directLabel: 'Direct',
    delayAlertTitle: 'Delay notifications',
    delayAlertSub: 'Enable SMS alerts for flight status changes',
    manageBookingTitle: 'Manage booking',
    manageBookingSub: 'Change seat, download ticket or refund',
    support24Title: '24/7 support',
    support24Sub: 'Contact us with any question',
  },
  ar: {
    title: 'حالة الرحلة',
    subtitle: 'تحقق من آخر حالة لرحلتك عبر رقم الرحلة أو المسار والتاريخ.',
    liveBadge: 'تحديثات مباشرة',
    modeFlightNo: 'رقم الرحلة',
    modeRoute: 'المبدأ والوجهة',
    flightNoFieldLabel: 'رقم الرحلة',
    flightNoPlaceholder: 'مثلاً BJ-410',
    originFieldLabel: 'من',
    destFieldLabel: 'إلى',
    selectPlaceholder: 'اختر',
    dateFieldLabel: 'التاريخ',
    searchBtn: 'بحث',
    searchingBtn: 'جارٍ البحث…',
    errorFallback: 'خطأ في البحث عن حالة الرحلة.',
    notFoundTitle: 'لم يتم العثور على الرحلة',
    notFoundMsg: 'لا توجد رحلة مطابقة للمعلومات المدخلة. تحقق من رقم الرحلة أو المسار والتاريخ.',
    airlineName: 'blujet',
    terminalLabel: 'الصالة',
    terminalTba: 'يُعلَن لاحقًا',
    aircraftLabel: 'الطائرة',
    gateLabel: 'البوابة',
    gateTba: 'يُعلَن لاحقًا',
    beltLabel: 'سير الأمتعة',
    beltTba: 'يُعلَن لاحقًا',
    delayLabel: 'التأخير',
    onTimeLabel: 'في الموعد',
    cancelledLabel: 'ملغاة',
    directLabel: 'مباشرة',
    delayAlertTitle: 'إشعارات التأخير',
    delayAlertSub: 'فعّل تنبيهات الرسائل عند تغيّر حالة الرحلة',
    manageBookingTitle: 'إدارة الحجز',
    manageBookingSub: 'تغيير المقعد أو تنزيل التذكرة أو الاسترداد',
    support24Title: 'دعم على مدار الساعة',
    support24Sub: 'تواصل معنا لأي استفسار',
  },
};

export default function FlightStatusPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const location = useLocation();
  const t = STR[locale];
  const [mode, setMode] = useState<'flightNo' | 'route'>('flightNo');
  const [flightNo, setFlightNo] = useState('');
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [dateIso, setDateIso] = useState<string | null>(todayIso());
  const [airports, setAirports] = useState<Airport[]>([]);
  const [result, setResult] = useState<FlightStatusResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, []);

  useEffect(() => {
    const st = location.state as { flightNo?: string; dateIso?: string } | null;
    if (st?.flightNo) {
      setMode('flightNo');
      setFlightNo(st.flightNo);
    }
    if (st?.dateIso) setDateIso(new Date(st.dateIso).toISOString());
  }, [location.state]);

  const airportOptions = useMemo(
    () =>
      airports.map((a) => ({
        id: a.id,
        code: a.code,
        label: `${cityName(a.code, a.cityFa, locale)} (${a.code})`,
      })),
    [airports, locale],
  );

  function onModeChange(next: 'flightNo' | 'route') {
    setMode(next);
    setResult(null);
    setNotFound(false);
    setError(null);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotFound(false);
    setResult(null);
    if (!dateIso) return;
    setSearching(true);
    try {
      const date = dateIso.slice(0, 10);
      const data =
        mode === 'flightNo'
          ? await lookupFlightStatus({ flightNo: flightNo.trim(), date })
          : await lookupFlightStatus({ origin, dest, date });
      setResult(data);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'NOT_FOUND') {
        setNotFound(true);
      } else {
        setError(err instanceof ApiRequestError ? err.message : t.errorFallback);
      }
    } finally {
      setSearching(false);
    }
  }

  const canSearch = mode === 'flightNo' ? !!flightNo.trim() && !!dateIso : !!origin && !!dest && !!dateIso;

  const resultLabels = {
    airlineName: t.airlineName,
    terminalLabel: t.terminalLabel,
    terminalTba: t.terminalTba,
    aircraftLabel: t.aircraftLabel,
    gateLabel: t.gateLabel,
    gateTba: t.gateTba,
    beltLabel: t.beltLabel,
    beltTba: t.beltTba,
    delayLabel: t.delayLabel,
    onTimeLabel: t.onTimeLabel,
    cancelledLabel: t.cancelledLabel,
    directLabel: t.directLabel,
  };

  return (
    <PublicPageShell>
      <section
        style={{
          background: 'linear-gradient(135deg,#0d2640,#16406e)',
          color: '#fff',
          padding: '34px 22px 62px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.14)',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#aac4e2',
              marginBottom: 14,
            }}
          >
            🛫 {t.liveBadge}
          </div>
          <h1 style={{ fontSize: isMobile ? 27 : 30, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-.5px' }}>
            {t.title}
          </h1>
          <p style={{ fontSize: 13, color: '#aac4e2', margin: 0 }}>{t.subtitle}</p>
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: '-38px auto 56px', padding: '0 26px', position: 'relative' }}>
        <FlightStatusSearchForm
          mode={mode}
          flightNo={flightNo}
          origin={origin}
          dest={dest}
          dateIso={dateIso}
          airports={airportOptions}
          searching={searching}
          canSearch={canSearch}
          labels={{
            modeFlightNo: t.modeFlightNo,
            modeRoute: t.modeRoute,
            flightNoFieldLabel: t.flightNoFieldLabel,
            flightNoPlaceholder: t.flightNoPlaceholder,
            originFieldLabel: t.originFieldLabel,
            destFieldLabel: t.destFieldLabel,
            selectPlaceholder: t.selectPlaceholder,
            dateFieldLabel: t.dateFieldLabel,
            searchBtn: t.searchBtn,
            searchingBtn: t.searchingBtn,
          }}
          onModeChange={onModeChange}
          onFlightNoChange={setFlightNo}
          onOriginChange={setOrigin}
          onDestChange={setDest}
          onDateChange={setDateIso}
          onSubmit={(e) => void search(e)}
        />

        {error && (
          <p
            data-testid="fs-error"
            style={{
              marginTop: 16,
              borderRadius: 10,
              background: '#fef2f2',
              padding: 12,
              fontSize: 12.5,
              color: '#e5484d',
            }}
          >
            {error}
          </p>
        )}

        {notFound && <FlightStatusNotFound title={t.notFoundTitle} message={t.notFoundMsg} />}

        {result && (
          <FlightStatusResultCard
            result={result}
            locale={locale}
            isMobile={isMobile}
            originCity={cityName(result.originCode, result.originCityFa, locale)}
            destCity={cityName(result.destCode, result.destCityFa, locale)}
            statusText={statusLabel(result.statusLabelFa, locale)}
            labels={resultLabels}
          />
        )}

        <FlightStatusHelpLinks
          isMobile={isMobile}
          labels={{
            delayAlertTitle: t.delayAlertTitle,
            delayAlertSub: t.delayAlertSub,
            manageBookingTitle: t.manageBookingTitle,
            manageBookingSub: t.manageBookingSub,
            support24Title: t.support24Title,
            support24Sub: t.support24Sub,
          }}
        />
      </section>
    </PublicPageShell>
  );
}
