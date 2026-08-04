import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StoredLocale } from '../../../hooks/useLocale';
import { useIsMobile } from '../../../hooks/useIsMobile';

const STR: Record<
  StoredLocale,
  {
    intro: string;
    pnrLabel: string;
    pnrPlaceholder: string;
    lastNameLabel: string;
    lastNamePlaceholder: string;
    submit: string;
    validation: string;
  }
> = {
  fa: {
    intro: 'برای مشاهده، تغییر یا استرداد رزرو، کد رهگیری و نام خانوادگی مسافر را وارد کنید.',
    pnrLabel: 'کد رزرو',
    pnrPlaceholder: 'مثلاً BJ4X2K',
    lastNameLabel: 'نام خانوادگی مسافر',
    lastNamePlaceholder: 'مثلاً رضایی',
    submit: 'مشاهده رزرو',
    validation: 'کد رزرو و نام خانوادگی را وارد کنید.',
  },
  en: {
    intro: 'Enter your booking reference and last name to view, change, or cancel your reservation.',
    pnrLabel: 'Booking code',
    pnrPlaceholder: 'e.g. BJ4X2K',
    lastNameLabel: 'Passenger last name',
    lastNamePlaceholder: 'e.g. Rezaei',
    submit: 'View Booking',
    validation: 'Enter the booking code and last name.',
  },
  ar: {
    intro: 'أدخل رمز الحجز واسم العائلة لعرض الحجز أو تغييره أو استرداده.',
    pnrLabel: 'رمز الحجز',
    pnrPlaceholder: 'مثلاً BJ4X2K',
    lastNameLabel: 'اسم العائلة',
    lastNamePlaceholder: 'مثلاً رضايي',
    submit: 'عرض الحجز',
    validation: 'أدخل رمز الحجز واسم العائلة.',
  },
};

interface HomeManageTabProps {
  locale: StoredLocale;
}

export default function HomeManageTab({ locale }: HomeManageTabProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [pnr, setPnr] = useState('');
  const [lastName, setLastName] = useState('');
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
    if (pnr.trim().length < 4 || !lastName.trim()) {
      setError(t.validation);
      return;
    }
    setError(null);
    navigate('/manage-booking', { state: { pnr: pnr.trim(), lastName: lastName.trim() } });
  }

  return (
    <form onSubmit={submit} data-testid="home-manage-tab">
      <div style={{ fontSize: '12.5px', color: isMobile ? 'rgba(255,255,255,.75)' : '#5a6678', marginBottom: 16, lineHeight: 1.9 }}>
        {t.intro}
      </div>
      {error && (
        <p style={{ marginBottom: 12, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>
      )}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 11 }}>
        <div style={fieldBox}>
          <div style={{ fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>{t.pnrLabel}</div>
          <input
            data-testid="home-manage-pnr"
            value={pnr}
            onChange={(e) => setPnr(e.target.value)}
            placeholder={t.pnrPlaceholder}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#16202e', background: 'transparent' }}
          />
        </div>
        <div style={fieldBox}>
          <div style={{ fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>{t.lastNameLabel}</div>
          <input
            data-testid="home-manage-lastname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t.lastNamePlaceholder}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#16202e', background: 'transparent' }}
          />
        </div>
      </div>
      <button
        type="submit"
        data-testid="home-manage-submit"
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
