import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchCartable } from '../../api/cartable';
import { fetchCommercialOverview, fetchRevenueMix } from '../../api/reporting';
import type { CartableListResult } from '../../types/cartable';
import type { CommercialOverview, RevenueMixResult } from '../../types/reporting';
import type { PanelShellContext } from '../../types/panel-shell';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import LowSalesBanner from '../../components/LowSalesBanner';
import PanelNotifBell from '../../components/PanelNotifBell';

const MIX_COLORS = { SYSTEM: '#1668c4', CHARTER: '#a855f7', AGENCY: '#059669' };

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-lg"
          style={{ background: `${accent}29`, color: accent }}
        >
          ●
        </span>
      </div>
      <div className="font-num text-2xl font-black text-panel-ink">{value}</div>
      <div className="mt-1 text-[11.5px] text-panel-muted">{label}</div>
    </div>
  );
}

function FinancialSummaryCard({ mix }: { mix: RevenueMixResult }) {
  const total = mix.totalIrr || 1;
  const sysPct = mix.channels.find((c) => c.channel === 'SYSTEM')?.pct ?? 0;
  const chPct = mix.channels.find((c) => c.channel === 'CHARTER')?.pct ?? 0;
  const agPct = mix.channels.find((c) => c.channel === 'AGENCY')?.pct ?? 0;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-ink">گزارش مالی</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            خلاصه فروش سال جاری — جزئیات و فیلترها در صفحه مالی
          </p>
        </div>
        <Link
          to="/panel/finance"
          className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent"
        >
          مشاهده جزئیات ←
        </Link>
      </div>

      <div className="mb-2 flex h-4 overflow-hidden rounded-lg bg-body">
        <div style={{ width: `${sysPct}%`, background: MIX_COLORS.SYSTEM }} />
        <div style={{ width: `${chPct}%`, background: MIX_COLORS.CHARTER }} />
        <div style={{ width: `${agPct}%`, background: MIX_COLORS.AGENCY }} />
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.SYSTEM }} />
          سیستمی {faPercent(sysPct)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.CHARTER }} />
          چارتر {faPercent(chPct)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.AGENCY }} />
          آژانس {faPercent(agPct)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-body p-3">
          <div className="text-[10.5px] text-muted">جمع فروش سال</div>
          <div className="font-num mt-1 text-base font-black text-ink">{faMoney(total)}</div>
        </div>
        {mix.channels.map((c) => (
          <div key={c.channel} className="rounded-xl bg-body p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-muted">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: MIX_COLORS[c.channel as keyof typeof MIX_COLORS] }}
              />
              فروش {c.labelFa.replace('فروش ', '')}
            </div>
            <div
              className="font-num text-sm font-extrabold"
              style={{ color: MIX_COLORS[c.channel as keyof typeof MIX_COLORS] }}
            >
              {faMoney(c.amountIrr)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartableWidget({ cartable }: { cartable: CartableListResult }) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="text-sm font-bold text-panel-ink">کارتابل</span>
        {cartable.totalOpen > 0 && (
          <span className="font-num rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
            {faDigits(cartable.totalOpen)}
          </span>
        )}
      </div>
      <div className="p-2">
        {cartable.tasks.length === 0 ? (
          <p className="py-4 text-center text-xs text-panel-muted">کارتابل خالی است ✓</p>
        ) : (
          cartable.tasks.slice(0, 4).map((t) => (
            <div key={t.id} className="rounded-lg px-2.5 py-2.5 text-xs">
              <div className="font-bold text-panel-ink">{t.title}</div>
              <div className="mt-0.5 text-[10px] text-panel-muted">
                {t.senderLabelFa ?? t.sender?.fullName ?? ''}
              </div>
            </div>
          ))
        )}
      </div>
      <Link
        to="/panel/cartable"
        className="block border-t border-white/10 py-3 text-center text-[11.5px] font-bold text-accent"
      >
        مشاهده‌ی همه‌ی کارها ←
      </Link>
    </div>
  );
}

export default function CommercialDashboardPage() {
  const { lowSalesAlerts = [] } = useOutletContext<PanelShellContext>();
  const bannerAlert = lowSalesAlerts[0] ?? null;
  const notifAlerts = lowSalesAlerts.slice(1);
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [cartable, setCartable] = useState<CartableListResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCommercialOverview(), fetchRevenueMix({ granularity: 'year' }), fetchCartable()])
      .then(([ov, mixData, cartableData]) => {
        setOverview(ov);
        setMix(mixData);
        setCartable(cartableData);
      })
      .catch(() => setError('خطا در دریافت اطلاعات داشبورد.'));
  }, []);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!overview || !mix || !cartable) {
    return <p className="p-8 text-sm text-panel-muted">در حال بارگذاری…</p>;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">داشبورد</h1>
          <p className="mt-1 text-sm text-muted">نمای کلی فروش و کارهای در انتظار اقدام</p>
        </div>
        <PanelNotifBell alerts={notifAlerts} variant="light" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="آژانس فعال"
          value={faDigits(overview.activeAgencies)}
          accent="#1668c4"
        />
        <KpiCard
          label="مسافر این ماه"
          value={faDigits(overview.passengersThisMonth)}
          accent="#a855f7"
        />
        <KpiCard
          label="درخواست همکاری آژانس‌ها"
          value={faDigits(overview.pendingAgencyRequests)}
          accent="#059669"
        />
      </div>

      <LowSalesBanner alert={bannerAlert} variant="light" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <FinancialSummaryCard mix={mix} />
        <CartableWidget cartable={cartable} />
      </div>
    </div>
  );
}
