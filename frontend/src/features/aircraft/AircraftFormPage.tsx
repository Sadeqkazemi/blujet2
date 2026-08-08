import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  createAircraftDefinition,
  fetchAircraftDefinition,
  updateAircraftDefinition,
} from '../../api/aircraft';
import { ApiRequestError } from '../../api/envelope';
import { faDigits } from '../../lib/fa-format';
import { isMd80Aircraft } from '../public-site/checkout/md80-seat-layout';
import {
  AIRCRAFT_CABIN_OPTIONS,
  type AircraftCabinCapacity,
  type AircraftCabinKind,
  type AircraftSeatMapDraft,
  type AircraftStatus,
  type UpsertAircraftDefinitionPayload,
} from '../../types/aircraft';
import SeatMapEditor from './SeatMapEditor';

const inputClass =
  'font-num h-11 w-full rounded-[10px] border border-[#28344c] bg-[#0f1726] px-3 text-[13px] text-[#e7ecf3] outline-none';
const selectClass = inputClass;
const cardClass = 'rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] px-[19px] py-[18px]';

function defaultCabins(): AircraftCabinCapacity[] {
  return AIRCRAFT_CABIN_OPTIONS.map((o) => ({
    cabin: o.value,
    enabled: o.value === 'ECONOMY' || o.value === 'BUSINESS',
    seats: 0,
  }));
}

function isMd80Locked(code: string, name: string): boolean {
  return isMd80Aircraft(code) || isMd80Aircraft(name);
}

function enabledCabinKinds(cabins: AircraftCabinCapacity[]): AircraftCabinKind[] {
  return cabins.filter((c) => c.enabled).map((c) => c.cabin);
}

function cabinSeatsSum(cabins: AircraftCabinCapacity[]): number {
  return cabins.filter((c) => c.enabled).reduce((sum, c) => sum + c.seats, 0);
}

export default function AircraftFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isCreate = !id || id === 'new';
  const isEdit = location.pathname.endsWith('/edit');

  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<AircraftStatus>('ACTIVE');
  const [totalSeats, setTotalSeats] = useState(0);
  const [cabins, setCabins] = useState<AircraftCabinCapacity[]>(defaultCabins);
  const [seatMap, setSeatMap] = useState<AircraftSeatMapDraft[]>([]);

  const md80Locked = useMemo(() => isMd80Locked(code, name), [code, name]);
  const cabinSum = useMemo(() => cabinSeatsSum(cabins), [cabins]);
  const enabledCabins = useMemo(() => enabledCabinKinds(cabins), [cabins]);
  const seatsMismatch = totalSeats > 0 && cabinSum !== totalSeats;

  const load = useCallback(async () => {
    if (isCreate || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAircraftDefinition(id);
      setName(data.name);
      setCode(data.code);
      setStatus(data.status);
      setTotalSeats(data.totalSeats);
      setCabins(data.cabins.length > 0 ? data.cabins : defaultCabins());
      setSeatMap(data.seatMap ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'خطا در دریافت اطلاعات هواپیما.');
    } finally {
      setLoading(false);
    }
  }, [id, isCreate]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateCabin(cabin: AircraftCabinKind, patch: Partial<AircraftCabinCapacity>) {
    setCabins((prev) =>
      prev.map((c) => (c.cabin === cabin ? { ...c, ...patch } : c)),
    );
  }

  function validate(): string | null {
    if (!name.trim()) return 'نام هواپیما را وارد کنید.';
    if (!code.trim()) return 'کد هواپیما را وارد کنید.';
    if (!Number.isInteger(totalSeats) || totalSeats <= 0) {
      return 'ظرفیت کل باید عدد صحیح بزرگ‌تر از صفر باشد.';
    }
    const enabled = cabins.filter((c) => c.enabled);
    if (enabled.length === 0) return 'حداقل یک نوع کابین باید فعال باشد.';
    for (const c of enabled) {
      if (!Number.isInteger(c.seats) || c.seats < 0) {
        return 'تعداد صندلی هر کابین باید عدد صحیح غیرمنفی باشد.';
      }
    }
    if (cabinSeatsSum(cabins) !== totalSeats) {
      return `مجموع صندلی کابین‌ها (${faDigits(cabinSeatsSum(cabins))}) باید برابر ظرفیت کل (${faDigits(totalSeats)}) باشد.`;
    }
    return null;
  }

  function buildPayload(): UpsertAircraftDefinitionPayload {
    return {
      name: name.trim(),
      code: code.trim(),
      status,
      totalSeats,
      cabins: cabins.filter((c) => c.enabled || c.seats > 0).map((c) => ({ ...c })),
      seatMap: md80Locked ? [] : seatMap,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isCreate) {
        const created = await createAircraftDefinition(payload);
        navigate(`/panel/aircraft/${created.id}`);
      } else if (id) {
        await updateAircraftDefinition(id, payload);
        navigate(`/panel/aircraft/${id}`);
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ذخیره تعریف هواپیما.');
    } finally {
      setSaving(false);
    }
  }

  if (!isCreate && !isEdit) {
    return (
      <p className="px-[21px] py-8 text-sm text-[#f87171]">
        مسیر نامعتبر — از صفحه جزئیات برای ویرایش استفاده کنید.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="px-[21px] py-8 text-sm text-[#6b7b94]" data-testid="aircraft-form-loading">
        در حال بارگذاری…
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="px-[21px] py-8">
        <p className="rounded-[12px] bg-[rgba(248,113,113,.12)] p-4 text-sm text-[#f87171]" data-testid="aircraft-form-load-error">
          {loadError}
        </p>
        <Link to="/panel/aircraft" className="mt-4 inline-block text-[13px] font-bold text-[#60a5fa]">
          بازگشت به فهرست
        </Link>
      </div>
    );
  }

  const pageTitle = isCreate ? 'تعریف هواپیمای جدید' : `ویرایش ${name || 'هواپیما'}`;

  return (
    <div className="flex flex-col gap-[15px] px-[21px] pb-[34px] pt-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-[20.5px] font-black text-white">{pageTitle}</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">
            {isCreate
              ? 'نوع هواپیما، ظرفیت کابین‌ها و نقشه صندلی را تعریف کنید'
              : 'ویرایش مشخصات و نقشه صندلی'}
          </p>
        </div>
        <Link
          to={isCreate ? '/panel/aircraft' : `/panel/aircraft/${id}`}
          className="inline-flex h-11 items-center rounded-[10px] border border-[#28344c] px-4 text-[13px] font-bold text-[#9fb0c7]"
        >
          انصراف
        </Link>
      </div>

      {error && (
        <p className="rounded-[12px] bg-[rgba(248,113,113,.12)] p-3 text-sm text-[#f87171]" data-testid="aircraft-form-error">
          {error}
        </p>
      )}

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-[15px]" data-testid="aircraft-form">
        <section className={cardClass}>
          <h2 className="mb-4 text-[14.5px] font-extrabold text-white">اطلاعات پایه</h2>
          <div className="grid grid-cols-1 gap-[13px] md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="aircraft-name" className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                نام هواپیما
              </label>
              <input
                id="aircraft-name"
                data-testid="aircraft-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="مثلاً مک‌دانل داگلاس MD-80"
              />
            </div>
            <div>
              <label htmlFor="aircraft-code" className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                کد نوع
              </label>
              <input
                id="aircraft-code"
                data-testid="aircraft-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={inputClass}
                dir="ltr"
                placeholder="MD-80"
              />
            </div>
            <div>
              <label htmlFor="aircraft-status" className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                وضعیت
              </label>
              <select
                id="aircraft-status"
                data-testid="aircraft-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AircraftStatus)}
                className={selectClass}
              >
                <option value="ACTIVE">فعال</option>
                <option value="INACTIVE">غیرفعال</option>
              </select>
            </div>
            <div>
              <label htmlFor="aircraft-total-seats" className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                ظرفیت کل (صندلی)
              </label>
              <input
                id="aircraft-total-seats"
                data-testid="aircraft-total-seats"
                type="number"
                min={1}
                value={totalSeats || ''}
                onChange={(e) => setTotalSeats(Math.max(0, Number(e.target.value) || 0))}
                className={inputClass}
                dir="ltr"
              />
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[14.5px] font-extrabold text-white">ظرفیت کابین‌ها</h2>
            <span
              className={`font-num text-[11.5px] ${seatsMismatch ? 'text-[#f87171]' : 'text-[#34d399]'}`}
              data-testid="cabin-seats-sum"
            >
              مجموع: {faDigits(cabinSum)} / {faDigits(totalSeats)}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {cabins.map((c) => {
              const opt = AIRCRAFT_CABIN_OPTIONS.find((o) => o.value === c.cabin);
              return (
                <div
                  key={c.cabin}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#28344c] bg-[#0f1726] px-3 py-3"
                  data-testid={`cabin-row-${c.cabin}`}
                >
                  <label className="flex min-w-[140px] cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) => updateCabin(c.cabin, { enabled: e.target.checked, seats: e.target.checked ? c.seats : 0 })}
                      className="h-4 w-4 accent-[#1668c4]"
                    />
                    <span className="text-[13px] font-bold text-[#e7ecf3]">{opt?.label ?? c.cabin}</span>
                  </label>
                  <div className="flex flex-1 items-center gap-2">
                    <label htmlFor={`cabin-seats-${c.cabin}`} className="text-[11px] text-[#6b7b94]">
                      تعداد صندلی
                    </label>
                    <input
                      id={`cabin-seats-${c.cabin}`}
                      type="number"
                      min={0}
                      disabled={!c.enabled}
                      value={c.enabled ? c.seats : ''}
                      onChange={(e) => updateCabin(c.cabin, { seats: Math.max(0, Number(e.target.value) || 0) })}
                      className={`${inputClass} max-w-[120px]`}
                      dir="ltr"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="mb-4 text-[14.5px] font-extrabold text-white">نقشه صندلی</h2>
          {md80Locked ? (
            <div
              className="rounded-[10px] border border-[rgba(59,130,246,.25)] bg-[rgba(59,130,246,.08)] px-4 py-4 text-[12px] text-[#9fb0c7]"
              data-testid="md80-locked-message"
            >
              نقشه صندلی MD-80 در سیستم رزرو عمومی ثابت است و از اینجا قابل ویرایش نیست. فقط ظرفیت
              کابین‌ها و وضعیت نوع هواپیما قابل تغییر است.
            </div>
          ) : (
            <SeatMapEditor
              value={seatMap}
              onChange={setSeatMap}
              enabledCabins={enabledCabins.length > 0 ? enabledCabins : ['ECONOMY']}
            />
          )}
        </section>

        <div className="flex justify-end gap-3">
          <Link
            to={isCreate ? '/panel/aircraft' : `/panel/aircraft/${id}`}
            className="inline-flex h-11 items-center rounded-[10px] border border-[#28344c] px-5 text-[13px] font-bold text-[#9fb0c7]"
          >
            انصراف
          </Link>
          <button
            type="submit"
            disabled={saving}
            data-testid="aircraft-form-submit"
            className="inline-flex h-11 items-center rounded-[10px] bg-[#1668c4] px-6 text-[13px] font-bold text-white hover:bg-[#1a75d8] disabled:opacity-60"
          >
            {saving ? 'در حال ذخیره…' : isCreate ? 'ثبت هواپیما' : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>
    </div>
  );
}
