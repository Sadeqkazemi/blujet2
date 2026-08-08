import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAircraftDefinitions } from '../../api/aircraft';
import { ApiRequestError } from '../../api/envelope';
import { faDigits } from '../../lib/fa-format';
import { AIRCRAFT_CABIN_OPTIONS, type AircraftDefinitionListItem } from '../../types/aircraft';

function cabinSummary(row: AircraftDefinitionListItem): string {
  if (!row.cabins?.length) return '—';
  return row.cabins
    .map((c) => {
      const label =
        AIRCRAFT_CABIN_OPTIONS.find((o) => o.value === c.cabinType)?.label ?? c.cabinType;
      return `${label}: ${faDigits(c.capacity)}`;
    })
    .join(' · ');
}

export default function AircraftListPage() {
  const [rows, setRows] = useState<AircraftDefinitionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAircraftDefinitions()
      .then(setRows)
      .catch((e) =>
        setError(
          e instanceof ApiRequestError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'خطا در دریافت فهرست هواپیماها.',
        ),
      );
  }, []);

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]" data-testid="aircraft-list-page">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20.5px] font-black text-white">تعریف هواپیما</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">
            مدل، ظرفیت کابین و نقشه صندلی — MD-80 قفل است
          </p>
        </div>
        <Link
          to="/panel/aircraft/new"
          className="rounded-[10px] bg-[#1668c4] px-3.5 py-2.5 text-[12px] font-extrabold text-white"
        >
          + تعریف هواپیمای جدید
        </Link>
      </div>

      {error ? (
        <p
          role="alert"
          data-testid="aircraft-list-error"
          className="rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-sm text-[#f87171]"
        >
          {error}
        </p>
      ) : null}

      <div
        data-testid="aircraft-list-table"
        className="overflow-hidden rounded-[14px] border border-[#1f2a3d] bg-[#141d2e]"
      >
        <div className="grid grid-cols-[1fr_1fr_0.7fr_0.7fr_1.4fr_auto] gap-2 bg-[#18223a] px-3 py-2.5 text-[10.5px] font-bold text-[#6b7b94]">
          <span>کد</span>
          <span>مدل / عنوان</span>
          <span>وضعیت</span>
          <span>ظرفیت</span>
          <span>کابین‌ها</span>
          <span />
        </div>
        {rows === null && !error ? (
          <p
            data-testid="aircraft-list-loading"
            className="border-t border-[#1f2a3d] py-8 text-center text-xs text-[#6b7b94]"
          >
            در حال بارگذاری…
          </p>
        ) : null}
        {rows && rows.length === 0 ? (
          <p
            data-testid="aircraft-list-empty"
            className="border-t border-[#1f2a3d] py-8 text-center text-xs text-[#6b7b94]"
          >
            اطلاعاتی یافت نشد
          </p>
        ) : null}
        {rows?.map((row) => (
          <div
            key={row.id}
            data-testid="aircraft-list-row"
            className="grid grid-cols-[1fr_1fr_0.7fr_0.7fr_1.4fr_auto] items-center gap-2 border-t border-[#1f2a3d] px-3 py-3 text-[12px]"
          >
            <span className="font-num font-bold text-white" dir="ltr">
              {row.code}
            </span>
            <span className="text-[#e7ecf3]">
              {row.title || row.model}
              <span className="mt-0.5 block text-[10.5px] text-[#6b7b94]">{row.model}</span>
            </span>
            <span
              className={
                row.status === 'ACTIVE'
                  ? 'text-[#34d399]'
                  : 'text-[#f87171]'
              }
            >
              {row.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}
            </span>
            <span className="font-num text-[#cdd6e3]">{faDigits(row.totalCapacity)}</span>
            <span className="text-[11px] text-[#9fb0c7]">{cabinSummary(row)}</span>
            <div className="flex gap-2">
              <Link
                to={`/panel/aircraft/${row.id}`}
                className="text-[11px] font-bold text-[#60a5fa]"
              >
                مشاهده
              </Link>
              <Link
                to={`/panel/aircraft/${row.id}/edit`}
                className="text-[11px] font-bold text-[#c7d2e3]"
              >
                ویرایش
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
