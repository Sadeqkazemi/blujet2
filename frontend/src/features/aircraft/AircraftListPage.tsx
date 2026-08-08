import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAircraftDefinitions } from '../../api/aircraft';
import { faDigits } from '../../lib/fa-format';
import type { AircraftDefinitionListItem, AircraftStatus } from '../../types/aircraft';

const cardClass = 'overflow-hidden rounded-[14px] border border-[#1f2a3d] bg-[#141d2e]';

function statusBadge(status: AircraftStatus): { label: string; className: string } {
  if (status === 'ACTIVE') {
    return {
      label: 'فعال',
      className: 'bg-[rgba(52,211,153,.12)] text-[#34d399]',
    };
  }
  return {
    label: 'غیرفعال',
    className: 'bg-[rgba(248,113,113,.12)] text-[#f87171]',
  };
}

export default function AircraftListPage() {
  const [items, setItems] = useState<AircraftDefinitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAircraftDefinitions();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت فهرست هواپیماها.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-[15px] px-[21px] pb-[34px] pt-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-[20.5px] font-black text-white">تعریف هواپیما</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">
            مدیریت انواع هواپیما، ظرفیت کابین‌ها و نقشه صندلی برای پروازها
          </p>
        </div>
        <Link
          to="/panel/aircraft/new"
          className="inline-flex h-11 items-center rounded-[10px] bg-[#1668c4] px-5 text-[13px] font-bold text-white hover:bg-[#1a75d8]"
        >
          + تعریف هواپیمای جدید
        </Link>
      </div>

      {loading && (
        <p className="py-8 text-center text-sm text-[#6b7b94]" data-testid="aircraft-list-loading">
          در حال بارگذاری…
        </p>
      )}

      {!loading && error && (
        <div className="rounded-[12px] bg-[rgba(248,113,113,.12)] p-4 text-sm text-[#f87171]" data-testid="aircraft-list-error">
          <p className="m-0">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-[#28344c] px-3 py-1.5 text-[11px] font-bold text-[#9fb0c7]"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div
          className={`${cardClass} px-6 py-12 text-center`}
          data-testid="aircraft-list-empty"
        >
          <p className="m-0 text-sm text-[#6b7b94]">اطلاعاتی یافت نشد.</p>
          <Link
            to="/panel/aircraft/new"
            className="mt-4 inline-flex text-[13px] font-bold text-[#60a5fa] hover:underline"
          >
            اولین هواپیما را تعریف کنید
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className={cardClass} data-testid="aircraft-list-table">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#1f2a3d] text-[11px] text-[#6b7b94]">
                <th className="px-4 py-3 text-start font-bold">نام / کد</th>
                <th className="px-4 py-3 text-start font-bold">وضعیت</th>
                <th className="px-4 py-3 text-start font-bold">ظرفیت</th>
                <th className="px-4 py-3 text-start font-bold">خلاصه کابین</th>
                <th className="px-4 py-3 text-start font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const badge = statusBadge(item.status);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#1f2a3d] last:border-b-0 hover:bg-[#0f1726]/50"
                    data-testid={`aircraft-row-${item.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="font-num mt-0.5 text-[11px] text-[#6b7b94]" dir="ltr">
                        {item.code}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="font-num px-4 py-3 text-[#e7ecf3]">{faDigits(item.totalSeats)}</td>
                    <td className="px-4 py-3 text-[#9fb0c7]">{item.cabinSummary || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/panel/aircraft/${item.id}`}
                          className="rounded-lg border border-[#28344c] px-3 py-1.5 text-[11px] font-bold text-[#9fb0c7] hover:border-[#3b82f6] hover:text-white"
                        >
                          مشاهده
                        </Link>
                        <Link
                          to={`/panel/aircraft/${item.id}/edit`}
                          className="rounded-lg border border-[#28344c] px-3 py-1.5 text-[11px] font-bold text-[#60a5fa] hover:border-[#3b82f6]"
                        >
                          ویرایش
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
