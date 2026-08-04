import { useState } from 'react';
import { createAirport } from '../../api/flights';
import { faDigits, latinDigits } from '../../lib/fa-format';
import { StaffAlert, StaffPanelCard, StaffPrimaryButton } from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { staffInput, staffTableHeader, staffTableRow } from '../../lib/staff-panel-styles';
import type { AirportEntry } from '../../types/flights';

interface FlightCitiesTabProps {
  airports: AirportEntry[];
  onCreated: (airport: AirportEntry) => void;
}

const labelStyle = {
  display: 'block' as const,
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 800,
  color: STAFF_PANEL.textMuted,
};

const inputStyle = {
  ...staffInput,
  height: 40,
  width: '100%',
  padding: '0 12px',
  fontSize: 12,
};

export default function FlightCitiesTab({ airports, onCreated }: FlightCitiesTabProps) {
  const [cityFa, setCityFa] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setNotice(null);
    const name = cityFa.trim();
    const iata = latinDigits(code.trim()).toUpperCase();
    if (!name || iata.length !== 3) {
      setError('نام شهر و کد فرودگاه (۳ حرف) الزامی است.');
      return;
    }
    setBusy(true);
    try {
      const created = await createAirport({ cityFa: name, code: iata });
      setCityFa('');
      setCode('');
      setNotice(`شهر «${name}» اضافه شد و در جستجوی بلیط سایت نمایش داده می‌شود ✓`);
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت شهر.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <StaffAlert tone="error">{error}</StaffAlert>}
      {notice && <StaffAlert tone="success">{notice}</StaffAlert>}

      <StaffPanelCard title="افزودن شهر جدید">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label htmlFor="city-name" style={labelStyle}>
              نام شهر *
            </label>
            <input
              id="city-name"
              value={cityFa}
              onChange={(e) => setCityFa(e.target.value)}
              placeholder="مثلاً وان"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="city-code" style={labelStyle}>
              کد فرودگاه *
            </label>
            <input
              id="city-code"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VAS"
              maxLength={3}
              className="font-num"
              style={inputStyle}
            />
          </div>
          <StaffPrimaryButton disabled={busy} onClick={() => void onSubmit()} style={{ height: 40 }}>
            {busy ? 'در حال ثبت…' : 'افزودن شهر'}
          </StaffPrimaryButton>
        </div>
        <p style={{ marginTop: 12, fontSize: 11, color: STAFF_PANEL.textMuted }}>
          این شهرها همان لیستی هستند که در باکس جستجوی بلیط در صفحهٔ اصلی سایت هم نمایش داده می‌شوند.
        </p>
      </StaffPanelCard>

      <StaffPanelCard
        title="شهرهای دارای پرواز"
        padding={0}
        headerAction={
          <span style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>{faDigits(airports.length)} شهر</span>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 480 }}>
            <div
              style={{
                ...staffTableHeader,
                gridTemplateColumns: '1.2fr 0.7fr 1.6fr',
                fontSize: 10,
              }}
            >
              <span>شهر</span>
              <span>کد</span>
              <span>فرودگاه</span>
            </div>
            {airports.map((a) => (
              <div
                key={a.id}
                style={{
                  ...staffTableRow,
                  gridTemplateColumns: '1.2fr 0.7fr 1.6fr',
                  cursor: 'default',
                }}
              >
                <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{a.cityFa}</span>
                <span className="ltr font-num" style={{ color: STAFF_PANEL.textMuted }}>{a.code}</span>
                <span style={{ color: STAFF_PANEL.textMuted }}>فرودگاه {a.cityFa}</span>
              </div>
            ))}
            {airports.length === 0 && (
              <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted }}>
                شهری ثبت نشده است.
              </p>
            )}
          </div>
        </div>
      </StaffPanelCard>
    </div>
  );
}
