import { useEffect, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits, localeMoney } from '../../../lib/fa-format';
import { formatJalaliDate } from '../../../lib/jalali';
import { publicCabinLabel } from '../../../lib/flight-definition';
import type { CabinClass, SearchFlightResult } from '../../../types/public-site';
import type { ResultsCopy } from './results-copy';
import {
  flightAirlineLabel,
  formatDuration,
  formatFlightClock,
  flightDurationMinutes,
  priceBreakdown,
  primaryCabin,
  stopLabel,
} from './results-utils';

type Props = {
  flight: SearchFlightResult;
  locale: StoredLocale;
  isMobile: boolean;
  isRTL: boolean;
  expanded: boolean;
  isAiPick: boolean;
  copy: ResultsCopy;
  originTz?: string;
  destTz?: string;
  cityName: (code: string) => string;
  savedKeys: Set<string>;
  lockBusyKey: string | null;
  saveBusyKey: string | null;
  showGoldLock: boolean;
  onToggle: () => void;
  onBuy: (cabin: CabinClass) => void;
  onLock: (cabin: CabinClass) => void;
  onSave: (cabin: CabinClass) => void;
};

export default function ResultsFlightCard({
  flight,
  locale,
  isMobile,
  isRTL,
  expanded,
  isAiPick,
  copy,
  originTz,
  destTz,
  cityName,
  savedKeys,
  lockBusyKey,
  saveBusyKey,
  showGoldLock,
  onToggle,
  onBuy,
  onLock,
  onSave,
}: Props) {
  const defaultCabin = primaryCabin(flight);
  const [selectedCabinClass, setSelectedCabinClass] = useState<CabinClass>(
    defaultCabin?.cabin ?? 'ECONOMY',
  );

  useEffect(() => {
    const next = primaryCabin(flight);
    if (next) setSelectedCabinClass(next.cabin);
  }, [flight.flightInstanceId, flight.cabins]);

  const cabin =
    flight.cabins.find((c) => c.cabin === selectedCabinClass) ?? defaultCabin;
  if (!cabin) return null;

  const cabinLabel = publicCabinLabel(cabin.cabin, locale);
  const hasMultipleCabins = flight.cabins.length > 1;

  const airline = flightAirlineLabel(flight.flightNo);
  const dep = formatFlightClock(flight.departureAt, locale, originTz);
  const arr = formatFlightClock(flight.arrivalAt, locale, destTz);
  const dur = formatDuration(flightDurationMinutes(flight.departureAt, flight.arrivalAt), locale);
  const stops = stopLabel(Boolean(flight.connection), locale);
  const priceIrr = BigInt(cabin.priceIrr);
  const { baseIrr, taxIrr } = priceBreakdown(priceIrr);
  const lowSeats = cabin.seatsLeft > 0 && cabin.seatsLeft <= 3;
  const key = `${flight.flightInstanceId}:${cabin.cabin}`;
  const dateShort =
    locale === 'en'
      ? new Date(flight.departureAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : formatJalaliDate(flight.departureAt);

  return (
    <div data-testid="result-card" style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, overflow: 'hidden' }}>
      {isAiPick && (
        <div style={{ background: 'linear-gradient(90deg,#1668c4,#0d3b66)', color: '#fff', padding: '6px 15px', fontSize: 13.5, fontWeight: 800 }}>
          ✨ {copy.aiRecoLabel}
        </div>
      )}
      <div
        style={{
          padding: isMobile ? '14px 14px 0' : '16px 20px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 12 : 25,
          flexWrap: 'wrap',
        }}
      >
        {!isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 96, flex: 'none' }}>
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
            <span style={{ fontSize: 13.5, color: '#16202e', fontWeight: 700, textAlign: 'center' }}>{airline}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 25, flex: 1, minWidth: isMobile ? 0 : 280 }}>
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 800 }}>{dep}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5a6678' }}>{flight.originCode}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#6b7787', marginBottom: 6 }}>{dur}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
              <span style={{ flex: 1, height: 1.5, background: '#e0e5ec' }} />
              <span style={{ color: '#c2cad4', fontSize: 14.5 }}>✈</span>
              <span style={{ flex: 1, height: 1.5, background: '#e0e5ec' }} />
            </div>
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  fontSize: 12.5,
                  color: '#1f8a5b',
                  background: '#e8f5ee',
                  padding: '2px 10px',
                  borderRadius: 14,
                  fontWeight: 600,
                }}
              >
                {stops}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 800 }}>{arr}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5a6678' }}>{flight.destCode}</div>
          </div>
        </div>

        {!isMobile ? (
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
              borderRight: isRTL ? undefined : '1px solid #eef1f5',
              borderLeft: isRTL ? '1px solid #eef1f5' : undefined,
              paddingRight: isRTL ? 0 : 21,
              paddingLeft: isRTL ? 21 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 19, fontWeight: 900, color: '#1668c4' }}>{localeMoney(cabin.priceIrr, locale)}</span>
              <span style={{ fontSize: 11, color: '#6b7585' }}>{copy.toman}</span>
            </div>
            {lowSeats && (
              <span style={{ fontSize: 12.5, color: '#d9730d', fontWeight: 600 }}>{copy.lowSeatsLabel}</span>
            )}
            <button
              type="button"
              onClick={onToggle}
              style={{
                marginTop: 2,
                padding: '9px 22px',
                background: '#1668c4',
                color: '#fff',
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {copy.detailsBookLabel} ▾
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
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
              fontSize: 17,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              marginBottom: 14,
            }}
          >
            {localeMoney(cabin.priceIrr, locale)} {copy.toman}
          </button>
        )}
      </div>

      {expanded && (
        <div
          style={{
            background: '#e9f1fb',
            borderTop: '1px solid #d4e3f5',
            padding: isMobile ? '14px' : '15px 20px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  background: '#eef4fb',
                  color: '#1668c4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flex: 'none',
                }}
              >
                ✈
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: '#16202e' }}>{copy.flightDetailsLabel}</span>
              <span
                style={{
                  marginRight: 'auto',
                  marginLeft: isRTL ? 'auto' : undefined,
                  fontSize: 12,
                  color: '#7a8696',
                  background: '#f2f5f9',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                {copy.automatedLabel}
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: '#5a6678', marginBottom: 18 }}>
              {copy.outboundLabel}: {cityName(flight.originCode)} {copy.routeArrow} {cityName(flight.destCode)}
            </div>
            <div style={{ display: 'flex', gap: 13 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <span style={{ width: 11, height: 11, border: '2px solid #1668c4', borderRadius: '50%' }} />
                <span style={{ flex: 1, width: 2, background: '#d4e3f5', minHeight: 54 }} />
                <span style={{ width: 11, height: 11, background: '#1668c4', borderRadius: '50%' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{dep}</div>
                    <div style={{ fontSize: 13, color: '#6b7787' }}>
                      {copy.originAirportLabel} · {flight.originCode}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7787' }}>{dateShort}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{arr}</div>
                    <div style={{ fontSize: 13, color: '#6b7787' }}>
                      {copy.destAirportLabel} · {flight.destCode}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7787' }}>{dateShort}</div>
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 18px',
                marginTop: 20,
                paddingTop: 13,
                borderTop: '1px solid #eef1f5',
              }}
            >
              {[
                [copy.flightNoLabel, flight.flightNo],
                [copy.aircraftLabel, flight.aircraftType],
                [copy.baggageLabel, '20 kg'],
                [copy.cabinLabel, cabinLabel],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: '#6b7787' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#16202e' }} dir="ltr">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: isMobile ? 0 : 240,
              background: '#fff',
              border: '1px solid #e0e9f5',
              borderRadius: 14,
              padding: isMobile ? 14 : '14px 16px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#16202e', marginBottom: 18 }}>{copy.priceDetailsLabel}</div>
            {hasMultipleCabins && (
              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}
                data-testid="cabin-selector"
              >
                {flight.cabins.map((opt) => {
                  const active = opt.cabin === cabin.cabin;
                  return (
                    <button
                      key={opt.cabin}
                      type="button"
                      data-testid={`cabin-option-${opt.cabin}`}
                      onClick={() => setSelectedCabinClass(opt.cabin)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 10,
                        border: active ? '1.5px solid #1668c4' : '1px solid #d5e1f0',
                        background: active ? '#eef4fb' : '#fff',
                        color: active ? '#1668c4' : '#5a6678',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {publicCabinLabel(opt.cabin, locale)}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 13.5, color: '#5a6678', marginBottom: 12 }}>{copy.adultPaxLabel}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7787' }}>{copy.basePriceLabel}</span>
                <span style={{ fontWeight: 600, color: '#16202e' }}>{localeMoney(baseIrr.toString(), locale)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7787' }}>{copy.taxesFeesLabel}</span>
                <span style={{ fontWeight: 600, color: '#16202e' }}>{localeMoney(taxIrr.toString(), locale)}</span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 16,
                paddingTop: 11,
                borderTop: '1px solid #eef1f5',
              }}
            >
              <span style={{ fontWeight: 700, color: '#16202e' }}>{copy.totalLabel}</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#1668c4' }}>{localeMoney(cabin.priceIrr, locale)}</span>
            </div>
            <div
              style={{
                marginTop: 14,
                background: '#fff4e8',
                border: '1px solid #f6dcbb',
                color: '#d9730d',
                borderRadius: 10,
                padding: '8px 11px',
                fontSize: 13.5,
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              {copy.seatsRemainingLabel}: {faDigits(cabin.seatsLeft)}
            </div>
            <button
              type="button"
              disabled={cabin.seatsLeft === 0}
              onClick={() => onBuy(cabin.cabin)}
              style={{
                marginTop: 14,
                height: 50,
                borderRadius: 12,
                background: '#1668c4',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15.5,
                fontWeight: 800,
                border: 'none',
                cursor: cabin.seatsLeft === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: cabin.seatsLeft === 0 ? 0.5 : 1,
              }}
            >
              {copy.buyTicketLabel}
            </button>
            {showGoldLock && (
              <button
                type="button"
                disabled={lockBusyKey === key}
                onClick={() => onLock(cabin.cabin)}
                data-testid={`real-lock-${flight.flightInstanceId}-${cabin.cabin}`}
                style={{
                  marginTop: 10,
                  height: 46,
                  borderRadius: 12,
                  border: '1.5px solid #1668c4',
                  color: '#1668c4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  fontSize: 13,
                  fontWeight: 700,
                  background: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                🔒 {copy.aiFareLockGoldLabel}
              </button>
            )}
            {!showGoldLock && (
              <button
                type="button"
                disabled={lockBusyKey === key}
                onClick={() => onLock(cabin.cabin)}
                data-testid={`real-lock-${flight.flightInstanceId}-${cabin.cabin}`}
                style={{
                  marginTop: 10,
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid #d5e1f0',
                  color: '#1668c4',
                  fontSize: 12,
                  fontWeight: 700,
                  background: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {lockBusyKey === key ? copy.aiAnalyzing : `🔒 ${copy.priceLock}`}
              </button>
            )}
            <button
              type="button"
              disabled={saveBusyKey === key || savedKeys.has(key)}
              onClick={() => onSave(cabin.cabin)}
              data-testid={`real-save-${flight.flightInstanceId}-${cabin.cabin}`}
              style={{
                marginTop: 8,
                height: 36,
                borderRadius: 10,
                border: '1px solid #d5e1f0',
                color: '#5a6678',
                fontSize: 11,
                fontWeight: 700,
                background: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {saveBusyKey === key
                ? copy.aiAnalyzing
                : savedKeys.has(key)
                  ? `✓ ${copy.savedFlight}`
                  : `🔖 ${copy.saveFlight}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
