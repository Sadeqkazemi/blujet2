import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ConfirmActionDialog from '../../components/ConfirmActionDialog';
import {
  createTravelCost,
  deleteTravelCost,
  fetchTravelCosts,
  updateTravelCost,
} from '../../api/travel-costs';
import { faMoney, latinDigits, parseTomanToRial } from '../../lib/fa-format';
import type {
  TravelCost,
  TravelCostPayload,
  TravelExtraBillingUnit,
  TravelExtraCode,
} from '../../types/travel-costs';

type ServiceMeta = {
  label: string;
  description: string;
  billingUnit: TravelExtraBillingUnit;
  icon: ReactNode;
};

const serviceMeta: Record<TravelExtraCode, ServiceMeta> = {
  EXTRA_BAGGAGE: {
    label: 'اضافه بار',
    description: 'خرید بار اضافه فراتر از سهمیه بلیت',
    billingUnit: 'PER_KG',
    icon: <path d="M6 8h12l2 12H4L6 8Zm3 0V6a3 3 0 0 1 6 0v2" />,
  },
  SPECIAL_MEAL: {
    label: 'غذای گرم داخل پرواز',
    description: 'منوی ایرانی و بین‌المللی',
    billingUnit: 'PER_PASSENGER',
    icon: <path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3m-3 8v10m8-18v18m0-18c3 2 4 6 0 9" />,
  },
  TRAVEL_INSURANCE: {
    label: 'بیمه مسافرتی',
    description: 'پوشش تأخیر، خسارت و خدمات سفر',
    billingUnit: 'PER_PASSENGER',
    icon: <path d="M12 3 5 6v5c0 4.8 2.9 8.2 7 10 4.1-1.8 7-5.2 7-10V6l-7-3Z" />,
  },
  CIP: {
    label: 'خدمات CIP فرودگاهی',
    description: 'پذیرش و تشریفات اختصاصی فرودگاه',
    billingUnit: 'PER_PASSENGER',
    icon: <path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 3Z" />,
  },
  REFUND_FEE: {
    label: 'استرداد بلیت',
    description: 'هزینه خدمات پردازش استرداد بلیت',
    billingUnit: 'PER_BOOKING',
    icon: <path d="M9 8H5V4M5 8a8 8 0 1 1-1 8" />,
  },
  SEAT_SELECTION: {
    label: 'انتخاب صندلی',
    description: 'هزینه انتخاب صندلی دلخواه هنگام خرید',
    billingUnit: 'PER_PASSENGER',
    icon: <path d="M8 4h8v8a4 4 0 0 1-4 4H8V4Zm0 12v4m8-8h3v8H5" />,
  },
  DATE_CHANGE: {
    label: 'تغییر تاریخ پرواز',
    description: 'هزینه خدمات تغییر تاریخ رزرو',
    billingUnit: 'PER_BOOKING',
    icon: <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm4 8h2v2H9v-2Z" />,
  },
};

const serviceOrder = Object.keys(serviceMeta) as TravelExtraCode[];

const unitLabels: Record<TravelExtraBillingUnit, string> = {
  PER_BOOKING: 'برای هر رزرو',
  PER_PASSENGER: 'برای هر مسافر',
  PER_KG: 'برای هر کیلوگرم',
};

function ServiceIcon({ code }: { code: TravelExtraCode }) {
  return (
    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-[#18223a] text-[#9fb0c7]">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {serviceMeta[code].icon}
      </svg>
    </span>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-[27px] w-[50px] rounded-full transition disabled:cursor-wait disabled:opacity-60 ${
        checked ? 'bg-[#16a34a]' : 'bg-[#344158]'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all ${
          checked ? 'right-[3px]' : 'right-[26px]'
        }`}
      />
    </button>
  );
}

export default function CommercialServicesPage() {
  const [rows, setRows] = useState<TravelCost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addCode, setAddCode] = useState<TravelExtraCode>('EXTRA_BAGGAGE');
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TravelCost | null>(null);

  useEffect(() => {
    fetchTravelCosts()
      .then((data) => {
        setRows(data);
        setDrafts(Object.fromEntries(data.map((row) => [row.id, String(Number(row.priceIrr) / 10)])));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'خطا در دریافت خدمات.'))
      .finally(() => setLoading(false));
  }, []);

  const availableCodes = useMemo(() => {
    const used = new Set(rows.map((row) => row.code));
    return serviceOrder.filter((code) => !used.has(code));
  }, [rows]);

  useEffect(() => {
    if (availableCodes.length > 0 && !availableCodes.includes(addCode)) {
      setAddCode(availableCodes[0]);
    }
  }, [addCode, availableCodes]);

  async function savePrice(row: TravelCost) {
    setError(null);
    setNotice(null);
    const priceIrr = parseTomanToRial(drafts[row.id] ?? '');
    if (priceIrr == null) {
      setError('مبلغ معتبر را به تومان وارد کنید.');
      return;
    }
    setBusyId(row.id);
    try {
      const updated = await updateTravelCost(row.id, { priceIrr: String(priceIrr) });
      setRows((current) => current.map((item) => (item.id === row.id ? updated : item)));
      setDrafts((current) => ({ ...current, [row.id]: String(Number(updated.priceIrr) / 10) }));
      setNotice(`قیمت «${row.titleFa}» ذخیره شد.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'خطا در ذخیره قیمت.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(row: TravelCost) {
    setError(null);
    setNotice(null);
    setBusyId(row.id);
    try {
      const updated = await updateTravelCost(row.id, {
        active: !row.active,
        purchaseEnabled: !row.active,
      });
      setRows((current) => current.map((item) => (item.id === row.id ? updated : item)));
      setNotice(`خدمت «${row.titleFa}» ${updated.active ? 'فعال' : 'غیرفعال'} شد.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'خطا در تغییر وضعیت خدمت.');
    } finally {
      setBusyId(null);
    }
  }

  function startAdd() {
    if (availableCodes.length === 0) {
      setError('همه انواع خدمت پشتیبانی‌شده قبلاً ثبت شده‌اند.');
      return;
    }
    const code = availableCodes[0];
    setAddCode(code);
    setAddTitle(serviceMeta[code].label);
    setAddDescription(serviceMeta[code].description);
    setAddPrice('');
    setAddOpen(true);
    setError(null);
  }

  async function addService() {
    const priceIrr = parseTomanToRial(addPrice);
    if (!addTitle.trim() || priceIrr == null) {
      setError('عنوان و مبلغ معتبر را وارد کنید.');
      return;
    }
    setBusyId('new');
    setError(null);
    const payload: TravelCostPayload = {
      code: addCode,
      titleFa: addTitle.trim(),
      descriptionFa: addDescription.trim() || serviceMeta[addCode].description,
      billingUnit: serviceMeta[addCode].billingUnit,
      priceIrr: String(priceIrr),
      active: true,
      purchaseEnabled: true,
      sortOrder: rows.length,
    };
    try {
      const created = await createTravelCost(payload);
      setRows((current) => [...current, created]);
      setDrafts((current) => ({ ...current, [created.id]: String(Number(created.priceIrr) / 10) }));
      setAddOpen(false);
      setNotice(`خدمت «${created.titleFa}» اضافه شد.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'خطا در افزودن خدمت.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeService() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError(null);
    try {
      await deleteTravelCost(deleteTarget.id);
      setRows((current) => current.filter((row) => row.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice('خدمت حذف شد.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'خطا در حذف خدمت.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[20.5px] font-black text-white">خدمات</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">قیمت‌گذاری و فعال‌سازی خدمات قابل خرید همراه بلیت</p>
        </div>
        <button
          type="button"
          onClick={startAdd}
          className="h-10 rounded-[10px] bg-[#3b82f6] px-4 text-xs font-extrabold text-white transition hover:bg-[#2563eb]"
        >
          افزودن خدمت جدید ＋
        </button>
      </div>

      <div className="mb-4 rounded-[12px] border border-[rgba(59,130,246,.28)] bg-[rgba(59,130,246,.08)] px-4 py-3 text-[11.5px] leading-6 text-[#9fb0c7]">
        قیمت و وضعیت هر خدمت مستقیماً روی گزینه‌های خرید مسافر اثر می‌گذارد. مبلغ‌ها به تومان نمایش داده می‌شوند و از API واقعی هزینه‌های سفر خوانده می‌شوند.
      </div>

      {error && <div role="alert" className="mb-4 rounded-[10px] border border-[rgba(248,113,113,.35)] bg-[rgba(248,113,113,.1)] px-4 py-3 text-xs text-[#f87171]">{error}</div>}
      {notice && <div className="mb-4 rounded-[10px] border border-[rgba(52,211,153,.3)] bg-[rgba(52,211,153,.1)] px-4 py-3 text-xs font-bold text-[#34d399]">{notice}</div>}

      {addOpen && (
        <section className="mb-4 rounded-[14px] border border-[#2a3550] bg-[#141d2e] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-extrabold text-white">افزودن خدمت</h2>
              <p className="mt-1 text-[10.5px] text-[#6b7b94]">نوع خدمت باید یکی از قراردادهای فعلی سامانه باشد.</p>
            </div>
            <button type="button" onClick={() => setAddOpen(false)} className="text-xs text-[#9fb0c7]">انصراف</button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-[11px] text-[#9fb0c7]">
              نوع خدمت
              <select
                aria-label="نوع خدمت"
                value={addCode}
                onChange={(event) => {
                  const code = event.target.value as TravelExtraCode;
                  setAddCode(code);
                  setAddTitle(serviceMeta[code].label);
                  setAddDescription(serviceMeta[code].description);
                }}
                className="mt-1.5 h-11 w-full rounded-[9px] border border-[#2a3550] bg-[#0f1726] px-3 text-xs text-white"
              >
                {availableCodes.map((code) => <option key={code} value={code}>{serviceMeta[code].label}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-[#9fb0c7]">
              عنوان
              <input aria-label="عنوان خدمت" value={addTitle} onChange={(event) => setAddTitle(event.target.value)} className="mt-1.5 h-11 w-full rounded-[9px] border border-[#2a3550] bg-[#0f1726] px-3 text-xs text-white" />
            </label>
            <label className="text-[11px] text-[#9fb0c7]">
              توضیح
              <input aria-label="توضیح خدمت" value={addDescription} onChange={(event) => setAddDescription(event.target.value)} className="mt-1.5 h-11 w-full rounded-[9px] border border-[#2a3550] bg-[#0f1726] px-3 text-xs text-white" />
            </label>
            <label className="text-[11px] text-[#9fb0c7]">
              قیمت (تومان)
              <input aria-label="قیمت خدمت جدید" inputMode="numeric" value={addPrice} onChange={(event) => setAddPrice(latinDigits(event.target.value).replace(/\D/g, ''))} className="font-num mt-1.5 h-11 w-full rounded-[9px] border border-[#2a3550] bg-[#0f1726] px-3 text-xs text-white" />
            </label>
          </div>
          <button type="button" disabled={busyId === 'new'} onClick={() => void addService()} className="mt-4 h-10 rounded-[9px] bg-[#3b82f6] px-5 text-xs font-extrabold text-white disabled:opacity-50">{busyId === 'new' ? 'در حال ثبت…' : 'ثبت خدمت'}</button>
        </section>
      )}

      <section className="overflow-hidden rounded-[14px] border border-[#1f2a3d] bg-[#141d2e]">
        {loading ? (
          <p className="p-10 text-center text-xs text-[#6b7b94]">در حال بارگذاری خدمات…</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-xs leading-6 text-[#6b7b94]">هنوز خدمتی ثبت نشده است. برای شروع «افزودن خدمت جدید» را انتخاب کنید.</p>
        ) : (
          rows.map((row) => {
            const meta = serviceMeta[row.code];
            const disabled = busyId === row.id;
            return (
              <article key={row.id} className="grid grid-cols-1 gap-4 border-b border-[#1f2a3d] px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(260px,1fr)_minmax(300px,420px)] lg:items-center">
                <div className="flex items-center gap-3">
                  <ServiceIcon code={row.code} />
                  <div>
                    <h2 className="m-0 text-[13px] font-extrabold text-white">{row.titleFa || meta.label}</h2>
                    <p className="mt-1 text-[10.5px] text-[#6b7b94]">{row.descriptionFa || meta.description}</p>
                    <p className="mt-1 text-[10px] text-[#8494ac]">{unitLabels[row.billingUnit]} · قیمت فعلی {faMoney(row.priceIrr)} تومان</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
                  <input
                    aria-label={`قیمت ${row.titleFa}`}
                    inputMode="numeric"
                    value={drafts[row.id] ?? ''}
                    onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: latinDigits(event.target.value).replace(/\D/g, '') }))}
                    placeholder="قیمت (تومان)"
                    className="font-num h-10 min-w-[150px] flex-1 rounded-[9px] border border-[#2a3550] bg-[#0f1726] px-3 text-xs text-white outline-none focus:border-[#3b82f6] lg:flex-none"
                  />
                  <button type="button" disabled={disabled} onClick={() => void savePrice(row)} className="h-10 rounded-[9px] bg-[linear-gradient(135deg,#7c3aed,#8b5cf6)] px-4 text-xs font-extrabold text-white disabled:opacity-50">ثبت قیمت</button>
                  <span className={`min-w-[48px] text-[11px] font-bold ${row.active ? 'text-[#34d399]' : 'text-[#6b7b94]'}`}>{row.active ? 'فعال' : 'غیرفعال'}</span>
                  <Toggle checked={row.active} disabled={disabled} onChange={() => void toggle(row)} />
                  <button type="button" disabled={disabled} onClick={() => setDeleteTarget(row)} aria-label={`حذف ${row.titleFa}`} className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[rgba(248,113,113,.1)] text-[#f87171] disabled:opacity-50">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6" /></svg>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <ConfirmActionDialog
        open={deleteTarget !== null}
        title="حذف خدمت"
        message={deleteTarget ? `خدمت «${deleteTarget.titleFa}» حذف شود؟` : ''}
        confirmLabel="حذف خدمت"
        cancelLabel="انصراف"
        busy={deleteTarget !== null && busyId === deleteTarget.id}
        busyLabel="در حال حذف…"
        variant="dark"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeService}
      />
    </div>
  );
}
