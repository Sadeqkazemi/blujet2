import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchAgencies,
  fetchAgencyRequests,
  notifyAllDebtors,
  settleAgency,
} from '../../api/agencies';
import { faDigits, faMoney } from '../../lib/fa-format';
import { TIER_LABELS, statusBadge } from './agency-labels';
import type { AgencyListResult, AgencyListRow, AgencyMembershipRequest } from '../../types/agencies';
import PanelAlert from '../panel/PanelAlert';
import PanelCard from '../panel/PanelCard';
import {
  panelBtnPrimary,
  panelCard,
  panelInput,
  panelMuted,
  panelSegmentBtn,
  panelSegmented,
} from '../panel/panel-theme';

type SubTab = 'list' | 'credit';

function KpiCard({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className={`${panelCard} p-4`}>
      <div className={`text-[11px] ${panelMuted}`}>{label}</div>
      <div className={`mt-1 text-lg font-black ${valueClass}`}>{value}</div>
    </div>
  );
}

function CreditBar({ usedIrr, limitIrr }: { usedIrr: number; limitIrr: number }) {
  const pct = limitIrr > 0 ? Math.min((usedIrr / limitIrr) * 100, 100) : usedIrr > 0 ? 100 : 0;
  const tone = pct >= 90 ? 'bg-[#f87171]' : pct >= 60 ? 'bg-[#f59e0b]' : 'bg-[#34d399]';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-panel-elevated">
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AgenciesListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const isCommercial = role === 'COMMERCIAL_MANAGER';

  const [q, setQ] = useState('');
  const [subTab, setSubTab] = useState<SubTab>('list');
  const [result, setResult] = useState<AgencyListResult | null>(null);
  const [requests, setRequests] = useState<AgencyMembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, reqs] = await Promise.all([fetchAgencies({ q: q || undefined }), fetchAgencyRequests()]);
      setResult(list);
      setRequests(reqs);
    } catch {
      setError('خطا در دریافت فهرست آژانس‌ها.');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'PENDING' || r.status === 'REFERRED'),
    [requests],
  );

  const debtors = useMemo(
    () => (result?.agencies ?? []).filter((a) => Number(a.usedIrr) > 0 || a.pendingInvoiceCount > 0),
    [result],
  );

  async function onSettle(agency: AgencyListRow) {
    setSettlingId(agency.id);
    setNotice(null);
    try {
      await settleAgency(agency.id);
      setNotice(`تسویه حساب ${agency.fullName} ثبت شد ✓`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت تسویه.');
    } finally {
      setSettlingId(null);
    }
  }

  async function onNotifyAll() {
    setNotice(null);
    try {
      const { notifiedCount } = await notifyAllDebtors();
      setNotice(`اعلان بدهی برای ${faDigits(notifiedCount)} آژانس ارسال شد ✓`);
    } catch {
      setError('خطا در ارسال اعلان.');
    }
  }

  const kpis = result?.kpis;

  return (
    <div>
      {error && <PanelAlert>{error}</PanelAlert>}
      {notice && <PanelAlert tone="success">{notice}</PanelAlert>}

      <PanelCard
        className="mb-6"
        title={isCommercial ? 'درخواست‌های همکاری آژانس‌ها' : 'درخواست‌های جدید عضویت'}
        actions={
          <span className="rounded-full bg-[rgba(245,158,11,.16)] px-3 py-1 text-[11px] font-bold text-[#f59e0b]">
            {faDigits(pendingRequests.length)} {isCommercial ? 'درخواست' : 'در انتظار'}
          </span>
        }
      >
        {pendingRequests.length === 0 ? (
          <p className={`py-3 text-center text-xs ${panelMuted}`}>
            {isCommercial ? 'درخواست همکاری جدیدی وجود ندارد.' : 'درخواست جدیدی در انتظار تأیید نیست.'}
          </p>
        ) : (
          <ul className="divide-y divide-panel-border">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-elevated text-sm font-black text-panel-link">
                  {r.applicantName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{r.applicantName}</div>
                  <div className={`mt-0.5 text-[11px] ${panelMuted}`}>
                    مدیر: {r.managerName} · مجوز <span className="ltr font-mono">{r.licenseNo}</span> · {r.city}
                  </div>
                </div>
                {r.status === 'REFERRED' && (
                  <span className="rounded-full bg-[rgba(59,130,246,.16)] px-2.5 py-1 text-[10px] font-bold text-panel-link">
                    ارجاع‌شده
                  </span>
                )}
                <Link to={`/panel/agencies/requests/${r.id}`} className={panelBtnPrimary}>
                  {isCommercial ? 'بررسی و اقدام' : 'بررسی درخواست'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {!isCommercial && kpis && (
        <div className="mb-6 grid grid-cols-2 gap-[13px] md:grid-cols-4">
          <KpiCard label="آژانس‌های فعال" value={faDigits(kpis.activeCount)} valueClass="text-white" />
          <KpiCard label="مجموع اعتبار اعطاشده" value={`${faMoney(kpis.totalCreditGrantedIrr)} تومان`} valueClass="text-panel-link" />
          <KpiCard label="اعتبار مصرف‌شده (بدهی)" value={`${faMoney(kpis.totalUsedIrr)} تومان`} valueClass="text-[#f87171]" />
          <KpiCard label="در انتظار تسویه" value={faDigits(kpis.pendingSettlementCount)} valueClass="text-[#f59e0b]" />
        </div>
      )}

      {isCommercial && debtors.length > 0 && (
        <section className="mb-6 rounded-[14px] border border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.08)] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#fbbf24]">
              آژانس‌های دارای بدهی یا فاکتور پرداخت‌نشده
              <span className="mr-2 rounded-full bg-[rgba(245,158,11,.16)] px-2.5 py-0.5 text-[11px] font-bold">
                {faDigits(debtors.length)} آژانس
              </span>
            </h2>
            <button
              type="button"
              onClick={() => void onNotifyAll()}
              className="rounded-lg bg-[#f59e0b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#d97706]"
            >
              ارسال اعلان به همه
            </button>
          </div>
          <ul className="divide-y divide-[rgba(245,158,11,.2)]">
            {debtors.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-bold text-white">{d.fullName}</span>
                <span className="text-xs text-[#fbbf24]">مبلغ {faMoney(d.usedIrr)} تومان</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isCommercial && (
        <div className={`mb-4 ${panelSegmented} w-max`}>
          {(
            [
              { key: 'list', label: 'آژانس‌های همکار' },
              { key: 'credit', label: 'اعتبار و تسویه' },
            ] as { key: SubTab; label: string }[]
          ).map((t) => (
            <button key={t.key} type="button" onClick={() => setSubTab(t.key)} className={panelSegmentBtn(subTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isCommercial && <h2 className="mb-3 text-sm font-bold text-white">آژانس‌های همکار</h2>}

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی آژانس بر اساس نام، مجوز، مدیر یا شهر…"
          className={`h-[46px] w-full px-4 text-xs ${panelInput}`}
        />
      </div>

      {loading ? (
        <p className={`py-10 text-center text-sm ${panelMuted}`}>در حال بارگذاری…</p>
      ) : (result?.agencies.length ?? 0) === 0 ? (
        <p className={`py-10 text-center text-sm ${panelMuted}`}>آژانسی با این عبارت یافت نشد.</p>
      ) : subTab === 'credit' && !isCommercial ? (
        <ul className="space-y-3">
          {result!.agencies.map((a) => {
            const settled = Number(a.usedIrr) <= 0;
            return (
              <li key={a.id} className={`flex flex-wrap items-center gap-4 ${panelCard} p-4`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-elevated text-sm font-black text-panel-link">
                  {a.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{a.fullName}</div>
                  <div className={`mt-0.5 text-[11px] ${panelMuted}`}>
                    مجوز <span className="ltr font-mono">{a.licenseNo}</span> · {a.city}
                  </div>
                </div>
                <div className="text-left">
                  <div className={`text-[10px] ${panelMuted}`}>بدهی جاری</div>
                  <div className={`text-sm font-black ${settled ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {faMoney(Math.max(Number(a.usedIrr), 0))} تومان
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                    settled ? 'bg-[rgba(52,211,153,.16)] text-[#34d399]' : 'bg-[rgba(245,158,11,.16)] text-[#f59e0b]'
                  }`}
                >
                  {settled ? 'تسویه شد' : 'در انتظار پرداخت'}
                </span>
                <button
                  type="button"
                  disabled={settled || settlingId === a.id}
                  onClick={() => void onSettle(a)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    settled
                      ? 'cursor-default bg-panel-elevated text-panel-muted'
                      : 'bg-[#34d399] text-white hover:bg-[#10b981]'
                  }`}
                >
                  {settled ? 'تسویه شده' : settlingId === a.id ? 'در حال ثبت…' : 'ثبت تسویه'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-3">
          {result!.agencies.map((a) => {
            const badge = statusBadge(a.isActive);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/panel/agencies/${a.id}`)}
                  className={`flex w-full flex-wrap items-center gap-4 ${panelCard} p-4 text-right transition hover:border-panel-accent/40`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel-elevated text-base font-black text-panel-link">
                    {a.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">{a.fullName}</div>
                    <div className={`mt-0.5 text-[11px] ${panelMuted}`}>
                      مجوز <span className="ltr font-mono">{a.licenseNo}</span> · {a.city} · سطح همکاری{' '}
                      <span className="font-bold text-[#f59e0b]">{TIER_LABELS[a.tier]}</span>
                    </div>
                  </div>
                  <div className="w-44">
                    <div className={`mb-1 flex items-center justify-between text-[10px] ${panelMuted}`}>
                      <span>اعتبار (مانده / سقف)</span>
                      <span>
                        {faMoney(Math.max(Number(a.remainingIrr), 0))} / {faMoney(a.limitIrr)}
                      </span>
                    </div>
                    <CreditBar usedIrr={Math.max(Number(a.usedIrr), 0)} limitIrr={Number(a.limitIrr)} />
                  </div>
                  <div className="text-left">
                    <div className={`text-[10px] ${panelMuted}`}>بدهی جاری</div>
                    <div className={`text-sm font-black ${Number(a.usedIrr) > 0 ? 'text-[#f87171]' : 'text-[#34d399]'}`}>
                      {faMoney(Math.max(Number(a.usedIrr), 0))} تومان
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${badge.className}`}>{badge.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
