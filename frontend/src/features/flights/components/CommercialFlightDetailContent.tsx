import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCommercialFlightControl,
  updateFareClassSitePrice,
  updateFlightSalesVisibility,
  upsertAgencyFareRelease,
} from "../../../api/flights";
import {
  faDigits,
  faMoney,
  irrToTomanInput,
  latinDigits,
  parseTomanToRialString,
} from "../../../lib/fa-format";
import { formatJalaliDateTime } from "../../../lib/jalali";
import type {
  CommercialFareClassControl,
  CommercialFlightControl,
  FlightDetail,
} from "../../../types/flights";
import { cancelFlight } from "../../../api/flight-cancellations";

interface Props {
  detail: FlightDetail;
  canManage: boolean;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onChanged: () => void | Promise<void>;
  onConfirm: () => void;
}

const cabinLabel = {
  ECONOMY: "اکونومی",
  COMFORT: "کامفورت",
  PREMIUM_ECONOMY: "پرمیوم اکونومی",
  BUSINESS: "بیزینس",
  FIRST: "فرست کلاس",
} as const;

const channelMeta = {
  SYSTEM: { label: "فروش سیستمی", color: "bg-[#4f8cff]" },
  CHARTER: { label: "فروش چارتری", color: "bg-[#a855f7]" },
  AGENCY: { label: "فروش آژانس همکار", color: "bg-[#34d399]" },
} as const;

function classTitle(row: CommercialFareClassControl) {
  return row.classCode
    ? `${cabinLabel[row.cabin]} · ${row.classCode}`
    : cabinLabel[row.cabin];
}

export default function CommercialFlightDetailContent({
  detail,
  canManage,
  onNotice,
  onError,
  onChanged,
  onConfirm,
}: Props) {
  const [control, setControl] = useState<CommercialFlightControl | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openRelease, setOpenRelease] = useState<string | null>(null);
  const [openPrice, setOpenPrice] = useState<string | null>(null);
  const [releaseSeats, setReleaseSeats] = useState<Record<string, string>>({});
  const [releasePrices, setReleasePrices] = useState<Record<string, string>>({});
  const [specialOffers, setSpecialOffers] = useState<Record<string, boolean>>({});
  const [sitePrices, setSitePrices] = useState<Record<string, string>>({});
  const [priceReasons, setPriceReasons] = useState<Record<string, string>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchCommercialFlightControl(detail.id);
      setControl(next);
      setReleaseSeats(
        Object.fromEntries(
          next.fareClasses.map((row) => [row.ruleId, String(row.agencySeatsReleased)]),
        ),
      );
      setReleasePrices(
        Object.fromEntries(
          next.fareClasses.map((row) => [
            row.ruleId,
            irrToTomanInput(row.agencyReleasePriceIrr),
          ]),
        ),
      );
      setSpecialOffers(
        Object.fromEntries(
          next.fareClasses.map((row) => [row.ruleId, row.agencySpecialOffer]),
        ),
      );
      setSitePrices(
        Object.fromEntries(
          next.fareClasses.map((row) => [
            row.ruleId,
            irrToTomanInput(row.sitePriceIrr ?? row.basePriceIrr),
          ]),
        ),
      );
      setOpenRelease((current) => current ?? next.fareClasses[0]?.ruleId ?? null);
    } catch (error) {
      setControl(null);
      onError(error instanceof Error ? error.message : "دریافت کنترل فروش پرواز ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [detail.id, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const combinedHistory = useMemo(
    () =>
      (control?.fareClasses ?? [])
        .flatMap((row) =>
          row.priceHistory.map((entry) => ({
            ...entry,
            className: classTitle(row),
          })),
        )
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
    [control],
  );

  async function toggleVisibility() {
    if (!control || !canManage) return;
    const enabled = !control.publicSaleEnabled;
    setBusyKey("visibility");
    try {
      await updateFlightSalesVisibility(detail.id, enabled);
      await Promise.all([load(), Promise.resolve(onChanged())]);
      onNotice(enabled ? "فروش این پرواز در سایت فعال شد." : "فروش این پرواز در سایت متوقف شد.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "تغییر وضعیت فروش ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveRelease(row: CommercialFareClassControl) {
    const seats = Number(latinDigits(releaseSeats[row.ruleId] ?? ""));
    const priceIrr =
      seats === 0 ? "0" : parseTomanToRialString(releasePrices[row.ruleId] ?? "");
    if (!Number.isInteger(seats) || seats < 0 || seats > row.seatsAllocated) {
      onError(`تعداد صندلی باید بین صفر و ${faDigits(row.seatsAllocated)} باشد.`);
      return;
    }
    if (!priceIrr) {
      onError("قیمت فروش آژانسی را وارد کنید.");
      return;
    }
    setBusyKey(`release-${row.ruleId}`);
    try {
      await upsertAgencyFareRelease(detail.id, row.ruleId, {
        seats,
        priceIrr,
        specialOffer: specialOffers[row.ruleId] ?? false,
      });
      await Promise.all([load(), Promise.resolve(onChanged())]);
      onNotice(`ظرفیت آژانسی کلاس ${classTitle(row)} ثبت شد.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "ثبت ظرفیت آژانسی ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveSitePrice(row: CommercialFareClassControl) {
    const priceIrr = parseTomanToRialString(sitePrices[row.ruleId] ?? "");
    const reason = (priceReasons[row.ruleId] ?? "").trim();
    if (!priceIrr || reason.length < 2) {
      onError("قیمت معتبر و دلیل تغییر قیمت را وارد کنید.");
      return;
    }
    setBusyKey(`price-${row.ruleId}`);
    try {
      await updateFareClassSitePrice(detail.id, row.ruleId, { priceIrr, reason });
      setPriceReasons((current) => ({ ...current, [row.ruleId]: "" }));
      setOpenPrice(null);
      await Promise.all([load(), Promise.resolve(onChanged())]);
      onNotice(`قیمت فروش سایت کلاس ${classTitle(row)} اصلاح شد.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "اصلاح قیمت ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function submitCancellation() {
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      onError("علت کنسلی را کامل وارد کنید.");
      return;
    }
    setBusyKey("cancel");
    try {
      const result = await cancelFlight(detail.id, reason);
      onNotice(`پرواز کنسل شد و برای ${faDigits(result.affectedBookings)} رزرو پیامک کنسلی ثبت شد.`);
      await Promise.resolve(onChanged());
      onConfirm();
    } catch (error) {
      onError(error instanceof Error ? error.message : "کنسل کردن پرواز ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[#2a3550] bg-[#101a2c] p-8 text-center text-xs text-[#9fb0c7]">
        در حال دریافت جزئیات کنترل فروش…
      </div>
    );
  }

  if (!control) return null;

  return (
    <div className="-m-5 min-h-full space-y-2.5 bg-[#0d1729] p-3 text-[#e7ecf3] sm:p-4" data-testid="commercial-flight-detail" dir="rtl">
      <section
        className={`rounded-lg border p-2.5 ${
          control.publicSaleEnabled
            ? "border-[#20c99766] bg-[#0d332f66]"
            : "border-[#f59e0b55] bg-[#3b2c1566]"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className={`text-[11px] font-black ${control.publicSaleEnabled ? "text-[#34d399]" : "text-[#fbbf24]"}`}>
              {control.publicSaleEnabled
                ? "مجوز نمایش و فروش در سایت"
                : "نمایش و فروش در سایت غیرفعال است"}
            </h3>
            <p className="mt-0.5 text-[9px] leading-4 text-[#91a1b8]">
              {control.publicSaleEnabled
                ? "این پرواز هم‌اکنون در جست‌وجوی سایت قابل مشاهده و فروش است."
                : "تا زمان فعال‌سازی، این پرواز در نتایج عمومی نمایش داده نمی‌شود."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={control.publicSaleEnabled}
            aria-label="مجوز نمایش و فروش در سایت"
            disabled={!canManage || busyKey === "visibility"}
            onClick={() => void toggleVisibility()}
            className={`relative h-6 w-10 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
              control.publicSaleEnabled ? "bg-[#19b66b]" : "bg-[#465168]"
            }`}
          >
            <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                control.publicSaleEnabled ? "left-1" : "right-1"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-[#2a3550] bg-[#18243b] p-2.5">
          <div className="text-[10px] text-[#8c9bb2]">صندلی فروخته‌شده</div>
          <div className="mt-1 font-num text-sm font-black text-white">
            {faDigits(detail.sold)} / {faDigits(detail.capacity)}
          </div>
        </div>
        <div className="rounded-lg border border-[#2a3550] bg-[#18243b] p-2.5">
          <div className="text-[10px] text-[#8c9bb2]">ضریب اشغال</div>
          <div className="mt-1 font-num text-sm font-black text-[#34d399]">
            {faDigits(detail.occupancyPct)}٪
          </div>
        </div>
        <div className="rounded-lg border border-[#2a3550] bg-[#18243b] p-2.5">
          <div className="text-[10px] text-[#8c9bb2]">قیمت پایه</div>
          <div className="mt-1 font-num text-sm font-black text-[#6ea8ff]">
            {detail.basePriceIrr ? `${faMoney(detail.basePriceIrr)} تومان` : "—"}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#24324b] bg-[#101a2c] p-2.5">
        <h3 className="mb-2 text-[11px] font-black text-white">تفکیک کانال فروش صندلی</h3>
        <div className="space-y-2">
          {detail.channels.map((channel) => {
            const meta = channelMeta[channel.channel];
            const pct = detail.sold > 0 ? Math.round((channel.seats / detail.sold) * 100) : 0;
            return (
              <div key={channel.channel}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]">
                  <span className="flex items-center gap-2 text-[#9fb0c7]">
                    <span className={`h-2 w-2 rounded-sm ${meta.color}`} />
                    {meta.label}
                  </span>
                  <span className="font-num text-[9px] font-bold text-white">
                    {faDigits(channel.seats)} صندلی · {faMoney(channel.revenueIrr)} تومان
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[#0b1220]">
                  <div className={`h-full rounded-full ${meta.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex items-center justify-between rounded-lg border border-[#2a3550] bg-[#18243b] px-3 py-2">
        <span className="text-[10px] font-black text-white">درآمد پرواز <span className="font-normal text-[#71829d]">(با فروش هر صندلی افزایش می‌یابد)</span></span>
        <span className="font-num text-sm font-black text-[#6ea8ff]">
          {faMoney(detail.totalRevenueIrr)} تومان
        </span>
      </section>

      <section className="rounded-lg border border-[#2a3550] bg-[#121d31] p-2.5" data-commercial-section="agency-fare-release">
        <h3 className="text-[11px] font-black text-white">آزادسازی صندلی برای فروش آژانسی — به تفکیک کلاس پروازی</h3>
        <p className="mt-1 text-[9px] leading-4 text-[#78879d]">
          برای هر کلاس تعداد و قیمت صندلی را مشخص کنید؛ پیشنهاد ویژه پس از ثبت در پنل آژانس نمایش داده می‌شود.
        </p>
        <div className="mt-2 space-y-1.5">
          {control.fareClasses.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#34415a] p-5 text-center text-xs text-[#8c9bb2]">
              ابتدا کلاس‌های نرخی این پرواز را تعریف کنید.
            </div>
          )}
          {control.fareClasses.map((row) => {
            const expanded = openRelease === row.ruleId;
            return (
              <article key={row.ruleId} className="overflow-hidden rounded-lg border border-[#2b3852] bg-[#0f192a]">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenRelease(expanded ? null : row.ruleId)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right"
                >
                  <span className="text-[10px] font-bold text-white">{classTitle(row)}</span>
                  <span className="flex items-center gap-2 text-[9px] text-[#34d399]">
                    باقی‌مانده: {faDigits(row.remainingSeats)} صندلی
                    <span className={`text-[#9fb0c7] transition ${expanded ? "rotate-90" : ""}`}>‹</span>
                  </span>
                </button>
                {expanded && (
                  <div className="border-t border-[#27334a] bg-[#121d31] p-2.5">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-[9px] text-[#9fb0c7]">
                        تعداد صندلی برای فروش
                        <input
                          value={releaseSeats[row.ruleId] ?? "0"}
                          onChange={(event) =>
                            setReleaseSeats((current) => ({
                              ...current,
                              [row.ruleId]: latinDigits(event.target.value),
                            }))
                          }
                          disabled={!canManage}
                          inputMode="numeric"
                          className="mt-1 w-full rounded-md border border-[#34415a] bg-[#101827] px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-[#8b5cf6]"
                        />
                      </label>
                      <label className="text-[9px] text-[#9fb0c7]">
                        قیمت هر صندلی این کلاس (تومان)
                        <input
                          value={releasePrices[row.ruleId] ?? ""}
                          onChange={(event) =>
                            setReleasePrices((current) => ({
                              ...current,
                              [row.ruleId]: latinDigits(event.target.value),
                            }))
                          }
                          disabled={!canManage}
                          inputMode="numeric"
                          placeholder="مثلاً ۲٬۸۰۰٬۰۰۰"
                          className="mt-1 w-full rounded-md border border-[#34415a] bg-[#101827] px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-[#8b5cf6]"
                        />
                      </label>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-[9px] text-[#9fb0c7]">
                      <input
                        type="checkbox"
                        checked={specialOffers[row.ruleId] ?? false}
                        onChange={(event) =>
                          setSpecialOffers((current) => ({
                            ...current,
                            [row.ruleId]: event.target.checked,
                          }))
                        }
                        disabled={!canManage}
                        className="h-3.5 w-3.5 accent-[#8b5cf6]"
                      />
                      نمایش به آژانس‌ها به‌عنوان پیشنهاد فوق‌العاده
                    </label>
                    {canManage && (
                      <button
                        type="button"
                        disabled={busyKey === `release-${row.ruleId}`}
                        onClick={() => void saveRelease(row)}
                        className="mt-2 w-full rounded-md bg-[#8b5cf6] px-4 py-2 text-[10px] font-black text-white disabled:opacity-60"
                      >
                        {busyKey === `release-${row.ruleId}` ? "در حال ثبت…" : "ثبت"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-[#2a3550] bg-[#18243b] p-2.5" data-commercial-section="public-fare-classes">
        <h3 className="text-[11px] font-black text-[#80b7ff]">قیمت فروش در سایت به تفکیک کلاس پروازی</h3>
        <div className="mt-2 space-y-1.5">
          {control.fareClasses.map((row) => {
            const editing = openPrice === row.ruleId;
            return (
              <article key={`site-${row.ruleId}`} className="rounded-lg border border-[#2a3550] bg-[#0f192a] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black text-white">{classTitle(row)}</div>
                    <div className="mt-1 font-num text-sm font-black text-white">
                      {faMoney(row.sitePriceIrr ?? row.basePriceIrr)} تومان
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-[9px] text-[#78879d]">{faDigits(row.remainingSeats)} صندلی باقی‌مانده</div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setOpenPrice(editing ? null : row.ruleId)}
                        className="mt-1.5 rounded-md border border-[#8b5cf6] px-2.5 py-1 text-[9px] font-bold text-[#b69cff]"
                      >
                        اصلاح قیمت ✎
                      </button>
                    )}
                  </div>
                </div>
                {editing && (
                  <div className="mt-2 grid gap-1.5 border-t border-[#27334a] pt-2 sm:grid-cols-[1fr_1.3fr_auto]">
                    <input
                      value={sitePrices[row.ruleId] ?? ""}
                      onChange={(event) =>
                        setSitePrices((current) => ({
                          ...current,
                          [row.ruleId]: latinDigits(event.target.value),
                        }))
                      }
                      inputMode="numeric"
                      aria-label={`قیمت سایت ${classTitle(row)}`}
                      placeholder="قیمت جدید (تومان)"
                      className="rounded-md border border-[#34415a] bg-[#141d2e] px-2.5 py-1.5 text-[10px] text-white outline-none"
                    />
                    <input
                      value={priceReasons[row.ruleId] ?? ""}
                      onChange={(event) =>
                        setPriceReasons((current) => ({
                          ...current,
                          [row.ruleId]: event.target.value,
                        }))
                      }
                      aria-label={`دلیل تغییر قیمت ${classTitle(row)}`}
                      placeholder="دلیل تغییر قیمت"
                      className="rounded-md border border-[#34415a] bg-[#141d2e] px-2.5 py-1.5 text-[10px] text-white outline-none"
                    />
                    <button
                      type="button"
                      disabled={busyKey === `price-${row.ruleId}`}
                      onClick={() => void saveSitePrice(row)}
                      className="rounded-md bg-[#8b5cf6] px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-60"
                    >
                      ذخیره
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section data-commercial-section="price-history">
        <h3 className="mb-1.5 text-[10px] font-black text-white">تاریخچه تغییر قیمت</h3>
        {combinedHistory.length === 0 ? (
          <div className="rounded-lg border border-[#2a3550] bg-[#18243b] p-2.5 text-[9px] text-[#8c9bb2]">
            هنوز تغییری در قیمت کلاس‌های این پرواز ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {combinedHistory.map((entry, index) => (
              <div key={`${entry.changedAt}-${entry.className}-${index}`} className="rounded-lg border border-[#2a3550] bg-[#18243b] p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <span className="text-[9px] font-bold text-white">
                    {entry.className}: {faMoney(entry.previousPriceIrr)} ← {faMoney(entry.newPriceIrr)} تومان
                  </span>
                  <span className="font-num text-[#78879d]">{formatJalaliDateTime(entry.changedAt)}</span>
                </div>
                <p className="mt-1 text-[9px] text-[#9fb0c7]">{entry.reason}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {canManage && detail.derivedStatus !== "CANCELLED" && (
        <section className="rounded-lg border border-red-500/35 bg-red-500/5 p-2.5">
          {!cancelOpen ? (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="w-full rounded-md border border-red-500/60 px-4 py-2 text-[11px] font-black text-red-300"
            >
              کنسل کردن پرواز
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-red-200">
                علت کنسلی
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-red-500/40 bg-[#101827] p-2 text-[10px] text-white outline-none"
                  placeholder="علت کنسلی برای پیام‌رسانی و سوابق مالی"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCancelOpen(false)} className="rounded-md border border-[#34415a] py-2 text-[10px]">انصراف</button>
                <button type="button" disabled={busyKey === "cancel"} onClick={() => void submitCancellation()} className="rounded-md bg-red-600 py-2 text-[10px] font-black disabled:opacity-50">
                  {busyKey === "cancel" ? "در حال ثبت…" : "تأیید کنسلی"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={onConfirm}
        className="w-full rounded-md bg-[#3b82f6] px-4 py-2.5 text-[11px] font-black text-white"
      >
        تأیید
      </button>
    </div>
  );
}
