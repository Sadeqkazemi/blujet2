import type { CSSProperties } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';

export interface ResultsFilterBarProps {
  locale: StoredLocale;
  fStops: 'all' | 'direct' | 'one';
  fTime: 'all' | 'morning' | 'noon' | 'evening';
  fAirline: string;
  airlines: string[];
  labels: {
    filterLabel: string;
    stopsLabel: string;
    all: string;
    direct: string;
    oneStop: string;
    morning: string;
    noon: string;
    evening: string;
    airlineLabel: string;
  };
  onStops: (v: 'all' | 'direct' | 'one') => void;
  onTime: (v: 'all' | 'morning' | 'noon' | 'evening') => void;
  onAirline: (v: string) => void;
}

export default function ResultsFilterBar({
  fStops,
  fTime,
  fAirline,
  airlines,
  labels,
  onStops,
  onTime,
  onAirline,
}: ResultsFilterBarProps) {
  const timeOptions: Array<{ key: typeof fTime; label: string }> = [
    { key: 'all', label: labels.all },
    { key: 'morning', label: labels.morning },
    { key: 'noon', label: labels.noon },
    { key: 'evening', label: labels.evening },
  ];

  const chip = (active: boolean): CSSProperties => ({
    padding: '8px 14px',
    borderRadius: 9,
    border: `1.5px solid ${active ? '#1668c4' : '#e6eaf0'}`,
    background: active ? '#1668c4' : '#fff',
    color: active ? '#fff' : '#5a6678',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flex: 'none',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        flexWrap: 'wrap',
        marginBottom: 13,
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 13,
        padding: '11px 14px',
      }}
      data-testid="results-filters"
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 800,
          color: '#0d2640',
          flex: 'none',
        }}
      >
        ☰ {labels.filterLabel}
      </span>
      <span
        data-testid="f-stops-direct"
        role="button"
        tabIndex={0}
        onClick={() => onStops(fStops === 'direct' ? 'all' : 'direct')}
        onKeyDown={(e) => e.key === 'Enter' && onStops(fStops === 'direct' ? 'all' : 'direct')}
        style={chip(fStops === 'direct')}
      >
        {labels.direct}
      </span>
      <span style={{ width: 1, height: 22, background: '#eef1f5', flex: 'none' }} />
      <div
        style={{
          display: 'flex',
          background: '#f4f7fb',
          border: '1px solid #eef1f5',
          borderRadius: 10,
          overflow: 'hidden',
          flex: 'none',
        }}
      >
        {timeOptions.map((t) => (
          <span
            key={t.key}
            role="button"
            tabIndex={0}
            onClick={() => onTime(t.key)}
            onKeyDown={(e) => e.key === 'Enter' && onTime(t.key)}
            style={{
              padding: '8px 13px',
              fontSize: 13,
              cursor: 'pointer',
              background: fTime === t.key ? '#1668c4' : 'transparent',
              color: fTime === t.key ? '#fff' : '#5a6678',
              fontWeight: fTime === t.key ? 700 : 600,
            }}
          >
            {t.label}
          </span>
        ))}
      </div>
      <span style={{ width: 1, height: 22, background: '#eef1f5', flex: 'none' }} />
      <select
        value={fAirline}
        onChange={(e) => onAirline(e.target.value)}
        aria-label={labels.airlineLabel}
        style={{
          height: 38,
          border: '1.5px solid #e6eaf0',
          borderRadius: 10,
          background: '#fff',
          color: '#16202e',
          fontSize: 13,
          fontWeight: 600,
          padding: '0 12px',
          fontFamily: 'inherit',
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        <option value="all">{labels.all}</option>
        {airlines.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}
