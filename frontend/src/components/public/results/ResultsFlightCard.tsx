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
  labels: {
    direct: string;
    oneStop: string;
    seatsLeft: string;
    select: string;
    buyTicket: string;
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
    priceDetails: string;
    adultPax: string;
    total: string;
    seatsRemaining: string;
    outbound: string;
    originAirport: string;
    destAirport: string;
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
  const [activeCabin, setActiveCabin] = useState<CabinClass>(preferredCabin);

  const airline = flightAirlineLabel(flight.flightNo);
  const stopText = flight.connection ? labels.oneStop : labels.direct;
  const pref =
    flight.cabins.find((c) => c.cabin === preferredCabin) ??
    flight.cabins.find((c) => c.cabin === 'ECONOMY') ??
    flight.cabins[0];
  const prefPrice = pref ? localeMoney(pref.priceIrr, locale) : '—';
  const lowSeats = pref && pref.seatsLeft > 0 && pref.seatsLeft <= 5;

  const cabin =
    flight.cabins.find((c) => c.cabin === activeCabin) ??
    flight.cabins.find((c) => c.cabin === 'ECONOMY') ??
    flight.cabins[0];
  const cabinKey = cabin ? `${flight.flightInstanceId}:${cabin.cabin}` : '';

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
            <div className="font-num" style={{ fontSize: isMobile ? 19 : 23.5, fontWeight: 800 }} dir="ltr">
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
            <div className="font-num" style={{ fontSize: isMobile ? 19 : 23.5, fontWeight: 800 }} dir="ltr">
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
              data-testid={`expand-${flight.flightInstanceId}`}
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
            data-testid={`expand-${flight.flightInstanceId}`}
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

      {expanded && cabin && (
        <div
          style={{
            background: '#e9f1fb',
            borderTop: '1px solid #d4e3f5',
            padding: isMobile ? '12px 14px' : '15px 20px',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              flex: 1.5,
              minWidth: isMobile ? 0 : 280,
              background: '#fff',
              border: '1px solid #e0e9f5',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#16202e', marginBottom: 6 }}>
              {labels.flightDetails}
            </div>
            <div style={{ fontSize: 13.5, color: '#5a6678', marginBottom: 14 }}>{labels.outbound}</div>
            <div style={{ display: 'flex', gap: 13 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <span
                  style={{
                    width: 11,
                    height: 11,
                    border: '2px solid #1668c4',
                    borderRadius: '50%',
                  }}
                />
                <span style={{ flex: 1, width: 2, background: '#d4e3f5', minHeight: 54 }} />
                <span style={{ width: 11, height: 11, background: '#1668c4', borderRadius: '50%' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="font-num" style={{ fontSize: 17, fontWeight: 800 }} dir="ltr">
                      {formatFlightClock(flight.departureAt, locale)}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7787' }}>
                      {labels.originAirport} · {flight.originCode}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7787' }}>
                    {formatJalaliDate(flight.departureAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="font-num" style={{ fontSize: 17, fontWeight: 800 }} dir="ltr">
                      {formatFlightClock(flight.arrivalAt, locale)}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7787' }}>
                      {labels.destAirport} · {flight.destCode}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 18px',
                marginTop: 16,
                paddingTop: 13,
                borderTop: '1px solid #eef1f5',
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
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: isMobile ? 0 : 240,
              background: '#fff',
              border: '1px solid #e0e9f5',
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#16202e', marginBottom: 12 }}>
              {labels.priceDetails}
            </div>
            {flight.cabins.length > 1 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {flight.cabins.map((c) => (
                  <button
                    key={c.cabin}
                    type="button"
                    onClick={() => setActiveCabin(c.cabin)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `1.5px solid ${activeCabin === c.cabin ? '#1668c4' : '#e6eaf0'}`,
                      background: activeCabin === c.cabin ? '#1668c4' : '#fff',
                      color: activeCabin === c.cabin ? '#fff' : '#5a6678',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {cabinLabels[c.cabin]}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 13.5, color: '#5a6678', marginBottom: 10 }}>{labels.adultPax}</div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 11,
                borderTop: '1px solid #eef1f5',
                marginBottom: 12,
              }}
            >
              <span style={{ fontWeight: 700, color: '#16202e' }}>{labels.total}</span>
              <span className="font-num" style={{ fontSize: 18, fontWeight: 900, color: '#1668c4' }}>
                {localeMoney(cabin.priceIrr, locale)} {labels.toman}
              </span>
            </div>
            <div
              style={{
                background: '#fff4e8',
                border: '1px solid #f6dcbb',
                color: '#d9730d',
                borderRadius: 10,
                padding: '8px 11px',
                fontSize: 13.5,
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              {labels.seatsRemaining}: {faDigits(cabin.seatsLeft)}
            </div>
            <button
              type="button"
              disabled={cabin.seatsLeft === 0}
              onClick={() => onSelect(flight.flightInstanceId, cabin.cabin)}
              style={{
                height: 50,
                borderRadius: 12,
                background: '#1668c4',
                color: '#fff',
                fontSize: 15.5,
                fontWeight: 800,
                border: 'none',
                cursor: cabin.seatsLeft === 0 ? 'not-allowed' : 'pointer',
                opacity: cabin.seatsLeft === 0 ? 0.4 : 1,
                fontFamily: 'inherit',
              }}
            >
              {labels.buyTicket}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                disabled={lockBusyKey === cabinKey}
                data-testid={`real-lock-${flight.flightInstanceId}-${cabin.cabin}`}
                onClick={() => onLock(flight.flightInstanceId, cabin.cabin)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  border: '1.5px solid #1668c4',
                  background: '#fff',
                  color: '#1668c4',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {lockBusyKey === cabinKey ? labels.analyzing : `🔒 ${labels.priceLock}`}
              </button>
              <button
                type="button"
                disabled={saveBusyKey === cabinKey || savedKeys.has(cabinKey)}
                data-testid={`real-save-${flight.flightInstanceId}-${cabin.cabin}`}
                onClick={() => onSave(flight.flightInstanceId, cabin.cabin)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  border: '1.5px solid #d5e1f0',
                  background: '#fff',
                  color: '#5a6678',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: savedKeys.has(cabinKey) ? 0.6 : 1,
                }}
              >
                {saveBusyKey === cabinKey
                  ? labels.analyzing
                  : savedKeys.has(cabinKey)
                    ? `✓ ${labels.savedFlight}`
                    : `🔖 ${labels.saveFlight}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
