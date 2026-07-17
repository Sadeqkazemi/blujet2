import { useEffect, useState } from 'react';
import { fetchSales } from '../../api/agency-portal';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import type { AgencySalesReport } from '../../types/agency-portal';

const BOOKING_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  HELD: 'رزرو موقت',
  PAID: 'پرداخت‌شده',
  TICKETED: 'صادرشده',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
  REFUNDED: 'مستردشده',
};

export default function AgencySalesPage() {
  const [data, setData] = useState<AgencySalesReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSales()
      .then(setData)
      .catch(() => setError('خطا در دریافت گزارش فروش.'));
  }, []);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  const kpis = [
    { label: 'کل فروش (تومان)', value: faMoney(data.summary.totalSalesIrr) },
    { label: 'بلیط صادرشده', value: faDigits(data.summary.ticketsIssued) },
    { label: 'میانگین نرخ (تومان)', value: faMoney(data.summary.avgFareIrr) },
    { label: 'نرخ استرداد', value: faPercent(data.summary.refundRatePct) },
  ];

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">فروش و گزارش</h1>
      <p className="mb-6 text-sm text-muted">تفکیک فروش آژانس شما بر اساس پرواز و بلیط</p>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">{k.label}</div>
            <div className="font-num mt-1 text-lg font-black text-ink">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">فروش هر پرواز</div>
        {data.perFlight.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">فروشی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted">
                  <th className="py-2 font-bold">پرواز</th>
                  <th className="py-2 font-bold">مسیر</th>
                  <th className="py-2 font-bold">تعداد بلیط</th>
                  <th className="py-2 font-bold">جمع فروش</th>
                </tr>
              </thead>
              <tbody>
                {data.perFlight.map((f) => (
                  <tr key={f.flightNo} className="border-b border-border/60">
                    <td className="ltr font-num py-2.5">{f.flightNo}</td>
                    <td className="ltr font-num py-2.5">{f.route}</td>
                    <td className="font-num py-2.5">{faDigits(f.ticketsCount)}</td>
                    <td className="font-num py-2.5 font-bold">{faMoney(f.salesIrr)} تومان</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">بلیط‌های صادرشده</div>
        {data.tickets.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">بلیطی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted">
                  <th className="py-2 font-bold">PNR</th>
                  <th className="py-2 font-bold">پرواز</th>
                  <th className="py-2 font-bold">تاریخ پرواز</th>
                  <th className="py-2 font-bold">مبلغ</th>
                  <th className="py-2 font-bold">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.map((t) => (
                  <tr key={t.pnr} className="border-b border-border/60">
                    <td className="ltr font-num py-2.5">{t.pnr}</td>
                    <td className="ltr font-num py-2.5">
                      {t.flightNo} — {t.route}
                    </td>
                    <td className="font-num py-2.5">{formatJalaliDate(t.departureAt)}</td>
                    <td className="font-num py-2.5 font-bold">{faMoney(t.priceIrr)} تومان</td>
                    <td className="py-2.5">{BOOKING_STATUS_LABEL[t.status] ?? t.status}</td>
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
