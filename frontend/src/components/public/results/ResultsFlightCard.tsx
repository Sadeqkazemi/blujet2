import { useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits, localeMoney } from '../../../lib/fa-format';
import { formatJalaliDate } from '../../../lib/jalali';
import type { CabinClass, SearchFlightResult } from '../../../types/public-site';
import {
  flightAirlineLabel,
  formatFlightClock,
  formatFlightDuration,
} from './results-utils';

export interface ResultsFlightCardProps {
  flight: SearchFlightResult;
  locale: StoredLocale;
  isMobile: boolean;
  preferredCabin: CabinClass;
  leg: 'outbound' | 'return' | 'multi';
  disabled?: boolean;
  labels: {
    direct: string;
    oneStop: string;
    seatsLeft: string;
    select: string;
    toman: string;
    priceLock: string;
    saveFlight: string;
    savedFlight: string;
    analyzing: string;
    detailsBook: string;
    flightDetails: string;
    flightNo: string;
    aircraft: string;
    lowSeats: string;
  };
  cabinLabels: Record<CabinClass, string>;
  lockBusyKey: string | null;
  saveBusyKey: string | null;
  savedKeys: Set<string>;
  onSelect: (flightInstanceId: string, cabin: CabinClass) => void;
  onLock: (flightInstanceId: string, cabin: CabinClass) => void;
  onSave: (flightInstanceId: string, cabin: CabinClass) => void;
}

export default function ResultsFlightCard({
  flight,
  locale,
  isMobile,
  preferredCabin,
  leg,
  disabled = false,
  labels,
  cabinLabels,
  lockBusyKey,
  saveBusyKey,
  savedKeys,
  onSelect,
  onLock,
  onSave,
}: ResultsFlightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const airline = flightAirlineLabel(flight.flightNo);
  const stopText = flight.connection ? labels.oneStop : labels.direct;
  const pref =
    flight.cabins.find((c) => c.cabin === preferredCabin) ??
    flight.cabins.find((c) => c.cabin === 'ECONOMY') ??
    flight.cabins[0];
  const prefPrice = pref ? localeMoney(pref.priceIrr, locale) : '—';
  const lowSeats = pref && pref.seatsLeft > 0 && pref.seatsLeft <= 5;

  return (
    <div
      data-testid="result-card"
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: isMobile ? '14px' : '16px 20px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 12 : 25,
          flexWrap: 'wrap',
        }}
      >
        {!isMobile && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              width: 96,
              flex: 'none',
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 14,
                background: '#f0f2f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7787',
                fontSize: 21,
              }}
            >
              ✈
            </div>
            <span style={{ fontSize: 13.5, color: '#16202e', fontWeight: 700, textAlign: 'center' }}>
              {airline}
            </span>
            <span style={{ fontSize: 11, color: '#6b7787', fontWeight: 600 }} dir="ltr">
              {flight.flightNo}
            </span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 10 : 21,
            flex: 1,
            minWidth: isMobile ? 0 : 340,
          }}
        >
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div
              className="font-num"
              style={{ fontSize: isMobile ? 19 : 23.5, fontWeight: 800 }}
              dir="ltr"
            >
              {formatFlightClock(flight.departureAt, locale)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5a6678' }} dir="ltr">
              {flight.originCode}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#6b7787', marginBottom: 6 }}>
              {formatFlightDuration(flight.departureAt, flight.arrivalAt, locale)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
              <span style={{ flex: 1, height: 1.5, background: '#e0e5ec' }} />
              <span style={{ color: '#c2cad4', fontSize: 14.5 }}>✈</span>
              <span style={{ flex: 1, height: 1.5, background: '#e0e5ec' }} />
            </div>
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  fontSize: 12.5,
                  color: flight.connection ? '#d9730d' : '#1f8a5b',
                  background: flight.connection ? '#fff4e8' : '#e8f5ee',
                  padding: '2px 10px',
                  borderRadius: 14,
                  fontWeight: 600,
                }}
              >
                {stopText}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div
              className="font-num"
              style={{ fontSize: isMobile ? 19 : 23.5, fontWeight: 800 }}
              dir="ltr"
            >
              {formatFlightClock(flight.arrivalAt, locale)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5a6678' }} dir="ltr">
              {flight.destCode}
            </div>
          </div>
        </div>

        {!isMobile && (
          <div
            style={{
              textAlign: 'center',
              minWidth: 210,
              minHeight: 122,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              borderRight: '1px solid #eef1f5',
              paddingRight: 21,
              flex: 'none',
            }}
          >
            <div
              className="font-num"
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
                fontSize: locale === 'en' ? 21.5 : 16.5,
                fontWeight: 900,
                color: '#1668c4',
                whiteSpace: 'nowrap',
              }}
            >
              {prefPrice} <span style={{ fontSize: 12, fontWeight: 700 }}>{labels.toman}</span>
            </div>
            {lowSeats && (
              <span style={{ fontSize: 12.5, color: '#d9730d', fontWeight: 600 }}>
                {labels.lowSeats.replace('{n}', faDigits(pref!.seatsLeft))}
              </span>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 2,
                padding: '9px 22px',
                background: '#1668c4',
                color: '#fff',
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'inherit',
              }}
            >
              {labels.detailsBook} {expanded ? '▴' : '▾'}
            </button>
          </div>
        )}

        {isMobile && (
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5a6678', textAlign: 'center' }} dir="ltr">
            {flight.flightNo}
          </div>
        )}

        {isMobile && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 11,
              background: 'linear-gradient(90deg,#1668c4,#0d3b66)',
              color: '#fff',
              borderRadius: 10,
              fontSize: locale === 'en' ? 21.5 : 16.5,
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'inherit',
            }}
          >
            <span className="font-num">{prefPrice}</span> {labels.toman}
          </button>
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid #eef1f5',
          padding: isMobile ? '12px 14px' : '12px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {flight.cabins.map((c) => {
          const key = `${flight.flightInstanceId}:${c.cabin}`;
          return (
            <div
              key={c.cabin}
              style={{
                display: 'flex',
                flex: '1 1 200px',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                border: '1px solid #e5e9f0',
                borderRadius: 12,
                padding: '10px 12px',
                background: '#fafbfc',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: '#6b7b94' }}>{cabinLabels[c.cabin]}</div>
                <div className="font-num" style={{ fontSize: 14, fontWeight: 800, color: '#1668c4' }}>
                  {localeMoney(c.priceIrr, locale)} {labels.toman}
                </div>
                <div style={{ fontSize: 10, color: '#6b7b94' }}>
                  {faDigits(c.seatsLeft)} {labels.seatsLeft}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <button
                  type="button"
                  disabled={c.seatsLeft === 0 || disabled}
                  onClick={() => onSelect(flight.flightInstanceId, c.cabin)}
                  style={{
                    borderRadius: 8,
                    background: '#1668c4',
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    cursor: c.seatsLeft === 0 || disabled ? 'not-allowed' : 'pointer',
                    opacity: c.seatsLeft === 0 || disabled ? 0.4 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {labels.select}
                </button>
                {leg !== 'return' && (
                  <>
                    <button
                      type="button"
                      disabled={lockBusyKey === key}
                      data-testid={`real-lock-${flight.flightInstanceId}-${c.cabin}`}
                      onClick={() => onLock(flight.flightInstanceId, c.cabin)}
                      style={{
                        borderRadius: 8,
                        border: '1px solid #d5e1f0',
                        background: '#fff',
                        padding: '4px 10px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#1668c4',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {lockBusyKey === key ? labels.analyzing : `🔒 ${labels.priceLock}`}
                    </button>
                    <button
                      type="button"
                      disabled={saveBusyKey === key || savedKeys.has(key)}
                      data-testid={`real-save-${flight.flightInstanceId}-${c.cabin}`}
                      onClick={() => onSave(flight.flightInstanceId, c.cabin)}
                      style={{
                        borderRadius: 8,
                        border: '1px solid #d5e1f0',
                        background: '#fff',
                        padding: '4px 10px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#5a6678',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        opacity: savedKeys.has(key) ? 0.6 : 1,
                      }}
                    >
                      {saveBusyKey === key
                        ? labels.analyzing
                        : savedKeys.has(key)
                          ? `✓ ${labels.savedFlight}`
                          : `🔖 ${labels.saveFlight}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {expanded && (
        <div
          style={{
            background: '#e9f1fb',
            borderTop: '1px solid #d4e3f5',
            padding: '15px 20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #e0e9f5',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#16202e', marginBottom: 12 }}>
              {labels.flightDetails}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 18px',
                fontSize: 13.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7787' }}>{labels.flightNo}</span>
                <span style={{ fontWeight: 600, color: '#16202e' }} dir="ltr">
                  {flight.flightNo}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7787' }}>{labels.aircraft}</span>
                <span style={{ fontWeight: 600, color: '#16202e' }}>{flight.aircraftType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: '1 / -1' }}>
                <span style={{ color: '#6b7787' }}>{locale === 'en' ? 'Date' : 'تاریخ'}</span>
                <span style={{ fontWeight: 600, color: '#16202e' }}>
                  {formatJalaliDate(flight.departureAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
