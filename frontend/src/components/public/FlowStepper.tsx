import { useNavigate } from 'react-router-dom';
import { faDigits } from '../../lib/fa-format';

// Purchase-flow progress bar — matches the design's flow stepper added to
// نتایج پرواز / تکمیل خرید. Steps before the current one are clickable
// (best-effort back-navigation); the rest are inert markers.
export type FlowStep = 'search' | 'results' | 'seat' | 'checkout' | 'payment' | 'ticket';

const STEPS: { key: FlowStep; label: string; back: string }[] = [
  { key: 'search', label: 'جستجو', back: '/' },
  { key: 'results', label: 'نتایج پرواز', back: '/results' },
  { key: 'seat', label: 'انتخاب صندلی', back: '#' },
  { key: 'checkout', label: 'تکمیل خرید', back: '#' },
  { key: 'payment', label: 'پرداخت', back: '#' },
  { key: 'ticket', label: 'صدور بلیط', back: '#' },
];

export default function FlowStepper({ current, onBack }: { current: FlowStep; onBack?: () => void }) {
  const navigate = useNavigate();
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', padding: '12px 26px 0' }}>
      <div style={{ background: '#fff', border: '1px solid #e6eaf0', borderRadius: 14, boxShadow: '0 10px 26px -18px rgba(13,38,102,.35)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto' }}>
        {onBack && (
          <>
            <div
              data-testid="flow-back"
              onClick={onBack}
              title="بازگشت"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                cursor: 'pointer',
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#fff',
                border: '1.5px solid #dfe6ef',
                color: '#1668c4',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              →
            </div>
            <span style={{ flex: 'none', width: 1.5, height: 24, background: '#eef1f5' }} />
          </>
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {STEPS.map((s, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            const clickable = done && s.back !== '#';
            const pillBg = active ? '#1668c4' : done ? '#eef4fb' : '#f4f6fa';
            const pillBorder = active ? '#1668c4' : done ? '#dce8f7' : '#e6eaf0';
            const labelColor = active ? '#fff' : done ? '#1668c4' : '#9aa4b2';
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div
                  data-testid={`flow-step-${s.key}`}
                  onClick={clickable ? () => navigate(s.back) : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    cursor: clickable ? 'pointer' : 'default',
                    background: pillBg,
                    border: `1px solid ${pillBorder}`,
                    borderRadius: 22,
                    padding: '6px 6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: 21,
                      height: 21,
                      borderRadius: '50%',
                      background: active ? '#fff' : done ? '#1668c4' : '#fff',
                      color: active ? '#1668c4' : done ? '#fff' : '#9aa4b2',
                      border: `1.5px solid ${active ? '#fff' : done ? '#1668c4' : '#e2e7ee'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 800,
                      flex: 'none',
                    }}
                  >
                    {done ? '✓' : faDigits(i + 1)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: active ? 800 : 600, color: labelColor, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <span style={{ flex: 'none', width: 14, height: 1.5, background: '#e2e7ee' }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
