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
    <div className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-4">
      <div className="text-[11px] text-[#6b7b94]">{label}</div>
      <div className={`font-num mt-1 text-lg font-black ${valueClass}`}>{value}</div>
    </div>
  );
}

function CreditBar({ usedIrr, limitIrr }: { usedIrr: number; limitIrr: number }) {
  const pct = limitIrr > 0 ? Math.min((usedIrr / limitIrr) * 100, 100) : usedIrr > 0 ? 100 : 0;
  const tone = pct >= 90 ? 'bg-[#f87171]' : pct >= 60 ? 'bg-[#f59e0b]' : 'bg-[#34d399]';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-[#18223a]">
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
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-6">
        <h1 className="text-[20.5px] font-black text-white">آژانس‌ها</h1>
        <p className="mt-1 text-sm text-[#6b7b94]">
          {isCommercial ? 'آژانس‌های همکار، فاکتورها و مکاتبه‌ها' : 'مدیریت آژانس‌های همکار، اعتبار و تسویه'}
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-[#f8717124] p-3 text-sm text-[#f87171]">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#34d39924] p-3 text-sm text-[#34d399]">{notice}</p>}

      <section className="mb-6 rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            {isCommercial ? 'درخواست‌های همکاری آژانس‌ها' : 'درخواست‌های جدید عضویت'}
          </h2>
          <span className="rounded-full bg-[#f59e0b24] px-3 py-1 text-[11px] font-bold text-[#fbbf24]">
            {faDigits(pendingRequests.length)} {isCommercial ? 'درخواست' : 'در انتظار'}
          </span>
        </div>
        {pendingRequests.length === 0 ? (
          <p className="py-3 text-center text-xs text-[#6b7b94]">
            {isCommercial ? 'درخواست همکاری جدیدی وجود ندارد.' : 'درخواست جدیدی در انتظار تأیید نیست.'}
          </p>
        ) : (
          <ul className="divide-y divide-[#22304a]">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1d2a40] text-sm font-black text-[#60a5fa]">
                  {r.applicantName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{r.applicantName}</div>
                  <div className="mt-0.5 text-[11px] text-[#6b7b94]">
                    مدیر: {r.managerName} · مجوز <span className="ltr font-num">{r.licenseNo}</span> · {r.city}
                  </div>
                </div>
                {r.status === 'REFERRED' && (
                  <span className="rounded-full bg-[#3b82f624] px-2.5 py-1 text-[10px] font-bold text-[#60a5fa]">ارجاع‌شده</span>
                )}
                <Link
                  to={`/panel/agencies/requests/${r.id}`}
                  className="rounded-lg bg-[#3b82f6] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#2563eb]"
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
          <KpiCard label="آژانس‌های فعال" value={faDigits(kpis.activeCount)} valueClass="text-white" />
          <KpiCard label="مجموع اعتبار اعطاشده" value={`${faMoney(kpis.totalCreditGrantedIrr)} تومان`} valueClass="text-[#60a5fa]" />
          <KpiCard label="اعتبار مصرف‌شده (بدهی)" value={`${faMoney(kpis.totalUsedIrr)} تومان`} valueClass="text-[#f87171]" />
          <KpiCard label="در انتظار تسویه" value={faDigits(kpis.pendingSettlementCount)} valueClass="text-[#fbbf24]" />
        </div>
      )}

      {isCommercial && debtors.length > 0 && (
        <section className="mb-6 rounded-xl border border-[#f59e0b59] bg-[#f59e0b14] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#fbbf24]">
              آژانس‌های دارای بدهی یا فاکتور پرداخت‌نشده
              <span className="mr-2 rounded-full bg-[#f59e0b26] px-2.5 py-0.5 text-[11px] font-bold">
                {faDigits(debtors.length)} آژانس
              </span>
            </h2>
            <button
              onClick={() => void onNotifyAll()}
              className="rounded-lg bg-[#f59e0b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#d97706]"
            >
              ارسال اعلان به همه
            </button>
          </div>
          <ul className="divide-y divide-[#f59e0b33]">
            {debtors.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-bold text-white">{d.fullName}</span>
                <span className="font-num text-xs text-[#fbbf24]">مبلغ {faMoney(d.usedIrr)} تومان</span>
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
                subTab === t.key ? 'bg-[#3b82f6] text-white' : 'bg-[#18223a] text-[#6b7b94] hover:text-white'
              }`}
            >
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
          className="h-[46px] w-full rounded-xl border border-[#28344c] bg-[#18223a] px-4 text-xs text-[#e7ecf3] outline-none transition focus:border-[#3b82f6]"
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-[#6b7b94]">در حال بارگذاری…</p>
      ) : (result?.agencies.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-[#6b7b94]">آژانسی با این عبارت یافت نشد.</p>
      ) : subTab === 'credit' && !isCommercial ? (
        <ul className="space-y-3">
          {result!.agencies.map((a) => {
            const settled = Number(a.usedIrr) <= 0;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#22304a] bg-[#0f1726] p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1d2a40] text-sm font-black text-[#60a5fa]">
                  {a.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{a.fullName}</div>
                  <div className="mt-0.5 text-[11px] text-[#6b7b94]">
                    مجوز <span className="ltr font-num">{a.licenseNo}</span> · {a.city}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-[#6b7b94]">بدهی جاری</div>
                  <div className={`font-num text-sm font-black ${settled ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {faMoney(Math.max(Number(a.usedIrr), 0))} تومان
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                    settled ? 'bg-[#34d39924] text-[#34d399]' : 'bg-[#f59e0b24] text-[#fbbf24]'
                  }`}
                >
                  {settled ? 'تسویه شد' : 'در انتظار پرداخت'}
                </span>
                <button
                  disabled={settled || settlingId === a.id}
                  onClick={() => void onSettle(a)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    settled
                      ? 'cursor-default bg-[#18223a] text-[#6b7b94]'
                      : 'bg-[#16a34a] text-white hover:bg-[#15803d]'
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
                  className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-[#22304a] bg-[#0f1726] p-4 text-right transition hover:border-[#3b82f666]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1d2a40] text-base font-black text-[#60a5fa]">
                    {a.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">{a.fullName}</div>
                    <div className="mt-0.5 text-[11px] text-[#6b7b94]">
                      مجوز <span className="ltr font-num">{a.licenseNo}</span> · {a.city} · سطح همکاری{' '}
                      <span className="font-bold text-[#fbbf24]">{TIER_LABELS[a.tier]}</span>
                    </div>
                  </div>
                  <div className="w-44">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-[#6b7b94]">
                      <span>اعتبار (مانده / سقف)</span>
                      <span className="font-num">
                        {faMoney(Math.max(Number(a.remainingIrr), 0))} / {faMoney(a.limitIrr)}
                      </span>
                    </div>
                    <CreditBar usedIrr={Math.max(Number(a.usedIrr), 0)} limitIrr={Number(a.limitIrr)} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-[#6b7b94]">بدهی جاری</div>
                    <div className={`font-num text-sm font-black ${Number(a.usedIrr) > 0 ? 'text-[#f87171]' : 'text-[#34d399]'}`}>
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
