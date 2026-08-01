import JalaliDatePicker from '../../JalaliDatePicker';
import { useIsMobile } from '../../../hooks/useIsMobile';

export type FlightStatusMode = 'flightNo' | 'route';

export interface AirportOption {
  id: string;
  code: string;
  label: string;
}

export interface FlightStatusSearchFormProps {
  mode: FlightStatusMode;
  flightNo: string;
  origin: string;
  dest: string;
  dateIso: string | null;
  airports: AirportOption[];
  searching: boolean;
  canSearch: boolean;
  labels: {
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
  };
  onModeChange: (mode: FlightStatusMode) => void;
  onFlightNoChange: (v: string) => void;
  onOriginChange: (v: string) => void;
  onDestChange: (v: string) => void;
  onDateChange: (iso: string | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 56,
  border: '1.5px solid #e2e7ee',
  borderRadius: 12,
  background: '#fafbfd',
  padding: '0 15px',
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 700,
  color: '#16202e',
  outline: 'none',
};

export default function FlightStatusSearchForm({
  mode,
  flightNo,
  origin,
  dest,
  dateIso,
  airports,
  searching,
  canSearch,
  labels,
  onModeChange,
  onFlightNoChange,
  onOriginChange,
  onDestChange,
  onDateChange,
  onSubmit,
}: FlightStatusSearchFormProps) {
  const isMobile = useIsMobile();
  const gridCols =
    mode === 'flightNo'
      ? isMobile
        ? '1fr'
        : '1fr 1fr auto'
      : isMobile
        ? '1fr'
        : '1fr 1fr 1fr auto';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 20,
        padding: 14,
        boxShadow: '0 18px 50px -28px rgba(13,38,102,.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 6,
          background: '#f1f5fa',
          borderRadius: 12,
          padding: 4,
          marginBottom: 20,
          width: 'max-content',
          maxWidth: '100%',
          flexWrap: 'wrap',
        }}
      >
        {(
          [
            ['flightNo', labels.modeFlightNo],
            ['route', labels.modeRoute],
          ] as const
        ).map(([m, lbl]) => (
          <button
            key={m}
            type="button"
            data-testid={`fs-mode-${m}`}
            onClick={() => onModeChange(m)}
            style={{
              padding: '10px 20px',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: mode === m ? 800 : 600,
              color: mode === m ? '#1668c4' : '#6b7787',
              background: mode === m ? '#fff' : 'transparent',
              boxShadow: mode === m ? '0 2px 7px rgba(13,38,102,.14)' : 'none',
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'inherit',
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          gap: 12,
          alignItems: 'end',
          padding: isMobile ? 0 : 10,
        }}
      >
        {mode === 'flightNo' ? (
          <div>
            <div style={{ fontSize: 12, color: '#8a96a6', marginBottom: 8, fontWeight: 600 }}>{labels.flightNoFieldLabel}</div>
            <input
              id="fs-flightno"
              data-testid="fs-flightno"
              dir="ltr"
              value={flightNo}
              onChange={(e) => onFlightNoChange(e.target.value)}
              placeholder={labels.flightNoPlaceholder}
              style={{
                ...inputStyle,
                fontFamily: "'Roboto Mono',monospace",
                fontSize: 15,
              }}
            />
          </div>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 12, color: '#8a96a6', marginBottom: 8, fontWeight: 600 }}>{labels.originFieldLabel}</div>
              <select
                id="fs-origin"
                data-testid="fs-origin"
                value={origin}
                onChange={(e) => onOriginChange(e.target.value)}
                style={{ ...inputStyle, background: '#fafbfd' }}
              >
                <option value="">{labels.selectPlaceholder}</option>
                {airports.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8a96a6', marginBottom: 8, fontWeight: 600 }}>{labels.destFieldLabel}</div>
              <select
                id="fs-dest"
                data-testid="fs-dest"
                value={dest}
                onChange={(e) => onDestChange(e.target.value)}
                style={{ ...inputStyle, background: '#fafbfd' }}
              >
                <option value="">{labels.selectPlaceholder}</option>
                {airports.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <div style={{ fontSize: 12, color: '#8a96a6', marginBottom: 8, fontWeight: 600 }}>{labels.dateFieldLabel}</div>
          <div
            style={{
              ...inputStyle,
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <JalaliDatePicker
              label={labels.dateFieldLabel}
              value={dateIso}
              onChange={onDateChange}
              testId="fs-date"
              showLabel={false}
            />
          </div>
        </div>

        <button
          type="submit"
          data-testid="fs-search"
          disabled={!canSearch || searching}
          style={{
            height: 56,
            padding: '0 30px',
            borderRadius: 12,
            border: 'none',
            background: canSearch && !searching ? '#1668c4' : '#aab8c8',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 800,
            cursor: canSearch && !searching ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          {searching ? labels.searchingBtn : labels.searchBtn}
        </button>
      </form>
    </div>
  );
}
