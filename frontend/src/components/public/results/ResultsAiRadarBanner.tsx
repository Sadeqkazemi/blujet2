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
  const ctaLabel =
    aiState === 'loading' ? analyzingLabel : aiState === 'done' ? reanalyzeLabel : analyzeLabel;

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
              <div style={{ fontSize: isMobile ? 12 : 13, color: '#dbe7f7', marginTop: 2 }}>{sub}</div>
            </div>
          </div>
          {(aiState === 'idle' || aiState === 'loading' || aiState === 'done') && (
            <button
              type="button"
              data-testid="ai-ask"
              disabled={aiState === 'loading'}
              onClick={onAsk}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                background: '#fff',
                color: '#1668c4',
                fontSize: 13,
                fontWeight: 800,
                border: 'none',
                cursor: aiState === 'loading' ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                flex: 'none',
              }}
            >
              {ctaLabel}
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
          <div data-testid="ai-error" style={{ marginTop: 8, fontSize: 12.5, color: '#d64545', padding: '0 4px' }}>
            {errorLabel}
          </div>
        )}
        {aiState === 'done' && advisory && (
          <div
            data-testid="ai-result"
            style={{
              marginTop: 10,
              background: '#fff',
              border: '1px solid #eef1f5',
              borderRadius: 12,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                marginBottom: 6,
                borderRadius: 14,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 800,
                background: advisory.recommendation === 'wait' ? '#fff7ed' : '#e8f5ee',
                color: advisory.recommendation === 'wait' ? '#9a5b16' : '#1f8a5b',
              }}
            >
              {advisory.recommendation === 'wait' ? recommendationWait : recommendationBuy}
            </div>
            {reasonText && (
              <p style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.7, color: '#3f546b' }}>{reasonText}</p>
            )}
            {advisory.predictedPriceIrr && BigInt(advisory.predictedPriceIrr) > 0n && (
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#1668c4' }}>
                {predictedPriceLabel}: {localeMoney(advisory.predictedPriceIrr, locale)} {tomanLabel}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
