import type { StoredLocale } from '../../../hooks/useLocale';
import { localeMoney } from '../../../lib/fa-format';
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
  tomanLabel,
  reasonText,
  onAsk,
}: ResultsAiRadarBannerProps) {
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
              <div
                style={{
                  fontSize: isMobile ? 13 : 14.5,
                  fontWeight: 800,
                  color: '#fff',
                }}
              >
                {title}
              </div>
              <div style={{ fontSize: isMobile ? 10.5 : 11.5, color: '#d6ece7' }}>{sub}</div>
            </div>
          </div>
          {aiState === 'idle' && (
            <button
              type="button"
              data-testid="ai-ask"
              onClick={onAsk}
              style={{
                padding: '7px 13px',
                background: '#fff',
                color: '#1668c4',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                border: 'none',
                fontFamily: 'inherit',
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
              onClick={onAsk}
              style={{
                padding: '6px 11px',
                border: '1.5px solid #ffffff66',
                color: '#fff',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: 'transparent',
                fontFamily: 'inherit',
              }}
            >
              {reanalyzeLabel}
            </button>
          )}
        </div>

        {aiState === 'unavailable' && (
          <div
            data-testid="ai-unavailable"
            style={{
              marginTop: 12,
              background: '#fff',
              border: '1px solid #e0e9f5',
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 13,
              color: '#8a96a6',
            }}
          >
            {unavailableLabel}
          </div>
        )}

        {aiState === 'error' && (
          <div
            data-testid="ai-error"
            style={{
              marginTop: 12,
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
                <span className="font-num" style={{ fontSize: 19, fontWeight: 900, color: '#1668c4' }}>
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
                  background: advisory.recommendation === 'wait' ? '#fff4e8' : '#e8f5ee',
                  color: advisory.recommendation === 'wait' ? '#d9730d' : '#1f8a5b',
                  padding: '8px 14px',
                  borderRadius: 28,
                  fontSize: 14.5,
                  fontWeight: 800,
                }}
              >
                ● {advisory.recommendation === 'wait' ? recommendationWait : recommendationBuy}
              </span>
            </div>
            {reasonText && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.8 }}>
                <span style={{ color: '#1668c4', fontWeight: 800, whiteSpace: 'nowrap' }}>✓</span>
                <span style={{ color: '#16202e' }}>{reasonText}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
