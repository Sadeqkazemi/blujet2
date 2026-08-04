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
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { TIER_LABELS, statusBadge } from './agency-labels';
import type { AgencyListResult, AgencyListRow, AgencyMembershipRequest } from '../../types/agencies';

type SubTab = 'list' | 'credit';

function KpiCard({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
      <div className="text-[11px] text-panel-muted">{label}</div>
      <div className={`font-num mt-1 text-lg font-black ${valueClass}`}>{value}</div>
    </div>
  );
}

function CreditBar({ usedIrr, limitIrr }: { usedIrr: number; limitIrr: number }) {
  const pct = limitIrr > 0 ? Math.min((usedIrr / limitIrr) * 100, 100) : usedIrr > 0 ? 100 : 0;
  const tone = pct >= 90 ? 'bg-danger' : pct >= 60 ? 'bg-[#f59e0b]' : 'bg-[#34d399]';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-panel-canvas">
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

  const pendingPager = usePagination(pendingRequests);
  const debtorsPager = usePagination(debtors);
  const agenciesPager = usePagination(result?.agencies ?? []);

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
        <h1 className="text-xl font-black text-panel-ink">آژانس‌ها</h1>
        <p className="mt-1 text-sm text-panel-muted">
          {isCommercial
            ? 'آژانس‌های همکار، درخواست‌ها و پروفایل هر آژانس'
            : 'مدیریت آژانس‌های همکار، اعتبار و تسویه'}
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#34d39915] p-3 text-sm text-[#34d399]">{notice}</p>}

      <section
        className={`mb-6 overflow-hidden rounded-[14px] border ${
          isCommercial ? 'border-[#2a3550] bg-[#141d2e]' : 'border-panel-border bg-panel-surface'
        } ${isCommercial ? '' : 'p-5'}`}
      >
        <div
          className={
            isCommercial
              ? 'flex flex-wrap items-center gap-[9px] border-b border-[#1f2a3d] px-[15px] py-3'
              : 'mb-3 flex items-center justify-between'
          }
        >
          {isCommercial && (
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[rgba(245,158,11,.16)] text-[#f59e0b]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                <path d="M9 13h6M9 17h4" />
              </svg>
            </span>
          )}
          <h2 className={`text-sm font-bold ${isCommercial ? 'font-extrabold text-white' : 'text-panel-ink'}`}>
            {isCommercial ? 'درخواست‌های همکاری آژانس‌ها' : 'درخواست‌های جدید عضویت'}
          </h2>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${
              isCommercial ? 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' : 'bg-[#f59e0b1f] text-[#b45309]'
            }`}
          >
            {faDigits(pendingRequests.length)} {isCommercial ? 'درخواست' : 'در انتظار'}
          </span>
          {isCommercial && (
            <span className="mr-auto text-[10.5px] text-[#6b7b94]">ارسال‌شده از سوی ادمین سایت</span>
          )}
        </div>
        <div className={isCommercial ? 'px-2 py-1.5' : undefined}>
        {pendingRequests.length === 0 ? (
          <p className={`py-3 text-center text-xs text-panel-muted ${isCommercial ? 'py-[18px]' : ''}`}>
            {isCommercial ? 'درخواست همکاری جدیدی وجود ندارد.' : 'درخواست جدیدی در انتظار تأیید نیست.'}
          </p>
        ) : (
          <ul className={isCommercial ? '' : 'divide-y divide-panel-border'}>
            {pendingPager.pageItems.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-3 ${
                  isCommercial
                    ? 'justify-between border-b border-[#1a2436] px-2.5 py-[11px] last:border-b-0'
                    : 'py-3'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-[10px] text-sm font-black ${
                      isCommercial ? 'bg-[#241d12] text-[#f59e0b]' : 'bg-panel-surface-2 text-accent'
                    }`}
                  >
                    {r.applicantName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-bold ${isCommercial ? 'text-[12.5px] font-extrabold text-[#e7ecf3]' : 'text-panel-ink'}`}>
                      {r.applicantName}
                    </div>
                    <div className="mt-0.5 text-[11px] text-panel-muted">
                      مدیر: {r.managerName} · مجوز <span className="ltr font-num">{r.licenseNo}</span> · {r.city}
                    </div>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-[9px]">
                  {r.status === 'REFERRED' && (
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent">ارجاع‌شده</span>
                  )}
                  <Link
                    to={`/panel/agencies/requests/${r.id}`}
                    className="rounded-[9px] bg-accent px-[13px] py-2 text-[11.5px] font-bold text-white transition hover:bg-accent/90"
                  >
                    {isCommercial ? 'بررسی و اقدام' : 'بررسی درخواست'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          page={pendingPager.page}
          totalPages={pendingPager.totalPages}
          onChange={pendingPager.setPage}
          variant="dark"
        />
        </div>
      </section>

      {!isCommercial && kpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="آژانس‌های فعال" value={faDigits(kpis.activeCount)} valueClass="text-panel-ink" />
          <KpiCard label="مجموع اعتبار اعطاشده" value={`${faMoney(kpis.totalCreditGrantedIrr)} تومان`} valueClass="text-accent" />
          <KpiCard label="اعتبار مصرف‌شده (بدهی)" value={`${faMoney(kpis.totalUsedIrr)} تومان`} valueClass="text-danger" />
          <KpiCard label="در انتظار تسویه" value={faDigits(kpis.pendingSettlementCount)} valueClass="text-[#b45309]" />
        </div>
      )}

      {isCommercial && debtors.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-[14px] border border-[rgba(248,113,113,.35)] bg-[#141d2e]">
          <div className="flex flex-wrap items-center gap-[9px] border-b border-[#1f2a3d] px-3.5 py-[11px]">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[rgba(248,113,113,.16)] text-[#f87171]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </span>
            <h2 className="m-0 text-sm font-extrabold text-white">آژانس‌های دارای بدهی یا فاکتور پرداخت‌نشده</h2>
            <span className="rounded-[18px] bg-[rgba(248,113,113,.14)] px-[9px] py-0.5 text-[11px] font-bold text-[#f87171]">
              {faDigits(debtors.length)} آژانس
            </span>
            <button
              onClick={() => void onNotifyAll()}
              className="mr-auto flex items-center gap-1.5 rounded-[9px] bg-[#3b82f6] px-[11px] py-[7px] text-[11.5px] font-bold text-white transition hover:brightness-110"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              ارسال اعلان به همه
            </button>
          </div>
          <ul className="px-2 py-1.5">
            {debtorsPager.pageItems.map((d) => {
              const unpaid = d.pendingInvoiceCount > 0;
              const label = unpaid ? 'فاکتور پرداخت‌نشده' : 'بدهی جاری';
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2.5 border-b border-[#1a2436] px-2.5 py-[11px] last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-[9px]">
                    <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[#1d2a40] text-[11.5px] font-extrabold text-[#9fb0c7]">
                      {d.fullName.slice(0, 1)}
                    </span>
                    <div className="min-w-0 leading-[1.6]">
                      <div className="text-[12.5px] font-bold text-[#e7ecf3]">{d.fullName}</div>
                      <span
                        className={`rounded-xl px-[7px] py-0.5 text-[10px] font-bold ${
                          unpaid
                            ? 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]'
                            : 'bg-[rgba(248,113,113,.14)] text-[#f87171]'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  </div>
                  <div className="flex-none text-left">
                    <div className="text-[9.5px] text-[#6b7b94]">مبلغ</div>
                    <div className="font-num text-[12.5px] font-extrabold text-[#f87171]">
                      {faMoney(d.usedIrr)} تومان
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={debtorsPager.page}
            totalPages={debtorsPager.totalPages}
            onChange={debtorsPager.setPage}
            variant="dark"
          />
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
                subTab === t.key ? 'bg-accent text-white' : 'bg-panel-canvas text-panel-muted hover:bg-panel-surface-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isCommercial && <h2 className="mb-3 text-sm font-bold text-panel-ink">آژانس‌های همکار</h2>}

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی آژانس بر اساس نام، مجوز، مدیر یا شهر…"
          className="h-[46px] w-full rounded-xl border border-panel-border-2 bg-panel-canvas px-4 text-xs text-panel-ink outline-none transition focus:border-accent"
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-panel-muted">در حال بارگذاری…</p>
      ) : (result?.agencies.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-panel-muted">آژانسی با این عبارت یافت نشد.</p>
      ) : subTab === 'credit' && !isCommercial ? (
        <ul className="space-y-3">
          {agenciesPager.pageItems.map((a) => {
            const settled = Number(a.usedIrr) <= 0;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-panel-border bg-panel-surface p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-surface-2 text-sm font-black text-accent">
                  {a.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-panel-ink">{a.fullName}</div>
                  <div className="mt-0.5 text-[11px] text-panel-muted">
                    مجوز <span className="ltr font-num">{a.licenseNo}</span> · {a.city}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-panel-muted">بدهی جاری</div>
                  <div className={`font-num text-sm font-black ${settled ? 'text-[#34d399]' : 'text-danger'}`}>
                    {faMoney(Math.max(Number(a.usedIrr), 0))} تومان
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                    settled ? 'bg-[#34d39924] text-[#34d399]' : 'bg-[#f59e0b24] text-[#b45309]'
                  }`}
                >
                  {settled ? 'تسویه شد' : 'در انتظار پرداخت'}
                </span>
                <button
                  disabled={settled || settlingId === a.id}
                  onClick={() => void onSettle(a)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    settled
                      ? 'cursor-default bg-panel-canvas text-panel-muted'
                      : 'bg-[#34d399] text-white hover:bg-[#2bb583]'
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
          {agenciesPager.pageItems.map((a) => {
            const badge = statusBadge(a.isActive);
            return (
              <li key={a.id}>
                <button
                  onClick={() => navigate(`/panel/agencies/${a.id}`)}
                  className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-panel-border bg-panel-surface p-4 text-right transition hover:border-accent/40"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel-surface-2 text-base font-black text-accent">
                    {a.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-panel-ink">{a.fullName}</div>
                    <div className="mt-0.5 text-[11px] text-panel-muted">
                      مجوز <span className="ltr font-num">{a.licenseNo}</span> · {a.city} · سطح همکاری{' '}
                      <span className="font-bold text-[#b45309]">{TIER_LABELS[a.tier]}</span>
                    </div>
                  </div>
                  <div className="w-44">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-panel-muted">
                      <span>اعتبار (مانده / سقف)</span>
                      <span className="font-num">
                        {faMoney(Math.max(Number(a.remainingIrr), 0))} / {faMoney(a.limitIrr)}
                      </span>
                    </div>
                    <CreditBar usedIrr={Math.max(Number(a.usedIrr), 0)} limitIrr={Number(a.limitIrr)} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-panel-muted">بدهی جاری</div>
                    <div className={`font-num text-sm font-black ${Number(a.usedIrr) > 0 ? 'text-danger' : 'text-[#34d399]'}`}>
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
      {!loading && (result?.agencies.length ?? 0) > 0 && (
        <Pagination
          page={agenciesPager.page}
          totalPages={agenciesPager.totalPages}
          onChange={agenciesPager.setPage}
          variant="dark"
        />
      )}
    </div>
  );
}
