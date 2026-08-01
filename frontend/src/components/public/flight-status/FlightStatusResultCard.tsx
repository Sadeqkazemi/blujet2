import type { StoredLocale } from '../../../hooks/useLocale';
import { formatJalaliDate } from '../../../lib/jalali';
import type { FlightStatusResult } from '../../../types/flight-status';
import {
  STATUS_PILL,
  flightDurationLabel,
  flightProgressPct,
  formatFlightClock,
} from './flight-status-utils';

export interface FlightStatusResultCardProps {
  result: FlightStatusResult;
  locale: StoredLocale;
  isMobile: boolean;
  originCity: string;
  destCity: string;
  statusText: string;
  labels: {
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
  };
}

export default function FlightStatusResultCard({
  result,
  locale,
  isMobile,
  originCity,
  destCity,
  statusText,
  labels,
}: FlightStatusResultCardProps) {
  const pill = STATUS_PILL[result.status];
  const progress = flightProgressPct(result);
  const detailCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const delayLabel =
    result.status === 'CANCELLED' ? labels.cancelledLabel : labels.onTimeLabel;
  const delayColor = result.status === 'CANCELLED' ? '#d64545' : '#1f8a5b';

  return (
    <div
      data-testid="fs-result"
      style={{
        marginTop: 20,
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 18px 50px -28px rgba(13,38,102,.5)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg,#0d2640,#16406e)',
          color: '#fff',
          padding: '18px 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(255,255,255,.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            ✈
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{labels.airlineName}</div>
            <div style={{ fontSize: 11, color: '#aac4e2' }} dir="ltr">
              {result.flightNo} · {formatJalaliDate(result.departureAt)}
            </div>
          </div>
        </div>
        <span
          data-testid="fs-status-pill"
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: pill.color,
            background: pill.bg,
            padding: '7px 16px',
            borderRadius: 16,
          }}
        >
          {statusText}
        </span>
      </div>

      <div style={{ padding: isMobile ? '24px 18px 20px' : '32px 28px 26px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
            flexWrap: isMobile ? 'wrap' : 'nowrap',
          }}
        >
          <div style={{ textAlign: 'center', flex: isMobile ? '1 1 40%' : undefined }}>
            <div style={{ fontSize: isMobile ? 28 : 34, fontWeight: 900, color: '#16202e' }} dir="ltr">
              {result.originCode}
            </div>
            <div style={{ fontSize: 13, color: '#8a96a6', marginTop: 4 }}>{originCity}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1668c4', marginTop: 10 }}>
              {formatFlightClock(result.departureAt, locale)}
            </div>
            <div style={{ fontSize: 11, color: '#9aa4b2', marginTop: 3 }}>
              {labels.terminalLabel} {labels.terminalTba}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 120,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              padding: '0 8px',
            }}
          >
            <div style={{ fontSize: 11.5, color: '#8a96a6', marginBottom: 10 }}>
              {flightDurationLabel(result.departureAt, result.arrivalAt, locale)}
            </div>
            <div style={{ width: '100%', height: 2, background: '#e6eaf0', position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  height: '100%',
                  width: `${progress}%`,
                  background: '#1668c4',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translate(50%, -50%)',
                  right: `${progress}%`,
                  fontSize: 17,
                  color: '#1668c4',
                  background: '#fff',
                }}
              >
                ✈
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: '#9aa4b2', marginTop: 10 }}>{labels.directLabel}</div>
          </div>

          <div style={{ textAlign: 'center', flex: isMobile ? '1 1 40%' : undefined }}>
            <div style={{ fontSize: isMobile ? 28 : 34, fontWeight: 900, color: '#16202e' }} dir="ltr">
              {result.destCode}
            </div>
            <div style={{ fontSize: 13, color: '#8a96a6', marginTop: 4 }}>{destCity}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1668c4', marginTop: 10 }}>
              {formatFlightClock(result.arrivalAt, locale)}
            </div>
            <div style={{ fontSize: 11, color: '#9aa4b2', marginTop: 3 }}>
              {labels.terminalLabel} {labels.terminalTba}
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: '1.5px dashed #e2e7ee',
            marginTop: 28,
            paddingTop: 20,
            display: 'grid',
            gridTemplateColumns: detailCols,
            gap: 13,
          }}
        >
          {[
            [labels.aircraftLabel, result.aircraftType],
            [labels.gateLabel, labels.gateTba],
            [labels.beltLabel, labels.beltTba],
            [labels.delayLabel, delayLabel],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: '#9aa4b2' }}>{k}</div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  marginTop: 5,
                  color: k === labels.delayLabel ? delayColor : '#16202e',
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
