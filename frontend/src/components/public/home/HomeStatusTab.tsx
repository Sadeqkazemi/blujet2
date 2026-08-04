import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JalaliDatePicker from '../../JalaliDatePicker';
import type { StoredLocale } from '../../../hooks/useLocale';
import { useIsMobile } from '../../../hooks/useIsMobile';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const STR: Record<
  StoredLocale,
  {
    intro: string;
    flightNoLabel: string;
    flightNoPlaceholder: string;
    dateLabel: string;
    submit: string;
    validation: string;
  }
> = {
  fa: {
    intro: 'آخرین وضعیت زمان‌بندی، تأخیر و گیت پرواز خود را با شماره پرواز یا مسیر و تاریخ بررسی کنید.',
    flightNoLabel: 'شماره پرواز',
    flightNoPlaceholder: 'مثلاً BJ-410',
    dateLabel: 'تاریخ پرواز',
    submit: 'مشاهده وضعیت',
    validation: 'شماره پرواز و تاریخ را وارد کنید.',
  },
  en: {
    intro: 'Check the latest schedule, delay, and gate status with your flight number or route and date.',
    flightNoLabel: 'Flight number',
    flightNoPlaceholder: 'e.g. BJ-410',
    dateLabel: 'Flight date',
    submit: 'View Status',
    validation: 'Enter the flight number and date.',
  },
  ar: {
    intro: 'تحقق من آخر حالة للجدول والتأخير والبوابة برقم الرحلة أو المسار والتاريخ.',
    flightNoLabel: 'رقم الرحلة',
    flightNoPlaceholder: 'مثلاً BJ-410',
    dateLabel: 'تاريخ الرحلة',
    submit: 'عرض الحالة',
    validation: 'أدخل رقم الرحلة والتاريخ.',
  },
};

interface HomeStatusTabProps {
  locale: StoredLocale;
}

export default function HomeStatusTab({ locale }: HomeStatusTabProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [flightNo, setFlightNo] = useState('');
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fieldBox: React.CSSProperties = {
    flex: 1,
    background: isMobile ? '#fff' : 'transparent',
    borderRadius: 12,
    padding: '13px 15px',
    boxShadow: isMobile ? '0 8px 20px -12px rgba(0,0,0,.3)' : undefined,
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!flightNo.trim() || !dateIso) {
      setError(t.validation);
      return;
    }
    setError(null);
    navigate('/flight-status', {
      state: { flightNo: flightNo.trim(), dateIso: dateIso.slice(0, 10) },
    });
  }

  return (
    <form onSubmit={submit} data-testid="home-status-tab">
      <div style={{ fontSize: '12.5px', color: isMobile ? 'rgba(255,255,255,.75)' : '#5a6678', marginBottom: 16, lineHeight: 1.9 }}>
        {t.intro}
      </div>
      {error && (
        <p style={{ marginBottom: 12, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>
      )}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 11 }}>
        <div style={fieldBox}>
          <div style={{ fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>{t.flightNoLabel}</div>
          <input
            data-testid="home-status-flight-no"
            value={flightNo}
            onChange={(e) => setFlightNo(e.target.value)}
            placeholder={t.flightNoPlaceholder}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#16202e', background: 'transparent' }}
          />
        </div>
        <div style={{ ...fieldBox, padding: isMobile ? '6px 0' : fieldBox.padding }}>
          <JalaliDatePicker
            label={t.dateLabel}
            value={dateIso}
            onChange={setDateIso}
            minDate={TODAY_ISO}
            testId="home-status-date"
            mobileSheet
          />
        </div>
      </div>
      <button
        type="submit"
        data-testid="home-status-submit"
        style={{
          marginTop: 14,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 48,
          borderRadius: 12,
          background: '#1668c4',
          color: '#fff',
          fontSize: '13.5px',
          fontWeight: 800,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {t.submit}
      </button>
    </form>
  );
}
