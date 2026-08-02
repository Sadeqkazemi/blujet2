import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  cancelBooking,
  changeSeat,
  fetchAgencyApiAccess,
  fetchPnrDetail,
  fetchPnrList,
  fetchReservationDashboardStats,
  fetchReservationFlights,
  markNoShow,
} from '../../api/reservation';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import { useAuth } from '../../hooks/useAuth';
import type {
  AgencyApiAccessRow,
  BookingStatus,
  PnrDetail,
  PnrGroup,
  ReservationDashboardStats,
  ReservationFlightRow,
} from '../../types/reservation';

type SubTab = 'dash' | 'pnr' | 'agency' | 'flights';

const STATUS_LABEL: Record<BookingStatus, { label: string; className: string }> = {
  TICKETED: { label: 'صادرشده', className: 'bg-[rgba(16,185,129,.14)] text-[#34d399]' },
  CANCELLED: { label: 'لغوشده', className: 'bg-[rgba(248,113,113,.14)] text-[#f87171]' },
  DRAFT: { label: 'پیش‌نویس', className: 'bg-[#18223a] text-[#9fb0c7]' },
  HELD: { label: 'در انتظار', className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' },
  PAID: { label: 'پرداخت‌شده', className: 'bg-[rgba(59,130,246,.14)] text-[#60a5fa]' },
  EXPIRED: { label: 'منقضی', className: 'bg-[#18223a] text-[#9fb0c7]' },
  REFUNDED: { label: 'مستردشده', className: 'bg-[#18223a] text-[#9fb0c7]' },
  FLOWN: { label: 'پرواز شده', className: 'bg-[rgba(59,130,246,.14)] text-[#60a5fa]' },
  NO_SHOW: { label: 'عدم حضور', className: 'bg-[rgba(248,113,113,.14)] text-[#f87171]' },
};

const FLIGHT_STATUS: Record<
  ReservationFlightRow['statusKey'],
  { label: string; className: string; bar: string }
> = {
  SELLING: {
    label: 'در حال فروش',
    className: 'bg-[rgba(59,130,246,.14)] text-[#60a5fa]',
    bar: '#34d399',
  },
  NEAR_FULL: {
    label: 'رو به تکمیل',
    className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]',
    bar: '#f59e0b',
  },
  FULL: {
    label: 'تکمیل‌شده',
    className: 'bg-[rgba(248,113,113,.14)] text-[#f87171]',
    bar: '#f87171',
  },
};

const TABS: { key: SubTab; label: string; icon: ReactNode }[] = [
  {
    key: 'dash',
    label: 'داشبورد',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    key: 'pnr',
    label: 'مدیریت رزروها',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 4v16" />
      </svg>
    ),
  },
  {
    key: 'agency',
    label: 'دسترسی آژانس‌ها',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
  {
    key: 'flights',
    label: 'پروازها',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
  },
];

function initialsOf(name: string) {
  const compact = name.replace(/\s+/g, '');
  return compact.slice(0, 2) || '؟';
}

export default function ReservationPage() {
  const { user } = useAuth();
  const canLock = user?.role === 'CEO' || user?.role === 'BOARD_CHAIR' || user?.role === 'IT_MANAGER';

  const [subTab, setSubTab] = useState<SubTab>('dash');
  const [stats, setStats] = useState<ReservationDashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [pnrGroups, setPnrGroups] = useState<PnrGroup[]>([]);
  const [pnrQ, setPnrQ] = useState('');
  const [lnameQ, setLnameQ] = useState('');
  const [searchHit, setSearchHit] = useState<PnrDetail | null>(null);
  const [searchMiss, setSearchMiss] = useState(false);
  const [detailPnr, setDetailPnr] = useState<string | null>(null);
  const [detail, setDetail] = useState<PnrDetail | null>(null);
  const [changeSeatInput, setChangeSeatInput] = useState('');

  const [agencies, setAgencies] = useState<AgencyApiAccessRow[] | null>(null);
  const [flights, setFlights] = useState<ReservationFlightRow[] | null>(null);
  const [flightQ, setFlightQ] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchReservationDashboardStats());
    } catch {
      setError('خطا در دریافت آمار داشبورد.');
    }
  }, []);

  const loadPnrList = useCallback(async () => {
    try {
      setPnrGroups(await fetchPnrList());
    } catch {
      setError('خطا در دریافت فهرست رزروها.');
    }
  }, []);

  const loadAgencies = useCallback(async () => {
    try {
      setAgencies(await fetchAgencyApiAccess());
    } catch {
      setError('خطا در دریافت دسترسی آژانس‌ها.');
      setAgencies([]);
    }
  }, []);

  const loadFlights = useCallback(async (q?: string) => {
    try {
      setFlights(await fetchReservationFlights(q));
    } catch {
      setError('خطا در دریافت فهرست پروازها.');
      setFlights([]);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (subTab === 'pnr') void loadPnrList();
    if (subTab === 'agency') void loadAgencies();
    if (subTab === 'flights') void loadFlights();
  }, [subTab, loadPnrList, loadAgencies, loadFlights]);

  useEffect(() => {
    if (subTab !== 'flights') return;
    const t = window.setTimeout(() => void loadFlights(flightQ.trim() || undefined), 280);
    return () => window.clearTimeout(t);
  }, [flightQ, subTab, loadFlights]);

  useEffect(() => {
    if (!detailPnr) {
      setDetail(null);
      return;
    }
    void fetchPnrDetail(detailPnr)
      .then(setDetail)
      .catch(() => setError('خطا در دریافت جزئیات رزرو.'));
  }, [detailPnr]);

  const recentRows = useMemo(
    () =>
      pnrGroups.flatMap((g) =>
        g.rows.map((r) => ({
          pnr: r.pnr,
          route: g.route,
          passenger: r.passenger,
          status: r.status,
        })),
      ),
    [pnrGroups],
  );

  async function onPnrSearch() {
    setError(null);
    setSearchHit(null);
    setSearchMiss(false);
    const pnr = pnrQ.trim();
    const lname = lnameQ.trim();
    if (!pnr && !lname) {
      setError('کد رزرو یا نام خانوادگی را وارد کنید.');
      return;
    }
    try {
      if (pnr) {
        try {
          const d = await fetchPnrDetail(pnr);
          if (lname && !(d.passenger?.fullName ?? '').includes(lname)) {
            setSearchMiss(true);
            return;
          }
          setSearchHit(d);
          return;
        } catch {
          setSearchMiss(true);
          return;
        }
      }
      const groups = await fetchPnrList(lname);
      const flat = groups.flatMap((g) => g.rows.map((r) => ({ ...r, route: g.route, departureAt: g.departureAt })));
      const first = flat[0];
      if (!first) {
        setSearchMiss(true);
        return;
      }
      setSearchHit(await fetchPnrDetail(first.pnr));
    } catch {
      setError('خطا در جستجوی رزرو.');
    }
  }

  async function onChangeSeat() {
    if (!detailPnr || !changeSeatInput.trim()) return;
    try {
      setDetail(await changeSeat(detailPnr, changeSeatInput.trim()));
      setNotice('صندلی با موفقیت تغییر کرد.');
      setChangeSeatInput('');
      await loadPnrList();
    } catch {
      setError('تغییر صندلی ممکن نشد.');
    }
  }

  async function onCancel() {
    if (!detailPnr) return;
    try {
      setDetail(await cancelBooking(detailPnr));
      setNotice('رزرو لغو شد.');
      await loadPnrList();
    } catch {
      setError('لغو رزرو ممکن نشد.');
    }
  }

  async function onMarkNoShow() {
    if (!detailPnr) return;
    try {
      setDetail(await markNoShow(detailPnr));
      setNotice('عدم حضور مسافر ثبت شد.');
      await loadPnrList();
    } catch {
      setError('ثبت عدم حضور ممکن نشد.');
    }
  }

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-5">
        <h1 className="text-[20.5px] font-black text-white">سامانه رزرواسیون پرواز</h1>
        <p className="mt-1 text-[11.5px] text-[#6b7b94]">
          جستجو و رزرو، مدیریت PNRها، صدور بلیط و دسترسی API آژانس‌ها
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-sm text-[#f87171]" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-lg bg-[rgba(16,185,129,.12)] p-3 text-sm text-[#34d399]">{notice}</p>
      )}

      <div className="mb-[18px] flex w-max max-w-full flex-wrap gap-[5px] rounded-[13px] border border-[#28344c] bg-[#18223a] p-1">
        {TABS.map((t) => {
          const active = subTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setError(null);
                setNotice(null);
                setSubTab(t.key);
              }}
              className={`flex items-center gap-1.5 rounded-[9px] px-[13px] py-[7px] text-[11.5px] transition ${
                active ? 'bg-[#3b82f6] font-extrabold text-white' : 'font-semibold text-[#9fb0c7]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {subTab === 'dash' && (
        <div className="flex flex-col gap-[13px]">
          <div className="grid grid-cols-2 gap-[11px] lg:grid-cols-4">
            <KpiCard label="رزروهای امروز" value={faDigits(stats?.todayBookings ?? 0)} />
            <KpiCard
              label="PNRهای فعال"
              value={faDigits(stats?.activePnrs ?? 0)}
              valueClass="text-[#60a5fa]"
            />
            <KpiCard
              label="صندلی فروخته‌شده"
              value={faDigits(stats?.seatsSold ?? 0)}
              valueClass="text-[#34d399]"
            />
            <KpiCard
              label="درآمد رزروها"
              value={stats ? `${faMoney(stats.revenueIrr)} تومان` : '۰ تومان'}
              valueClass="text-[16px] text-[#fcd34d]"
            />
          </div>

          <div className="grid grid-cols-1 gap-[13px] lg:grid-cols-[1.3fr_1fr]">
            <section className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="m-0 text-[13.5px] font-extrabold text-white">وضعیت سرویس‌های سامانه</h2>
                <span
                  className={`rounded-[14px] px-2.5 py-1 text-[10px] font-bold ${
                    stats?.servicesStable !== false
                      ? 'bg-[rgba(16,185,129,.14)] text-[#34d399]'
                      : 'bg-[rgba(248,113,113,.14)] text-[#f87171]'
                  }`}
                >
                  {stats?.servicesStable !== false ? 'پایدار' : 'ناپایدار'}
                </span>
              </div>
              <p className="mb-4 text-[11px] text-[#6b7b94]">
                معماری میکروسرویس رزرواسیون — از API Gateway تا پلتفرم API شرکا
              </p>
              <div className="flex flex-col gap-[7px]">
                {(stats?.services ?? []).map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-2.5 rounded-[11px] border border-[#22304a] bg-[#0f1623] px-[11px] py-[9px]"
                  >
                    <span
                      className={`h-[9px] w-[9px] flex-none rounded-full ${
                        s.ok ? 'bg-[#34d399] shadow-[0_0_0_3px_rgba(16,185,129,.18)]' : 'bg-[#f87171]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="ltr text-xs font-bold text-[#e7ecf3]">{s.name}</div>
                      <div className="text-[10px] text-[#6b7b94]">{s.fa}</div>
                    </div>
                    <span className="font-num ltr text-[10px] text-[#7d8aa0]">
                      {s.latencyMs != null ? `${faDigits(s.latencyMs)}ms` : '—'}
                    </span>
                    <span
                      className={`w-16 flex-none text-left text-[10px] font-bold ${
                        s.ok ? 'text-[#34d399]' : 'text-[#f87171]'
                      }`}
                    >
                      {s.statusLabel}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
              <h2 className="mb-4 text-[13.5px] font-extrabold text-white">تفکیک کانال رزرو</h2>
              {(stats?.channels.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-xs text-[#6b7b94]">کانال رزروی ثبت نشده است.</p>
              ) : (
                <div className="flex flex-col gap-[11px]">
                  {stats!.channels.map((c) => (
                    <div key={c.key}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[11.5px] text-[#9fb0c7]">
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                          {c.label}
                        </span>
                        <span className="font-num text-[11.5px] font-extrabold text-[#e7ecf3]">
                          {faDigits(c.pct)}٪
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-[#0f1623]">
                        <div className="h-full" style={{ width: `${c.pct}%`, background: c.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {subTab === 'pnr' && (
        <div className="flex flex-col gap-[13px]">
          <section className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
            <h2 className="mb-4 text-[13.5px] font-extrabold text-white">جستجوی رزرو</h2>
            <div className="grid grid-cols-1 items-end gap-[9px] md:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-[10.5px] text-[#6b7b94]">کد رزرو (PNR)</span>
                <input
                  value={pnrQ}
                  onChange={(e) => {
                    setPnrQ(e.target.value);
                    setSearchHit(null);
                    setSearchMiss(false);
                  }}
                  placeholder="مثلاً AS-88421"
                  dir="ltr"
                  className="font-num h-11 w-full rounded-[10px] border border-[#28344c] bg-[#0f1623] px-[11px] text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10.5px] text-[#6b7b94]">نام خانوادگی مسافر</span>
                <input
                  value={lnameQ}
                  onChange={(e) => {
                    setLnameQ(e.target.value);
                    setSearchHit(null);
                    setSearchMiss(false);
                  }}
                  placeholder="نام خانوادگی"
                  className="h-11 w-full rounded-[10px] border border-[#28344c] bg-[#0f1623] px-[11px] text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
                />
              </label>
              <button
                type="button"
                onClick={() => void onPnrSearch()}
                className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[#3b82f6] px-5 text-[12.5px] font-extrabold text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4" />
                </svg>
                جستجو
              </button>
            </div>
          </section>

          {searchHit && (
            <section className="overflow-hidden rounded-[14px] border border-[#1f2a3d] bg-[#141d2e]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2a3d] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDetailPnr(searchHit.pnr)}
                    className="font-num ltr text-sm font-extrabold text-white underline decoration-dashed underline-offset-4"
                  >
                    {searchHit.pnr}
                  </button>
                  <span
                    className={`rounded-[14px] px-2.5 py-0.5 text-[10px] font-bold ${
                      STATUS_LABEL[searchHit.status]?.className ?? ''
                    }`}
                  >
                    {STATUS_LABEL[searchHit.status]?.label ?? searchHit.status}
                  </span>
                </div>
                <div className="text-[11.5px] text-[#9fb0c7]">
                  {searchHit.originCode} → {searchHit.destCode} · {formatJalaliDate(searchHit.departureAt)}
                </div>
              </div>
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between rounded-[11px] border border-[#22304a] bg-[#0f1623] px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[rgba(59,130,246,.16)] text-[11px] font-extrabold text-[#60a5fa]">
                      {initialsOf(searchHit.passenger?.fullName ?? '؟')}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-[#e7ecf3]">
                        {searchHit.passenger?.fullName ?? '—'}
                      </div>
                      <div className="text-[10px] text-[#6b7b94]">
                        صندلی {searchHit.passenger?.seatCode ?? '—'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10.5px] font-bold text-[#34d399]">
                    {STATUS_LABEL[searchHit.status]?.label ?? searchHit.status}
                  </span>
                </div>
              </div>
            </section>
          )}

          {searchMiss && (
            <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] px-4 py-[34px] text-center text-xs text-[#6b7b94]">
              رزروی با این مشخصات یافت نشد.
            </div>
          )}

          <section className="overflow-hidden rounded-[14px] border border-[#1f2a3d] bg-[#141d2e]">
            <div className="border-b border-[#1f2a3d] px-[15px] py-3 text-[13px] font-extrabold text-white">
              آخرین رزروهای ثبت‌شده
            </div>
            <div className="grid grid-cols-[1fr_1.4fr_1fr_0.9fr] border-b border-[#1f2a3d] px-[15px] py-[11px] text-[10.5px] font-bold text-[#6b7b94]">
              <span>PNR</span>
              <span>مسیر</span>
              <span>مسافر</span>
              <span>وضعیت</span>
            </div>
            {recentRows.length === 0 ? (
              <div className="px-[15px] py-[26px] text-center text-xs text-[#6b7b94]">رزروی ثبت نشده است.</div>
            ) : (
              recentRows.slice(0, 20).map((r) => {
                const st = STATUS_LABEL[r.status] ?? {
                  label: r.status,
                  className: 'bg-[#18223a] text-[#9fb0c7]',
                };
                return (
                  <div
                    key={r.pnr}
                    className="grid grid-cols-[1fr_1.4fr_1fr_0.9fr] items-center border-b border-[#16202e] px-[15px] py-3 text-xs last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => setDetailPnr(r.pnr)}
                      className="font-num ltr text-right font-bold text-[#60a5fa] underline decoration-dashed underline-offset-4"
                    >
                      {r.pnr}
                    </button>
                    <span className="text-[#cdd6e3]">{r.route}</span>
                    <span className="text-[#9fb0c7]">{r.passenger}</span>
                    <span className={`w-max rounded-[14px] px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })
            )}
          </section>
        </div>
      )}

      {subTab === 'agency' && (
        <div className="flex flex-col gap-[11px]">
          {agencies === null ? (
            <p className="py-8 text-center text-xs text-[#6b7b94]">در حال بارگذاری…</p>
          ) : agencies.length === 0 ? (
            <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] px-4 py-[34px] text-center text-xs text-[#6b7b94]">
              آژانسی با دسترسی API ثبت نشده است.
            </div>
          ) : (
            agencies.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-3.5"
              >
                <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] bg-[rgba(147,51,234,.14)] text-xs font-extrabold text-[#a855f7]">
                  {a.initials}
                </span>
                <div className="min-w-[180px] flex-1">
                  <div className="text-[13px] font-extrabold text-white">{a.name}</div>
                  <div className="font-num ltr mt-1 text-[10.5px] text-[#6b7b94]">{a.keyHint}</div>
                </div>
                <div className="flex-none text-center">
                  <div className="text-[10px] text-[#6b7b94]">درخواست‌ها</div>
                  <div className="font-num mt-0.5 text-[13px] font-extrabold text-[#e7ecf3]">
                    {faDigits(a.callCount)}
                  </div>
                </div>
                <span
                  className={`flex-none rounded-[14px] px-[11px] py-1 text-[10.5px] font-bold ${
                    a.status === 'ACTIVE'
                      ? 'bg-[rgba(16,185,129,.14)] text-[#34d399]'
                      : 'bg-[rgba(248,113,113,.14)] text-[#f87171]'
                  }`}
                >
                  {a.status === 'ACTIVE' ? 'فعال' : 'معلق'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'flights' && (
        <section className="overflow-hidden rounded-[14px] border border-[#1f2a3d] bg-[#141d2e]">
          <div className="border-b border-[#1f2a3d] p-3">
            <input
              value={flightQ}
              onChange={(e) => setFlightQ(e.target.value)}
              placeholder="جستجوی پرواز - مسیر یا شماره پرواز"
              className="h-[42px] w-full rounded-[10px] border border-[#28344c] bg-[#0f1623] px-3 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]"
            />
          </div>
          <div className="grid grid-cols-[1.4fr_0.9fr_1.1fr_0.9fr_0.9fr_0.9fr] border-b border-[#1f2a3d] px-[15px] py-[11px] text-[10.5px] font-bold text-[#6b7b94]">
            <span>مسیر</span>
            <span>شماره پرواز</span>
            <span>تاریخ / ساعت</span>
            <span>نوع هواپیما</span>
            <span>ظرفیت</span>
            <span>وضعیت</span>
          </div>
          {flights === null ? (
            <div className="px-[15px] py-[34px] text-center text-xs text-[#6b7b94]">در حال بارگذاری…</div>
          ) : flights.length === 0 ? (
            <div className="px-[15px] py-[34px] text-center text-xs text-[#6b7b94]">پروازی ثبت نشده است.</div>
          ) : (
            flights.map((f) => {
              const st = FLIGHT_STATUS[f.statusKey];
              return (
                <div
                  key={f.flightInstanceId}
                  className="grid grid-cols-[1.4fr_0.9fr_1.1fr_0.9fr_0.9fr_0.9fr] items-center border-b border-[#16202e] px-[15px] py-3 text-xs last:border-0"
                >
                  <span className="font-bold text-[#e7ecf3]">{f.route}</span>
                  <span className="font-num ltr text-[#9fb0c7]">{f.flightNo}</span>
                  <span className="text-[#9fb0c7]">{formatJalaliDateTime(f.departureAt)}</span>
                  <span className="font-num ltr text-[#9fb0c7]">{f.aircraftType}</span>
                  <div className="flex flex-col gap-1">
                    <div className="font-num ltr text-[10.5px] text-[#9fb0c7]" dir="ltr">
                      {faDigits(f.sold)} / {faDigits(f.capacity)}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-[#0f1623]">
                      <div
                        className="h-full"
                        style={{ width: `${Math.min(f.occupancyPct, 100)}%`, background: st.bar }}
                      />
                    </div>
                  </div>
                  <span className={`w-max rounded-[14px] px-2.5 py-1 text-[10.5px] font-bold ${st.className}`}>
                    {st.label}
                  </span>
                </div>
              );
            })
          )}
        </section>
      )}

      {detailPnr && detail && (
        <Modal variant="dark" title={`رزرو ${detail.pnr}`} onClose={() => setDetailPnr(null)}>
          <div className="mb-4 rounded-xl border border-[#1f2a3d] bg-[#0f1726] p-4 text-white">
            <div className="mb-2 flex items-center justify-between">
              <span className="ltr font-num text-xs">PNR {detail.pnr}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  STATUS_LABEL[detail.status]?.className ?? ''
                }`}
              >
                {STATUS_LABEL[detail.status]?.label}
              </span>
            </div>
            <div className="flex items-center justify-between text-lg font-black">
              <span className="ltr">{detail.originCode}</span>
              <span>✈</span>
              <span className="ltr">{detail.destCode}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 border-t border-white/15 pt-3 text-[11px]">
              <div>
                <div className="text-white/50">مسافر</div>
                <div className="font-bold">{detail.passenger?.fullName ?? '—'}</div>
              </div>
              <div>
                <div className="text-white/50">صندلی</div>
                <div className="font-num font-bold text-[#fcd34d]">{detail.passenger?.seatCode ?? '—'}</div>
              </div>
              <div>
                <div className="text-white/50">تاریخ</div>
                <div className="font-bold">{formatJalaliDateTime(detail.departureAt)}</div>
              </div>
              <div>
                <div className="text-white/50">مبلغ</div>
                <div className="font-bold text-[#34d399]">{faMoney(detail.priceIrr)} تومان</div>
              </div>
            </div>
          </div>

          {canLock && detail.status !== 'CANCELLED' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={changeSeatInput}
                  onChange={(e) => setChangeSeatInput(e.target.value)}
                  placeholder="شماره صندلی جدید"
                  dir="ltr"
                  className="font-num flex-1 rounded-lg border border-[#1f2a3d] bg-[#0f1726] p-2.5 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]"
                />
                <button
                  type="button"
                  onClick={() => void onChangeSeat()}
                  className="rounded-lg bg-[#f59e0b] px-4 py-2 text-xs font-bold text-white"
                >
                  ثبت تغییر
                </button>
              </div>
              <button
                type="button"
                onClick={() => void onCancel()}
                className="rounded-lg bg-[rgba(248,113,113,.12)] px-4 py-2 text-xs font-bold text-[#f87171]"
              >
                لغو رزرو
              </button>
              {(detail.status === 'TICKETED' || detail.status === 'FLOWN') && (
                <button
                  type="button"
                  onClick={() => void onMarkNoShow()}
                  className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]"
                >
                  ثبت عدم حضور مسافر
                </button>
              )}
            </div>
          )}
          {detail.status === 'CANCELLED' && (
            <p className="rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-xs font-bold text-[#f87171]">
              این رزرو لغو شده است.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[13px]">
      <div className="mb-[7px] text-[11px] text-[#6b7b94]">{label}</div>
      <div className={`font-num text-[21.5px] font-black ${valueClass}`}>{value}</div>
    </div>
  );
}
