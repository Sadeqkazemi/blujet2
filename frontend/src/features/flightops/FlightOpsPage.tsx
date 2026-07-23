import { useEffect, useState } from 'react';
import { fetchFlightops, fetchFlightopsDetail } from '../../api/flightops';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { FlightopsDetail, FlightopsList } from '../../types/flightops';

const STATUS_STYLE = {
  open: { label: 'باز', className: 'bg-[#10b98124] text-[#059669]' },
  closed: { label: 'بسته‌شده', className: 'bg-[#8b97a824] text-[#5a6678]' },
};

const NIRA_STYLE = {
  done: { label: 'بارگذاری در نیرا ✓', className: 'bg-[#10b98118] text-[#059669]' },
  pending: { label: 'در انتظار بسته‌شدن', className: 'bg-[#f59e0b1f] text-[#b45309]' },
};

export default function FlightOpsPage() {
  const [list, setList] = useState<FlightopsList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FlightopsDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    fetchFlightops()
      .then(setList)
      .catch(() => setError('خطا در دریافت لیست پروازها.'));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setDetailError(null);
    fetchFlightopsDetail(selectedId)
      .then(setDetail)
      .catch(() => setDetailError('خطا در دریافت جزئیات پرواز.'));
  }, [selectedId]);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!list) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  if (selectedId) {
    return (
      <div className="p-8">
        <span
          data-testid="fo-back"
          onClick={() => setSelectedId(null)}
          className="mb-4 inline-flex cursor-pointer items-center gap-1 text-xs text-muted"
        >
          ← بازگشت به لیست پروازها
        </span>

        {detailError && <p className="text-sm text-danger">{detailError}</p>}
        {!detail && !detailError && <p className="text-sm text-muted">در حال بارگذاری…</p>}

        {detail && (
          <div data-testid="fo-detail" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
              <div>
                <div className="text-base font-black text-ink">
                  {detail.originCode} → {detail.destCode}
                </div>
                <div className="text-xs text-muted">
                  شماره پرواز <span className="font-num ltr">{detail.flightNo}</span> ·{' '}
                  {formatJalaliDateTime(detail.departureAt)}
                </div>
              </div>
              <span
                data-testid="fo-status-pill"
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLE[detail.closed ? 'closed' : 'open'].className}`}
              >
                {STATUS_STYLE[detail.closed ? 'closed' : 'open'].label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] text-muted">صندلی فروخته‌شده</div>
                <div className="font-num mt-1 text-lg font-black text-ink">{faDigits(detail.sold)}</div>
              </div>
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] text-muted">صندلی خالی</div>
                <div className="font-num mt-1 text-lg font-black text-[#b45309]">{faDigits(detail.free)}</div>
              </div>
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] text-muted">ظرفیت کل</div>
                <div className="font-num mt-1 text-lg font-black text-ink">{faDigits(detail.capacity)}</div>
              </div>
              <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] text-muted">ضریب اشغال</div>
                <div className="font-num mt-1 text-lg font-black text-[#059669]">{faDigits(detail.occupancyPct)}٪</div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-5">
              <div className="mb-3 text-sm font-bold text-ink">سامانه نیرا — بارگذاری لیست مسافران</div>
              {detail.niraSubmittedAt ? (
                <div data-testid="fo-nira-done" className="flex items-center justify-between rounded-lg bg-[#10b98110] p-3 text-xs">
                  <span className="font-bold text-[#059669]">لیست مسافران در سامانه نیرا ثبت شد</span>
                  <span className="font-num text-[#5a6678]">{formatJalaliDateTime(detail.niraSubmittedAt)}</span>
                </div>
              ) : (
                <div data-testid="fo-nira-pending" className="rounded-lg bg-[#f59e0b10] p-3 text-xs font-bold text-[#b45309]">
                  در انتظار بسته‌شدن فروش
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-white p-5">
              <div className="mb-3 text-sm font-bold text-ink">لیست مسافران ({faDigits(detail.manifest.length)} نفر)</div>
              {detail.manifest.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">مسافری برای این پرواز ثبت نشده است.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-border text-[10px] text-muted">
                        <th className="py-2 font-bold">#</th>
                        <th className="py-2 font-bold">نام</th>
                        <th className="py-2 font-bold">کد ملی</th>
                        <th className="py-2 font-bold">صندلی</th>
                        <th className="py-2 font-bold">شماره بلیط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.manifest.map((p, i) => (
                        <tr key={`${p.pnr}-${i}`} className="border-b border-border/60">
                          <td className="font-num py-2">{faDigits(i + 1)}</td>
                          <td className="py-2 font-bold">{p.fullName}</td>
                          <td className="font-num ltr py-2">{p.nationalId ? faDigits(p.nationalId) : '—'}</td>
                          <td className="font-num ltr py-2">{p.seatCode ?? '—'}</td>
                          <td className="font-num ltr py-2">{p.pnr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="mb-1 text-xl font-black text-ink">پروازها</h1>
        <p className="text-sm text-muted">
          فروش هر پرواز ۵ ساعت مانده به زمان پرواز به‌صورت خودکار بسته می‌شود و لیست کامل مسافران به‌صورت اتومات در
          سامانه نیرا بارگذاری می‌گردد.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">کل پروازها</div>
          <div className="font-num mt-1 text-lg font-black text-ink">{faDigits(list.kpis.total)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">باز (در حال فروش)</div>
          <div className="font-num mt-1 text-lg font-black text-[#059669]">{faDigits(list.kpis.open)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">بسته‌شده / در نیرا</div>
          <div className="font-num mt-1 text-lg font-black text-[#5a6678]">{faDigits(list.kpis.closed)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">مجموع مسافران</div>
          <div className="font-num mt-1 text-lg font-black text-accent">{faDigits(list.kpis.soldTotal)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border p-4 text-sm font-bold text-ink">لیست پروازها</div>
        {list.rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">پروازی برای نمایش وجود ندارد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted">
                  <th className="px-4 py-2 font-bold">مسیر</th>
                  <th className="px-4 py-2 font-bold">شماره پرواز</th>
                  <th className="px-4 py-2 font-bold">تاریخ و ساعت</th>
                  <th className="px-4 py-2 font-bold">فروش / ظرفیت</th>
                  <th className="px-4 py-2 font-bold">وضعیت فروش</th>
                  <th className="px-4 py-2 font-bold">سامانه نیرا</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  <tr
                    key={row.id}
                    data-testid={`fo-row-${row.id}`}
                    onClick={() => setSelectedId(row.id)}
                    className="cursor-pointer border-b border-border/60 hover:bg-body"
                  >
                    <td className="px-4 py-3 font-bold text-ink">
                      {row.originCode} → {row.destCode}
                    </td>
                    <td className="font-num ltr px-4 py-3 text-muted">{row.flightNo}</td>
                    <td className="font-num px-4 py-3 text-muted">{formatJalaliDateTime(row.departureAt)}</td>
                    <td className="font-num px-4 py-3 font-bold text-ink">
                      {faDigits(row.sold)} / {faDigits(row.capacity)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_STYLE[row.closed ? 'closed' : 'open'].className}`}
                      >
                        {STATUS_STYLE[row.closed ? 'closed' : 'open'].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${NIRA_STYLE[row.closed ? 'done' : 'pending'].className}`}
                      >
                        {NIRA_STYLE[row.closed ? 'done' : 'pending'].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
