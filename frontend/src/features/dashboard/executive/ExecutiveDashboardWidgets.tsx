import { Link } from 'react-router-dom';
import type { CartableListResult } from '../../../types/cartable';
import type { LowSalesAlert, RevenueMixResult } from '../../../types/reporting';
import { faDigits, faMoney, faPercent } from '../../../lib/fa-format';
import { formatJalaliDateTime } from '../../../lib/jalali';
import PanelCard from '../../panel/PanelCard';
import { panelElevatedPadded, panelLink, panelMuted, panelMuted2 } from '../../panel/panel-theme';

const MIX_COLORS = { SYSTEM: '#3b82f6', CHARTER: '#a855f7', AGENCY: '#34d399' };

export function trendLabel(pct: number): string {
  if (pct === 0) return '۰٪';
  return `${pct > 0 ? '+' : '−'}${faDigits(Math.abs(pct))}٪`;
}

export function LowSalesAlertBanner({ alerts }: { alerts: LowSalesAlert[] }) {
  if (alerts.length === 0) return null;
  const a = alerts[0];
  return (
    <div className="mb-[15px] flex items-center gap-[11px] rounded-[14px] border border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.08)] p-[13px_15px]">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[rgba(245,158,11,.16)] text-[#f59e0b]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">
        <div className="text-[12.5px] font-extrabold text-[#fbbf24]">
          هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز
        </div>
        <div className="text-[11.5px] text-[#cdd7e5]">
          پرواز <span className="ltr font-mono">{a.flightNo}</span> {a.originCode} ← {a.destCode} (
          {formatJalaliDateTime(a.departureAt).split(' ')[0]}) تنها {faDigits(a.soldSeats)} از{' '}
          {faDigits(a.capacity)} صندلی فروخته شده است. این هشدار برای مدیر عامل، مدیر ارشد، مدیر مالی و
          مدیر بازرگانی ارسال شد.
        </div>
      </div>
    </div>
  );
}

export function RevenueMixSummary({ mix }: { mix: RevenueMixResult }) {
  const total = mix.totalIrr || 1;
  const sysPct = mix.channels.find((c) => c.channel === 'SYSTEM')?.pct ?? 0;
  const chPct = mix.channels.find((c) => c.channel === 'CHARTER')?.pct ?? 0;
  const agPct = mix.channels.find((c) => c.channel === 'AGENCY')?.pct ?? 0;

  return (
    <PanelCard
      title="گزارش مالی"
      subtitle="خلاصه فروش سال جاری — جزئیات و فیلترها در صفحه مالی"
      actions={
        <Link
          to="/panel/finance"
          className="rounded-[9px] border border-[rgba(59,130,246,.3)] bg-[rgba(59,130,246,.12)] px-3 py-[7px] text-[11.5px] font-bold text-panel-link"
        >
          مشاهده جزئیات ←
        </Link>
      }
    >
      <div className="mb-[7px] flex h-4 overflow-hidden rounded-lg bg-panel-elevated">
        <div style={{ width: `${sysPct}%`, background: MIX_COLORS.SYSTEM }} />
        <div style={{ width: `${chPct}%`, background: MIX_COLORS.CHARTER }} />
        <div style={{ width: `${agPct}%`, background: MIX_COLORS.AGENCY }} />
      </div>
      <div className={`mb-[13px] flex flex-wrap gap-[11px] text-[10px] ${panelMuted2}`}>
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-[9px] rounded-sm" style={{ background: MIX_COLORS.SYSTEM }} />
          سیستمی {faPercent(sysPct)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-[9px] rounded-sm" style={{ background: MIX_COLORS.CHARTER }} />
          چارتر {faPercent(chPct)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-[9px] rounded-sm" style={{ background: MIX_COLORS.AGENCY }} />
          آژانس {faPercent(agPct)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className={panelElevatedPadded}>
          <div className={`mb-[5px] text-[10.5px] ${panelMuted}`}>جمع فروش سال</div>
          <div className="text-base font-black text-white">{faMoney(total)}</div>
        </div>
        {mix.channels.map((c) => (
          <div key={c.channel} className={panelElevatedPadded}>
            <div className={`mb-[5px] flex items-center gap-1.5 text-[10.5px] ${panelMuted}`}>
              <span
                className="h-[9px] w-[9px] rounded-sm"
                style={{ background: MIX_COLORS[c.channel as keyof typeof MIX_COLORS] }}
              />
              فروش {c.labelFa.replace('فروش ', '')}
            </div>
            <div
              className="text-[13.5px] font-extrabold"
              style={{ color: MIX_COLORS[c.channel as keyof typeof MIX_COLORS] }}
            >
              {faMoney(c.amountIrr)}
            </div>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

const CATEGORY_ICON_BG: Record<string, string> = {
  ADMIN: 'rgba(59,130,246,.16)',
  AGENCY: 'rgba(245,158,11,.16)',
  MANAGER: 'rgba(168,85,247,.16)',
};

const CATEGORY_ICON_COLOR: Record<string, string> = {
  ADMIN: '#3b82f6',
  AGENCY: '#f59e0b',
  MANAGER: '#a855f7',
};

export function ExecutiveCartablePanel({ cartable }: { cartable: CartableListResult }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#2a3550] bg-panel-card">
      <div className="flex items-center gap-2 border-b border-panel-border px-[14px] py-3">
        <span className="relative flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[rgba(248,113,113,.16)] text-[#f87171]">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.5 21a2 2 0 0 1-3 0" />
          </svg>
        </span>
        <h3 className="m-0 flex-1 text-[13.5px] font-extrabold text-white">کارتابل</h3>
        {cartable.totalOpen > 0 && (
          <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-[#f87171] px-1.5 text-[10px] font-extrabold text-white">
            {faDigits(cartable.totalOpen)}
          </span>
        )}
      </div>
      <div className="px-[7px] py-[5px]">
        {cartable.tasks.length === 0 ? (
          <p className={`py-[18px] text-center text-[11.5px] ${panelMuted}`}>کارتابل خالی است ✓</p>
        ) : (
          cartable.tasks.slice(0, 4).map((t) => (
            <div key={t.id} className="flex items-start gap-[9px] rounded-[10px] px-2.5 py-2.5">
              <span
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] text-sm"
                style={{
                  background: CATEGORY_ICON_BG[t.category] ?? 'rgba(59,130,246,.16)',
                  color: CATEGORY_ICON_COLOR[t.category] ?? '#3b82f6',
                }}
              >
                ✉
              </span>
              <div className="min-w-0 leading-snug">
                <div className="text-[11.5px] font-bold text-panel-text">{t.title}</div>
                <div className={`mt-0.5 text-[10.5px] ${panelMuted}`}>
                  {formatJalaliDateTime(t.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <Link
        to="/panel/cartable"
        className={`block border-t border-panel-border px-[14px] py-[11px] text-center text-[11.5px] ${panelLink}`}
      >
        مشاهده‌ی همه‌ی کارها ←
      </Link>
    </div>
  );
}
