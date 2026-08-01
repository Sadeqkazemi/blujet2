import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits, localeMoney } from '../../../lib/fa-format';
import type { SearchAdvisoryResult } from '../../../types/public-site';

export type AiRadarState = 'idle' | 'loading' | 'done' | 'unavailable' | 'error';

export interface ResultsAiRadarBannerProps {
  locale: StoredLocale;
  isMobile: boolean;
  aiState: AiRadarState;
  advisory: SearchAdvisoryResult | null;
  title: string;
  sub: string;
  analyzeLabel: string;
  analyzingLabel: string;
  reanalyzeLabel: string;
  unavailableLabel: string;
  errorLabel: string;
  recommendationBuy: string;
  recommendationWait: string;
  predictedPriceLabel: string;
  probLabel: string;
  cheaperDayLabel: string;
  bestPickLabel: string;
  buyNowLabel: string;
  waitLabel: string;
  tomanLabel: string;
  reasonText: string;
  onAsk: () => void;
}

export default function ResultsAiRadarBanner({
  locale,
  isMobile,
  aiState,
  advisory,
  title,
  sub,
  analyzeLabel,
  analyzingLabel,
  reanalyzeLabel,
  unavailableLabel,
  errorLabel,
  recommendationBuy,
  recommendationWait,
  predictedPriceLabel,
  probLabel,
  cheaperDayLabel,
  bestPickLabel,
  buyNowLabel,
  waitLabel,
  tomanLabel,
  reasonText,
  onAsk,
}: ResultsAiRadarBannerProps) {
  const isBuy = advisory?.recommendation === 'buy';
  const probPct =
    advisory?.priceIncreaseProbPct != null
      ? faDigits(String(advisory.priceIncreaseProbPct))
      : null;

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: isMobile ? '12px 16px 0' : '16px 26px 0' }}>
      <div data-testid="ai-radar">
        <div
          style={{
            background: 'linear-gradient(120deg,#0d2640,#1668c4)',
            border: '1px solid #0d3b66',
            borderRadius: 12,
            padding: isMobile ? '11px 13px' : '16px 18px',
            boxShadow: '0 10px 24px -14px rgba(13,38,64,.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: isMobile ? 36 : 44,
                height: isMobile ? 36 : 44,
                borderRadius: 9,
                background: '#ffffff26',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? 16 : 19,
                flex: 'none',
              }}
            >
              ✦
            </div>
            <div>
              <div style={{ fontSize: isMobile ? 13.5 : 15, fontWeight: 800, color: '#fff' }}>{title}</div>
              <div style={{ fontSize: isMobile ? 12 : 13, color: '#d6ece7', marginTop: 2 }}>{sub}</div>
            </div>
          </div>
          {aiState === 'idle' && (
            <button
              type="button"
              data-testid="ai-ask"
              onClick={onAsk}
              style={{
                padding: '7px 13px',
                borderRadius: 8,
                background: '#fff',
                color: '#1668c4',
                fontSize: 13,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                flex: 'none',
              }}
            >
              {analyzeLabel}
            </button>
          )}
          {aiState === 'loading' && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: '2px solid #ffffff55',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              {analyzingLabel}
            </span>
          )}
          {aiState === 'done' && (
            <button
              type="button"
              data-testid="ai-ask"
              onClick={onAsk}
              style={{
                padding: '6px 11px',
                borderRadius: 8,
                border: '1.5px solid #ffffff66',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                flex: 'none',
              }}
            >
              {reanalyzeLabel}
            </button>
          )}
        </div>

        {aiState === 'unavailable' && (
          <div
            data-testid="ai-unavailable"
            style={{ marginTop: 8, fontSize: 12.5, color: '#6b7b94', padding: '0 4px' }}
          >
            {unavailableLabel}
          </div>
        )}
        {aiState === 'error' && (
          <div
            data-testid="ai-error"
            style={{
              marginTop: 16,
              background: '#fff4e8',
              border: '1px solid #f6dcbb',
              color: '#c2410c',
              borderRadius: 12,
              padding: '10px 11px',
              fontSize: 13.5,
            }}
          >
            {errorLabel}
          </div>
        )}
        {aiState === 'done' && advisory && (
          <div
            data-testid="ai-result"
            style={{
              marginTop: 16,
              background: '#fff',
              border: '1px solid #e0e9f5',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
            }}
          >
            {advisory.predictedPriceIrr && BigInt(advisory.predictedPriceIrr) > 0n && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#eef4fb',
                  borderRadius: 10,
                  padding: '11px 14px',
                }}
              >
                <span style={{ fontSize: 13, color: '#5a6678', fontWeight: 600 }}>{predictedPriceLabel}</span>
                <span style={{ fontSize: 19, fontWeight: 900, color: '#1668c4' }}>
                  {localeMoney(advisory.predictedPriceIrr, locale)} {tomanLabel}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                flexWrap: 'wrap',
                paddingBottom: 11,
                borderBottom: '1px solid #eef1f5',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  background: isBuy ? '#e8f5ee' : '#fff4e8',
                  color: isBuy ? '#1f8a5b' : '#d9730d',
                  padding: '8px 14px',
                  borderRadius: 28,
                  fontSize: 14.5,
                  fontWeight: 800,
                }}
              >
                ● {isBuy ? buyNowLabel : waitLabel}
              </span>
              {probPct && (
                <span style={{ fontSize: 13.5, color: '#5a6678' }}>
                  {probLabel}{' '}
                  <b style={{ color: '#d9730d' }}>{probPct}٪</b>
                </span>
              )}
              {advisory.cheapestDayLabel && (
                <span style={{ fontSize: 13.5, color: '#5a6678' }}>
                  {cheaperDayLabel}{' '}
                  <b style={{ color: '#1668c4' }}>{advisory.cheapestDayLabel}</b>
                </span>
              )}
            </div>
            {reasonText && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.8 }}>
                <span style={{ color: '#1668c4', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  ✓ {bestPickLabel}
                </span>
                <span style={{ color: '#16202e' }}>{reasonText}</span>
              </div>
            )}
            {!reasonText && (
              <div style={{ fontSize: 13, color: '#16202e' }}>
                {isBuy ? recommendationBuy : recommendationWait}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
