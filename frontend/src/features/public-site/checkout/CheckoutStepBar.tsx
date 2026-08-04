import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits } from '../../../lib/fa-format';
import type { CheckoutWizardStep } from './checkout-types';
import { CHECKOUT_COPY } from './checkout-copy';

const STEP_ORDER: CheckoutWizardStep[] = ['pax', 'extras', 'review'];

const STEP_ICONS: Record<CheckoutWizardStep, string> = {
  pax: '👤',
  extras: '🧳',
  review: '✓',
};

export default function CheckoutStepBar({
  current,
  locale,
}: {
  current: CheckoutWizardStep;
  locale: StoredLocale;
}) {
  const t = CHECKOUT_COPY[locale];
  const currentIdx = STEP_ORDER.indexOf(current);
  const progressPct = `${(currentIdx / (STEP_ORDER.length - 1)) * 100}%`;

  return (
    <div className="hidden border-b border-[#e8eef6] bg-[#f6f9fd] md:block">
      <div className="relative mx-auto max-w-[560px] px-6 py-5">
        <div className="absolute left-[30px] right-[30px] top-[38px] h-[3px] rounded-sm bg-[#e2e7ee]">
          <div
            className="h-full rounded-sm bg-[#1668c4] transition-all duration-300"
            style={{ width: progressPct }}
          />
        </div>
        <div className="relative flex items-start justify-between">
          {STEP_ORDER.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const bg = done || active ? '#1668c4' : '#fff';
            const color = done || active ? '#fff' : '#9aa4b2';
            const border = done || active ? '#1668c4' : '#e2e7ee';
            const labelColor = active ? '#1668c4' : done ? '#1668c4' : '#9aa4b2';
            return (
              <div key={step} className="flex min-w-[74px] flex-col items-center gap-2">
                <div
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-[2.5px] text-[13px] font-extrabold shadow-sm transition-all"
                  style={{ background: bg, color, borderColor: border }}
                  data-testid={`checkout-step-${step}`}
                >
                  {done ? '✓' : STEP_ICONS[step]}
                </div>
                <span
                  className="whitespace-nowrap text-[11.5px]"
                  style={{ fontWeight: active ? 800 : 600, color: labelColor }}
                >
                  {t.steps[step]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function stepNumberLabel(step: CheckoutWizardStep, locale: StoredLocale): string {
  const idx = STEP_ORDER.indexOf(step) + 1;
  return locale === 'en' ? String(idx) : faDigits(idx);
}
