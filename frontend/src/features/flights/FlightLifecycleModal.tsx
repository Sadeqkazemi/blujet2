import { useEffect, useState } from 'react';
import { fetchFlightDetail, fetchFlightHistory } from '../../api/flights';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { CompletedFlightRow, FlightDetail, FlightRow, FlightWorkflowHistory } from '../../types/flights';

type Summary = FlightRow | CompletedFlightRow;

export default function FlightLifecycleModal({ flight, onClose }: { flight: Summary; onClose: () => void }) {
  const [detail, setDetail] = useState<FlightDetail | null>(null);
  const [history, setHistory] = useState<FlightWorkflowHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchFlightDetail(flight.id), fetchFlightHistory(flight.id)])
      .then(([nextDetail, nextHistory]) => { setDetail(nextDetail); setHistory(nextHistory); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'خطا در دریافت تاریخچه پرواز.'));
  }, [flight.id]);

  const completed = 'tickets' in flight ? flight : null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={`تاریخچه پرواز ${flight.flightNo}`}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#2a3953] bg-[#101a2b] p-5 text-[#e7ecf3] shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-black">جزئیات و تاریخچه پرواز <span className="ltr font-num">{flight.flightNo}</span></h2><p className="mt-1 text-xs text-[#8494ac]">{flight.originCode} ← {flight.destCode} · {formatJalaliDateTime(flight.departureAt)}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#33415c] px-3 py-1.5 text-xs">بستن</button>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-400/10 p-3 text-xs text-rose-300">{error}</p>}
        {!history && !error && <p className="py-10 text-center text-xs text-[#8494ac]">در حال دریافت همه اطلاعات پرواز…</p>}
        {history && detail && (
          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Info label="هواپیما" value={detail.aircraftType || '—'} />
              <Info label="ظرفیت / فروش" value={`${faDigits(detail.capacity)} / ${faDigits(detail.sold)}`} />
              <Info label="ضریب اشغال" value={`${faDigits(detail.occupancyPct)}٪`} />
              <Info label="قیمت پایه" value={detail.basePriceIrr ? `${faMoney(detail.basePriceIrr)} تومان` : '—'} />
              {completed && <><Info label="میانگین قیمت فروش" value={`${faMoney(completed.avgPriceIrr)} تومان`} /><Info label="کل فروش" value={`${faMoney(completed.revenueIrr)} تومان`} /><Info label="سود" value={`${faMoney(completed.profitIrr)} تومان`} /><Info label="زیان" value={`${faMoney(completed.lossIrr)} تومان`} /></>}
            </section>
            <section><h3 className="mb-2 text-sm font-extrabold">نظر مدیران</h3><div className="space-y-2">{history.reviews.length === 0 ? <Empty text="نظری برای این پرواز ثبت نشده است." /> : history.reviews.map((review) => <article key={review.id} className="rounded-xl border border-[#24304a] bg-[#0d1625] p-4"><div className="flex justify-between gap-2 text-[10px] text-[#8494ac]"><span>{review.stage === 'OPERATIONS' ? 'مدیر عملیات' : 'مدیر عامل'} · {review.decision === 'APPROVED' ? 'تأیید' : 'رد'}</span><span>{formatJalaliDateTime(review.reviewedAt)}</span></div><p className="mt-2 text-sm leading-7">{review.comment}</p></article>)}</div></section>
            <section><h3 className="mb-2 text-sm font-extrabold">تغییر قیمت و همه رویدادهای پرواز</h3><div className="space-y-2">{history.audit.length === 0 ? <Empty text="رویدادی ثبت نشده است." /> : history.audit.map((event) => <article key={event.id} className="rounded-xl border border-[#24304a] bg-[#0d1625] p-3"><div className="flex flex-wrap justify-between gap-2 text-xs font-bold"><span>{event.action}</span><span className="font-normal text-[#6b7b94]">{formatJalaliDateTime(event.createdAt)}</span></div>{event.detail && <p className="mt-1 text-xs leading-6 text-[#9fb0c7]">{event.detail}</p>}</article>)}</div></section>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#24304a] bg-[#0d1625] p-3"><div className="mb-1 text-[10px] text-[#6b7b94]">{label}</div><div className="font-num text-xs font-bold text-[#dbe6f7]">{value}</div></div>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-[#2d3a51] p-4 text-xs text-[#8494ac]">{text}</p>; }
