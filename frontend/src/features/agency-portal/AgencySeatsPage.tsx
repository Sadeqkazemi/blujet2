// صندلی‌های تخصیص‌یافته — mock-only tab matching the design's allocated-seats
// cards (پنل آژانس.dc.html). No staff-side allocation workflow exists yet, so
// the figures are the design's sample data.
import { faDigits } from '../../lib/fa-format';

const FLIGHTS = [
  { route: 'تهران ← مشهد', flightNo: 'BJ-102', date: '۲۵ تیر ۱۴۰۵', time: '۰۷:۳۰', demand: 40, alloc: 30, sold: 22, left: 8 },
  { route: 'تهران ← کیش', flightNo: 'BJ-210', date: '۲۶ تیر ۱۴۰۵', time: '۱۰:۱۵', demand: 25, alloc: 20, sold: 11, left: 9 },
  { route: 'مشهد ← تهران', flightNo: 'BJ-103', date: '۲۷ تیر ۱۴۰۵', time: '۱۸:۴۵', demand: 30, alloc: 24, sold: 24, left: 0 },
];

export default function AgencySeatsPage() {
  return (
    <div>
      <div className="mb-5 rounded-xl border border-[#d6e4f8] bg-[#f2f7fd] p-4 text-xs leading-6 text-[#3f546b]">
        صندلی‌های تخصیص‌یافته از سوی ایرلاین بر اساس میزان تقاضای آژانس شما، برای پروازهایی که مجوز پرواز آن‌ها صادر شده است. این ظرفیت برای فروش در اختیار شما قرار گرفته است.
      </div>

      <div className="flex flex-col gap-4">
        {FLIGHTS.map((f) => (
          <div key={f.flightNo + f.date} data-testid="alloc-card" className="rounded-2xl border border-[#e8eef6] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f7fd] text-base">✈</span>
                <div>
                  <div className="text-sm font-black text-[#0d2640]">{f.route}</div>
                  <div className="mt-0.5 text-[11px] text-[#8a96a6]">
                    <span dir="ltr">{f.flightNo}</span> · {f.date} · ساعت {f.time}
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-[#e8f5ee] px-3 py-1 text-[10.5px] font-extrabold text-[#1f8a5b]">مجوز پرواز صادر شده</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {(
                [
                  ['تقاضای شما', f.demand, '#5a6678'],
                  ['تخصیص‌یافته', f.alloc, '#1668c4'],
                  ['فروخته', f.sold, '#1f8a5b'],
                  ['باقی‌مانده', f.left, f.left === 0 ? '#d64545' : '#0d2640'],
                ] as const
              ).map(([label, val, color]) => (
                <div key={label} className="rounded-xl border border-[#eef1f5] bg-[#fafbfd] p-3 text-center">
                  <div className="mb-1 text-[10.5px] text-[#8a96a6]">{label}</div>
                  <div className="font-num text-lg font-black" style={{ color }}>
                    {faDigits(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
