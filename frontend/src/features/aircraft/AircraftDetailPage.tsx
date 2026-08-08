import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchAircraftDefinition } from '../../api/aircraft';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { isMd80Aircraft } from '../public-site/checkout/md80-seat-layout';
import {
  AIRCRAFT_CABIN_OPTIONS,
  type AircraftDefinition,
  type AircraftStatus,
} from '../../types/aircraft';
import SeatMapEditor, { sectionSeatCodes } from './SeatMapEditor';

const cardClass = 'rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] px-[19px] py-[18px]';

function statusLabel(status: AircraftStatus): string {
  return status === 'ACTIVE' ? 'فعال' : 'غیرفعال';
}

function statusClass(status: AircraftStatus): string {
  return status === 'ACTIVE'
    ? 'bg-[rgba(52,211,153,.12)] text-[#34d399]'
    : 'bg-[rgba(248,113,113,.12)] text-[#f87171]';
}

function cabinLabel(cabin: string): string {
  return AIRCRAFT_CABIN_OPTIONS.find((o) => o.value === cabin)?.label ?? cabin;
}

function isMd80Locked(def: AircraftDefinition): boolean {
  return Boolean(def.lockedSeatMap) || isMd80Aircraft(def.code) || isMd80Aircraft(def.name);
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-[#6b7b94]">{label}</div>
      <div className={`font-num text-[14px] font-bold text-white ${ltr ? '' : ''}`} dir={ltr ? 'ltr' : undefined}>
        {value}
      </div>
    </div>
  );
}

export default function AircraftDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<AircraftDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAircraftDefinition(id);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت اطلاعات هواپیما.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const seatMapSeatCount = useMemo(() => {
    if (!detail?.seatMap?.length) return 0;
    return detail.seatMap.reduce((sum, section) => {
      const active = sectionSeatCodes(section).filter(
        (code) => !section.disabledSeatCodes.includes(code),
      );
      return sum + active.length;
    }, 0);
  }, [detail]);

  if (loading) {
    return (
      <p className="px-[21px] py-8 text-sm text-[#6b7b94]" data-testid="aircraft-detail-loading">
        در حال بارگذاری…
      </p>
    );
  }

  if (error || !detail) {
    return (
      <div className="px-[21px] py-8">
        <p className="rounded-[12px] bg-[rgba(248,113,113,.12)] p-4 text-sm text-[#f87171]" data-testid="aircraft-detail-error">
          {error ?? 'اطلاعاتی یافت نشد.'}
        </p>
        <Link to="/panel/aircraft" className="mt-4 inline-block text-[13px] font-bold text-[#60a5fa]">
          بازگشت به فهرست
        </Link>
      </div>
    );
  }

  const md80Locked = isMd80Locked(detail);
  const enabledCabins = detail.cabins.filter((c) => c.enabled);

  return (
    <div className="flex flex-col gap-[15px] px-[21px] pb-[34px] pt-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-[20.5px] font-black text-white">{detail.name}</h1>
          <p className="font-num mt-1 text-[11.5px] text-[#6b7b94]" dir="ltr">
            {detail.code}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/panel/aircraft"
            className="inline-flex h-11 items-center rounded-[10px] border border-[#28344c] px-4 text-[13px] font-bold text-[#9fb0c7]"
          >
            فهرست
          </Link>
          <Link
            to={`/panel/aircraft/${detail.id}/edit`}
            className="inline-flex h-11 items-center rounded-[10px] bg-[#1668c4] px-5 text-[13px] font-bold text-white hover:bg-[#1a75d8]"
          >
            ویرایش
          </Link>
        </div>
      </div>

      <section className={cardClass}>
        <h2 className="mb-4 text-[14.5px] font-extrabold text-white">اطلاعات پایه</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="نام" value={detail.name} />
          <Field label="کد" value={detail.code} ltr />
          <div>
            <div className="mb-1 text-[11px] text-[#6b7b94]">وضعیت</div>
            <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${statusClass(detail.status)}`}>
              {statusLabel(detail.status)}
            </span>
          </div>
          <Field label="ظرفیت کل" value={faDigits(detail.totalSeats)} />
        </div>
        {(detail.createdAt || detail.updatedAt) && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#1f2a3d] pt-4 md:grid-cols-2">
            {detail.createdAt && (
              <Field label="تاریخ ایجاد" value={formatJalaliDateTime(detail.createdAt)} />
            )}
            {detail.updatedAt && (
              <Field label="آخرین به‌روزرسانی" value={formatJalaliDateTime(detail.updatedAt)} />
            )}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-4 text-[14.5px] font-extrabold text-white">کابین‌ها</h2>
        {enabledCabins.length === 0 ? (
          <p className="text-sm text-[#6b7b94]">کابینی تعریف نشده است.</p>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-[#28344c]">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#28344c] bg-[#0f1726] text-[11px] text-[#6b7b94]">
                  <th className="px-4 py-2 text-start font-bold">نوع کابین</th>
                  <th className="px-4 py-2 text-start font-bold">تعداد صندلی</th>
                </tr>
              </thead>
              <tbody>
                {enabledCabins.map((c) => (
                  <tr key={c.cabin} className="border-b border-[#28344c] last:border-b-0">
                    <td className="px-4 py-2 text-[#e7ecf3]">{cabinLabel(c.cabin)}</td>
                    <td className="font-num px-4 py-2 text-[#e7ecf3]">{faDigits(c.seats)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[14.5px] font-extrabold text-white">نقشه صندلی</h2>
          {!md80Locked && detail.seatMap.length > 0 && (
            <span className="font-num text-[11px] text-[#6b7b94]">
              {faDigits(seatMapSeatCount)} صندلی فعال در نقشه
            </span>
          )}
        </div>
        {md80Locked ? (
          <div
            className="rounded-[10px] border border-[rgba(59,130,246,.25)] bg-[rgba(59,130,246,.08)] px-4 py-4 text-[12px] text-[#9fb0c7]"
            data-testid="md80-locked-message"
          >
            نقشه صندلی MD-80 در سیستم رزرو عمومی ثابت است و از پنل قابل مشاهده/ویرایش نیست.
          </div>
        ) : detail.seatMap.length === 0 ? (
          <p className="text-sm text-[#6b7b94]">نقشه صندلی تعریف نشده است.</p>
        ) : (
          <SeatMapEditor
            value={detail.seatMap}
            onChange={() => {}}
            enabledCabins={enabledCabins.map((c) => c.cabin)}
            disabled
          />
        )}
      </section>
    </div>
  );
}
