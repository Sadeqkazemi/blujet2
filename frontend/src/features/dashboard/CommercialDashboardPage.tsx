import { useEffect, useState, type ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchCartable } from '../../api/cartable';
import {
  fetchAgencies,
  fetchAgencyRequests,
  fetchAggregateSeatRequests,
  notifyAllDebtors,
} from '../../api/agencies';
import { fetchCommercialOverview, fetchRevenueMix, fetchSalesChart } from '../../api/reporting';
import type { CartableListResult } from '../../types/cartable';
import type {
  AgencyListRow,
  AgencyMembershipRequest,
  AgencySeatRequestRow,
} from '../../types/agencies';
import type { CommercialOverview, RevenueMixResult, SalesChartPeriod } from '../../types/reporting';
import type { PanelShellContext } from '../../types/panel-shell';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import LowSalesBanner from '../../components/LowSalesBanner';
import PanelNotifBell from '../../components/PanelNotifBell';
import SalesBarChart from '../../components/SalesBarChart';
import SalesChartControls from '../../components/SalesChartControls';
import { useSalesChartQuery } from '../../hooks/useSalesChartQuery';

const MIX_COLORS = { SYSTEM: '#3b82f6', CHARTER: '#a855f7', AGENCY: '#34d399' };

function KpiIcon({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-[11px]"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}

function KpiCard({
  label,
  value,
  trend,
  icon,
}: {
  label: string;
  value: string;
  trend?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[14px]">
      <div className="mb-3 flex items-center justify-between">
        {icon}
        {trend ? (
          <span className="text-[11px] font-bold text-[#34d399]">{trend}</span>
        ) : null}
      </div>
      <div className="font-num text-[22.5px] font-black text-white">{value}</div>
      <div className="mt-1 text-[11.5px] text-[#6b7b94]">{label}</div>
    </div>
  );
}

function FinancialSummaryCard({ mix }: { mix: RevenueMixResult }) {
  const total = mix.totalIrr || 1;
  const sys = mix.channels.find((c) => c.channel === 'SYSTEM');
  const ch = mix.channels.find((c) => c.channel === 'CHARTER');
  const ag = mix.channels.find((c) => c.channel === 'AGENCY');
  const sysPct = sys?.pct ?? 0;
  const chPct = ch?.pct ?? 0;
  const agPct = ag?.pct ?? 0;

  return (
    <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="m-0 text-[14.5px] font-extrabold text-white">گزارش مالی</h2>
          <p className="mt-1 text-[11px] text-[#6b7b94]">
            خلاصه فروش سال جاری — جزئیات و فیلترها در صفحه مالی
          </p>
        </div>
        <Link
          to="/panel/finance"
          className="rounded-[9px] border border-[rgba(59,130,246,.3)] bg-[rgba(59,130,246,.12)] px-3 py-1.5 text-[11.5px] font-bold text-[#60a5fa]"
        >
          مشاهده جزئیات ←
        </Link>
      </div>

      <div className="mb-1.5 flex h-4 overflow-hidden rounded-lg bg-[#18223a]">
        <div style={{ width: `${sysPct}%`, background: MIX_COLORS.SYSTEM }} />
        <div style={{ width: `${chPct}%`, background: MIX_COLORS.CHARTER }} />
        <div style={{ width: `${agPct}%`, background: MIX_COLORS.AGENCY }} />
      </div>
      <div className="mb-3.5 flex flex-wrap gap-3 text-[10px] text-[#9fb0c7]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MIX_COLORS.SYSTEM }} />
          سیستمی {faPercent(sysPct)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MIX_COLORS.CHARTER }} />
          چارتر {faPercent(chPct)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MIX_COLORS.AGENCY }} />
          آژانس {faPercent(agPct)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[12px] border border-[#28344c] bg-[#18223a] p-3">
          <div className="mb-1 text-[10.5px] text-[#6b7b94]">جمع فروش سال</div>
          <div className="font-num text-base font-black text-white">{faMoney(total)}</div>
        </div>
        <div className="rounded-[12px] border border-[#28344c] bg-[#18223a] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-[#6b7b94]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MIX_COLORS.SYSTEM }} />
            فروش سیستمی
          </div>
          <div className="font-num text-[13.5px] font-extrabold text-[#60a5fa]">
            {faMoney(sys?.amountIrr ?? 0)}
          </div>
        </div>
        <div className="rounded-[12px] border border-[#28344c] bg-[#18223a] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-[#6b7b94]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MIX_COLORS.CHARTER }} />
            فروش چارتری
          </div>
          <div className="font-num text-[13.5px] font-extrabold text-[#a855f7]">
            {faMoney(ch?.amountIrr ?? 0)}
          </div>
        </div>
        <div className="rounded-[12px] border border-[#28344c] bg-[#18223a] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-[#6b7b94]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MIX_COLORS.AGENCY }} />
            فروش آژانس
          </div>
          <div className="font-num text-[13.5px] font-extrabold text-[#34d399]">
            {faMoney(ag?.amountIrr ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesChartCard({
  periods,
  chartLoading,
  chartError,
  chartQuery,
}: {
  periods: SalesChartPeriod[];
  chartLoading: boolean;
  chartError: string | null;
  chartQuery: ReturnType<typeof useSalesChartQuery>;
}) {
  return (
    <div
      className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]"
      data-testid="commercial-dashboard-sales-chart"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-[14.5px] font-extrabold text-white">نمودار فروش</h2>
          <p className="mt-1 text-[11px] text-[#6b7b94]">فیلتر روزانه / ماهانه / فصلی</p>
        </div>
        <Link
          to="/panel/finance"
          className="text-[11px] font-bold text-[#60a5fa]"
        >
          جزئیات مالی ←
        </Link>
      </div>
      <SalesChartControls
        modes={chartQuery.modes}
        granularity={chartQuery.granularity}
        onGranularityChange={chartQuery.setGranularity}
        selectedDate={chartQuery.selectedDate}
        onSelectedDateChange={chartQuery.setSelectedDate}
        selectedMonthStart={chartQuery.selectedMonthStart}
        onSelectedMonthStartChange={chartQuery.setSelectedMonthStart}
        flightNo={chartQuery.flightNo}
        onFlightNoChange={chartQuery.setFlightNo}
        onApplyFlightNo={chartQuery.applyFlightNo}
        variant="segmented"
        theme="dark"
      />
      {chartError ? (
        <p className="py-6 text-center text-xs text-[#f87171]">{chartError}</p>
      ) : chartLoading ? (
        <p className="py-6 text-center text-xs text-[#6b7b94]">در حال بارگذاری نمودار…</p>
      ) : periods.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#6b7b94]">داده‌ای برای این بازه یافت نشد.</p>
      ) : (
        <SalesBarChart
          periods={periods}
          selectedPeriodKey={chartQuery.periodKey}
          onSelectPeriod={chartQuery.setPeriodKey}
          theme="dark"
        />
      )}
    </div>
  );
}

function CartableWidget({ cartable }: { cartable: CartableListResult }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#2a3550] bg-[#141d2e]">
      <div className="flex items-center gap-2 border-b border-[#1f2a3d] px-3.5 py-3">
        <span className="relative flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[rgba(248,113,113,.16)] text-[#f87171]">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.5 21a2 2 0 0 1-3 0" />
          </svg>
        </span>
        <h3 className="m-0 flex-1 text-[13.5px] font-extrabold text-white">کارتابل</h3>
        {cartable.totalOpen > 0 && (
          <span className="font-num flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-[#f87171] px-1.5 text-[10px] font-extrabold text-white">
            {faDigits(cartable.totalOpen)}
          </span>
        )}
      </div>
      <div className="px-1.5 py-1">
        {cartable.tasks.length === 0 ? (
          <p className="px-2.5 py-[18px] text-center text-[11.5px] text-[#6b7b94]">کارتابل خالی است ✓</p>
        ) : (
          cartable.tasks.slice(0, 4).map((t) => (
            <Link
              key={t.id}
              to="/panel/cartable"
              className="flex items-start gap-2.5 rounded-[10px] px-2.5 py-2.5 transition hover:bg-[#18223a]"
            >
              <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[rgba(59,130,246,.16)] text-[#60a5fa]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </span>
              <div className="min-w-0 leading-snug">
                <div className="text-[11.5px] font-bold text-[#e7ecf3]">{t.title}</div>
                <div className="mt-0.5 text-[10.5px] text-[#6b7b94]">
                  {t.senderLabelFa ?? t.sender?.fullName ?? ''}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      <Link
        to="/panel/cartable"
        className="block border-t border-[#1f2a3d] py-2.5 text-center text-[11.5px] font-bold text-[#60a5fa]"
      >
        مشاهده‌ی همه‌ی کارها ←
      </Link>
    </div>
  );
}

function DebtorsPanel({
  debtors,
  onNotifyAll,
  busy,
}: {
  debtors: AgencyListRow[];
  onNotifyAll: () => void;
  busy: boolean;
}) {
  if (debtors.length === 0) return null;
  return (
    <div className="rounded-[14px] border border-[#f8717144] bg-[#141d2e] p-[15px]" data-testid="commercial-debtors">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-[13.5px] font-extrabold text-white">آژانس‌های بدهکار</h3>
          <p className="mt-1 text-[11px] text-[#6b7b94]">نیاز به پیگیری تسویه یا یادآوری پرداخت</p>
        </div>
        <span className="rounded-full bg-[#f8717124] px-2.5 py-1 text-[10px] font-bold text-[#f87171]">
          {faDigits(debtors.length)} آژانس
        </span>
      </div>
      <ul className="mb-3 flex flex-col gap-2">
        {debtors.slice(0, 4).map((agency) => (
          <li key={agency.id} className="flex items-center justify-between rounded-[10px] bg-[#18223a] px-3 py-2.5">
            <Link to={`/panel/agencies/${agency.id}`} className="text-[11.5px] font-bold text-[#e7ecf3] hover:text-[#60a5fa]">
              {agency.fullName}
            </Link>
            <span className="font-num text-[11px] font-bold text-[#f87171]">
              {faMoney(agency.usedIrr)} تومان
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={onNotifyAll}
        className="w-full rounded-[10px] border border-[#f8717144] bg-[#f8717114] py-2.5 text-[11.5px] font-bold text-[#f87171] disabled:opacity-50"
      >
        {busy ? 'در حال ارسال…' : 'ارسال اخطار بدهی برای همه'}
      </button>
    </div>
  );
}

function AgencyRequestsPanel({ requests }: { requests: AgencyMembershipRequest[] }) {
  const pending = requests.filter((r) => r.status === 'PENDING' || r.status === 'REFERRED');
  return (
    <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]" data-testid="commercial-co-op-requests">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-[13.5px] font-extrabold text-white">درخواست همکاری آژانس‌ها</h3>
        {pending.length > 0 && (
          <span className="font-num rounded-full bg-[#34d39924] px-2 py-0.5 text-[10px] font-bold text-[#34d399]">
            {faDigits(pending.length)}
          </span>
        )}
      </div>
      {pending.length === 0 ? (
        <p className="py-4 text-center text-[11.5px] text-[#6b7b94]">درخواست همکاری جدیدی وجود ندارد.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.slice(0, 4).map((req) => (
            <li key={req.id}>
              <Link
                to="/panel/agencies"
                className="flex items-center justify-between rounded-[10px] bg-[#18223a] px-3 py-2.5 transition hover:bg-[#1f2a3d]"
              >
                <span className="text-[11.5px] font-bold text-[#e7ecf3]">{req.applicantName}</span>
                <span className="text-[10px] text-[#6b7b94]">{req.city}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/panel/agencies" className="mt-3 block text-center text-[11px] font-bold text-[#60a5fa]">
        مدیریت آژانس‌ها ←
      </Link>
    </div>
  );
}

function SeatRequestsPanel({ requests }: { requests: AgencySeatRequestRow[] }) {
  const pending = requests.filter((r) => r.status === 'PENDING' || r.status === 'PENDING_FINANCE');
  return (
    <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]" data-testid="commercial-seat-requests">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-[13.5px] font-extrabold text-white">درخواست صندلی آژانس‌ها</h3>
        {pending.length > 0 && (
          <span className="font-num rounded-full bg-[#a855f724] px-2 py-0.5 text-[10px] font-bold text-[#a855f7]">
            {faDigits(pending.length)}
          </span>
        )}
      </div>
      {pending.length === 0 ? (
        <p className="py-4 text-center text-[11.5px] text-[#6b7b94]">درخواست صندلی در انتظار بررسی نیست.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.slice(0, 4).map((req) => (
            <li key={req.id} className="rounded-[10px] bg-[#18223a] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-bold text-[#e7ecf3]">{req.agencyName}</span>
                <span className="font-num text-[10px] text-[#34d399]">{faDigits(req.seats)} صندلی</span>
              </div>
              <div className="mt-1 text-[10px] text-[#6b7b94]">{req.routeFa} · {req.aircraftType}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CommercialDashboardPage() {
  const { lowSalesAlerts = [] } = useOutletContext<PanelShellContext>();
  const bannerAlert = lowSalesAlerts[0] ?? null;
  const notifAlerts = lowSalesAlerts.slice(1);
  const chartQuery = useSalesChartQuery();
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [cartable, setCartable] = useState<CartableListResult | null>(null);
  const [chartPeriods, setChartPeriods] = useState<SalesChartPeriod[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [debtors, setDebtors] = useState<AgencyListRow[]>([]);
  const [agencyRequests, setAgencyRequests] = useState<AgencyMembershipRequest[]>([]);
  const [seatRequests, setSeatRequests] = useState<AgencySeatRequestRow[]>([]);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchCommercialOverview(),
      fetchRevenueMix({ granularity: 'year' }),
      fetchCartable(),
      fetchAgencies({ debtorsOnly: true }),
      fetchAgencyRequests(),
      fetchAggregateSeatRequests(),
    ])
      .then(([ov, mixData, cartableData, debtorData, requests, seats]) => {
        setOverview(ov);
        setMix(mixData);
        setCartable(cartableData);
        setDebtors(debtorData.agencies);
        setAgencyRequests(requests);
        setSeatRequests(seats);
      })
      .catch(() => setError('خطا در دریافت اطلاعات داشبورد.'));
  }, []);

  useEffect(() => {
    if (!chartQuery.isQueryReady) {
      setChartPeriods([]);
      setChartLoading(false);
      return;
    }
    setChartLoading(true);
    setChartError(null);
    fetchSalesChart(chartQuery.query)
      .then((result) => setChartPeriods(result))
      .catch(() => setChartError('خطا در دریافت نمودار فروش.'))
      .finally(() => setChartLoading(false));
  }, [chartQuery.query, chartQuery.isQueryReady]);

  async function onNotifyAllDebtors() {
    setNotifyBusy(true);
    setNotice(null);
    try {
      const result = await notifyAllDebtors();
      setNotice(`اخطار بدهی برای ${faDigits(result.notifiedCount)} آژانس ارسال شد ✓`);
    } catch {
      setError('ارسال اخطار بدهی انجام نشد.');
    } finally {
      setNotifyBusy(false);
    }
  }

  if (error) {
    return <p className="px-[21px] py-8 text-sm text-[#f87171]">{error}</p>;
  }
  if (!overview || !mix || !cartable) {
    return <p className="px-[21px] py-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;
  }

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[20.5px] font-black text-white">داشبورد</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">نمای کلی فروش و کارهای در انتظار اقدام</p>
        </div>
        <PanelNotifBell alerts={notifAlerts} variant="dark" />
      </div>

      {notice && (
        <p className="mb-4 rounded-lg bg-[#34d39915] p-3 text-sm text-[#34d399]">{notice}</p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-[13px] md:grid-cols-3">
        <KpiCard
          label="آژانس فعال"
          value={faDigits(overview.activeAgencies)}
          icon={
            <KpiIcon bg="rgba(59,130,246,.16)" color="#3b82f6">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 21h18" />
                <path d="M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
                <path d="M19 21V10a1 1 0 0 0-1-1h-3" />
              </svg>
            </KpiIcon>
          }
        />
        <KpiCard
          label="مسافر این ماه"
          value={faDigits(overview.passengersThisMonth)}
          icon={
            <KpiIcon bg="rgba(147,51,234,.16)" color="#a855f7">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                <path d="M16 5a3.2 3.2 0 0 1 0 6.4" />
                <path d="M18 14.5c1.9.6 3.4 2.4 3.4 4.5" />
              </svg>
            </KpiIcon>
          }
        />
        <KpiCard
          label="درخواست همکاری آژانس‌ها"
          value={faDigits(overview.pendingAgencyRequests)}
          icon={
            <KpiIcon bg="rgba(16,185,129,.16)" color="#34d399">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                <path d="M12 11v6M9 14h6" />
              </svg>
            </KpiIcon>
          }
        />
      </div>

      <LowSalesBanner alert={bannerAlert} variant="dark" />

      <div className="mb-[15px]">
        <SalesChartCard
          periods={chartPeriods}
          chartLoading={chartLoading}
          chartError={chartError}
          chartQuery={chartQuery}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-[15px] lg:grid-cols-[1.7fr_1fr]">
        <FinancialSummaryCard mix={mix} />
        <CartableWidget cartable={cartable} />
      </div>

      <div className="mt-[15px] grid grid-cols-1 gap-[15px] lg:grid-cols-3">
        <DebtorsPanel debtors={debtors} onNotifyAll={() => void onNotifyAllDebtors()} busy={notifyBusy} />
        <AgencyRequestsPanel requests={agencyRequests} />
        <SeatRequestsPanel requests={seatRequests} />
      </div>
    </div>
  );
}
