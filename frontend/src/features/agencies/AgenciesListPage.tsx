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

type SubTab = 'list' | 'credit';

function KpiCard({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`font-num mt-1 text-lg font-black ${valueClass}`}>{value}</div>
    </div>
  );
}

function CreditBar({ usedIrr, limitIrr }: { usedIrr: number; limitIrr: number }) {
  const pct = limitIrr > 0 ? Math.min((usedIrr / limitIrr) * 100, 100) : usedIrr > 0 ? 100 : 0;
  const tone = pct >= 90 ? 'bg-danger' : pct >= 60 ? 'bg-[#f59e0b]' : 'bg-[#059669]';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-surface">
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
    () => (result?.agencies ?? []).filter((a) => a.usedIrr > 0 || a.pendingInvoiceCount > 0),
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
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-ink">آژانس‌ها</h1>
        <p className="mt-1 text-sm text-muted">
          {isCommercial ? 'آژانس‌های همکار، فاکتورها و مکاتبه‌ها' : 'مدیریت آژانس‌های همکار، اعتبار و تسویه'}
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      <section className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">
            {isCommercial ? 'درخواست‌های همکاری آژانس‌ها' : 'درخواست‌های جدید عضویت'}
          </h2>
          <span className="rounded-full bg-[#f59e0b1f] px-3 py-1 text-[11px] font-bold text-[#b45309]">
            {faDigits(pendingRequests.length)} {isCommercial ? 'درخواست' : 'در انتظار'}
          </span>
        </div>
        {pendingRequests.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            {isCommercial ? 'درخواست همکاری جدیدی وجود ندارد.' : 'درخواست جدیدی در انتظار تأیید نیست.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-sm font-black text-accent">
                  {r.applicantName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">{r.applicantName}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    مدیر: {r.managerName} · مجوز <span className="ltr font-num">{r.licenseNo}</span> · {r.city}
                  </div>
                </div>
                {r.status === 'REFERRED' && (
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent">ارجاع‌شده</span>
                )}
                <Link
                  to={`/panel/agencies/requests/${r.id}`}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
                >
                  {isCommercial ? 'بررسی و اقدام' : 'بررسی درخواست'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isCommercial && kpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="آژانس‌های فعال" value={faDigits(kpis.activeCount)} valueClass="text-ink" />
          <KpiCard label="مجموع اعتبار اعطاشده" value={`${faMoney(kpis.totalCreditGrantedIrr)} تومان`} valueClass="text-accent" />
          <KpiCard label="اعتبار مصرف‌شده (بدهی)" value={`${faMoney(kpis.totalUsedIrr)} تومان`} valueClass="text-danger" />
          <KpiCard label="در انتظار تسویه" value={faDigits(kpis.pendingSettlementCount)} valueClass="text-[#b45309]" />
        </div>
      )}

      {isCommercial && debtors.length > 0 && (
        <section className="mb-6 rounded-xl border border-[#f59e0b40] bg-[#f59e0b0d] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#92400e]">
              آژانس‌های دارای بدهی یا فاکتور پرداخت‌نشده
              <span className="mr-2 rounded-full bg-[#f59e0b26] px-2.5 py-0.5 text-[11px] font-bold">
                {faDigits(debtors.length)} آژانس
              </span>
            </h2>
            <button
              onClick={() => void onNotifyAll()}
              className="rounded-lg bg-[#b45309] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#92400e]"
            >
              ارسال اعلان به همه
            </button>
          </div>
          <ul className="divide-y divide-[#f59e0b26]">
            {debtors.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-bold text-ink">{d.fullName}</span>
                <span className="font-num text-xs text-[#92400e]">مبلغ {faMoney(d.usedIrr)} تومان</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isCommercial && (
        <div className="mb-4 flex gap-1.5">
          {(
            [
              { key: 'list', label: 'آژانس‌های همکار' },
              { key: 'credit', label: 'اعتبار و تسویه' },
            ] as { key: SubTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                subTab === t.key ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isCommercial && <h2 className="mb-3 text-sm font-bold text-ink">آژانس‌های همکار</h2>}

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی آژانس بر اساس نام، مجوز، مدیر یا شهر…"
          className="h-[46px] w-full rounded-xl border border-border bg-white px-4 text-xs text-ink outline-none transition focus:border-accent"
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">در حال بارگذاری…</p>
      ) : (result?.agencies.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-muted">آژانسی با این عبارت یافت نشد.</p>
      ) : subTab === 'credit' && !isCommercial ? (
        <ul className="space-y-3">
          {result!.agencies.map((a) => {
            const settled = a.usedIrr <= 0;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-white p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-sm font-black text-accent">
                  {a.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">{a.fullName}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    مجوز <span className="ltr font-num">{a.licenseNo}</span> · {a.city}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-muted">بدهی جاری</div>
                  <div className={`font-num text-sm font-black ${settled ? 'text-[#059669]' : 'text-danger'}`}>
                    {faMoney(Math.max(a.usedIrr, 0))} تومان
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                    settled ? 'bg-[#10b98124] text-[#059669]' : 'bg-[#f59e0b24] text-[#b45309]'
                  }`}
                >
                  {settled ? 'تسویه شد' : 'در انتظار پرداخت'}
                </span>
                <button
                  disabled={settled || settlingId === a.id}
                  onClick={() => void onSettle(a)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    settled
                      ? 'cursor-default bg-surface text-muted'
                      : 'bg-[#059669] text-white hover:bg-[#047857]'
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
                  onClick={() => navigate(`/panel/agencies/${a.id}`)}
                  className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-border bg-white p-4 text-right transition hover:border-accent/40"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-base font-black text-accent">
                    {a.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">{a.fullName}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      مجوز <span className="ltr font-num">{a.licenseNo}</span> · {a.city} · سطح همکاری{' '}
                      <span className="font-bold text-[#b45309]">{TIER_LABELS[a.tier]}</span>
                    </div>
                  </div>
                  <div className="w-44">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                      <span>اعتبار (مانده / سقف)</span>
                      <span className="font-num">
                        {faMoney(Math.max(a.remainingIrr, 0))} / {faMoney(a.limitIrr)}
                      </span>
                    </div>
                    <CreditBar usedIrr={Math.max(a.usedIrr, 0)} limitIrr={a.limitIrr} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-muted">بدهی جاری</div>
                    <div className={`font-num text-sm font-black ${a.usedIrr > 0 ? 'text-danger' : 'text-[#059669]'}`}>
                      {faMoney(Math.max(a.usedIrr, 0))} تومان
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
