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
  parseTomanToRialString,
} from "../../../lib/fa-format";
import type {
  CommercialFareClassControl,
  CommercialFlightControl,
} from "../../../types/flights";

interface Props {
  instanceId: string;
  canManage: boolean;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}

const cabinLabels = {
  ECONOMY: "اکونومی",
  COMFORT: "کامفورت",
  BUSINESS: "بیزینس",
  FIRST: "فرست",
} as const;

export default function CommercialFareClassControls({
  instanceId,
  canManage,
  onNotice,
  onError,
}: Props) {
  const [data, setData] = useState<CommercialFlightControl | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [sitePriceInputs, setSitePriceInputs] = useState<Record<string, string>>(
    {},
  );
  const [siteSeats, setSiteSeats] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [agencySeats, setAgencySeats] = useState<Record<string, string>>({});
  const [agencyPrices, setAgencyPrices] = useState<Record<string, string>>({});
  const [specialOffers, setSpecialOffers] = useState<Record<string, boolean>>(
    {},
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchCommercialFlightControl(instanceId);
      setData(next);
      setSitePriceInputs(
        Object.fromEntries(
          next.fareClasses.map((row) => [
            row.ruleId,
            irrToTomanInput(row.sitePriceIrr ?? row.basePriceIrr),
          ]),
        ),
      );
      setSiteSeats(
        Object.fromEntries(
          next.fareClasses.map((row) => [row.ruleId, String(row.siteSeatsReleased)]),
        ),
      );
      setAgencySeats(
        Object.fromEntries(
          next.fareClasses.map((row) => [
            row.ruleId,
            String(row.agencySeatsReleased),
          ]),
        ),
      );
      setAgencyPrices(
        Object.fromEntries(
          next.fareClasses.map((row) => [
            row.ruleId,
            row.agencyReleasePriceIrr
              ? irrToTomanInput(row.agencyReleasePriceIrr)
              : "",
          ]),
        ),
      );
      setSpecialOffers(
        Object.fromEntries(
          next.fareClasses.map((row) => [row.ruleId, row.agencySpecialOffer]),
        ),
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "خطا در دریافت کنترل فروش کلاس‌های نرخی.",
      );
    } finally {
      setLoading(false);
    }
  }, [instanceId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRevenueIrr = useMemo(
    () =>
      data?.fareClasses.reduce(
        (sum, row) => sum + BigInt(row.revenueIrr),
        0n,
      ) ?? 0n,
    [data],
  );

  async function toggleVisibility(enabled: boolean) {
    setBusyKey("visibility");
    try {
      await updateFlightSalesVisibility(instanceId, enabled);
      setData((current) =>
        current ? { ...current, publicSaleEnabled: enabled } : current,
      );
      onNotice(
        enabled
          ? "فروش این پرواز در سایت عمومی فعال شد."
          : "فروش این پرواز در سایت عمومی متوقف شد.",
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "ثبت وضعیت فروش ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveSitePrice(row: CommercialFareClassControl) {
    const priceIrr = parseTomanToRialString(sitePriceInputs[row.ruleId] ?? "");
    const reason = (reasons[row.ruleId] ?? "").trim();
    const seats = Number(siteSeats[row.ruleId] ?? 0);
    const maximum = Math.max(row.seatsAllocated - row.agencySeatsReleased, 0);
    if (!Number.isInteger(seats) || seats < 0 || seats > maximum) {
      onError(`تعداد صندلی سایت باید بین صفر و ${maximum} باشد.`);
      return;
    }
    if (!priceIrr || reason.length < 2) {
      onError("قیمت معتبر و دلیل تغییر قیمت کلاس را وارد کنید.");
      return;
    }
    setBusyKey(`site-${row.ruleId}`);
    try {
      await updateFareClassSitePrice(instanceId, row.ruleId, {
        priceIrr,
        reason,
        seats,
      });
      setReasons((current) => ({ ...current, [row.ruleId]: "" }));
      await load();
      onNotice(`قیمت فروش سایت کلاس ${row.classCode} ثبت شد.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "ثبت قیمت ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAgencyRelease(row: CommercialFareClassControl) {
    const seats = Number(agencySeats[row.ruleId] ?? 0);
    const maximum = Math.max(row.seatsAllocated - row.siteSeatsReleased, 0);
    const priceIrr =
      seats === 0
        ? "0"
        : parseTomanToRialString(agencyPrices[row.ruleId] ?? "");
    if (!Number.isInteger(seats) || seats < 0 || seats > maximum) {
      onError(`تعداد سهمیه باید بین صفر و ${maximum} باشد.`);
      return;
    }
    if (!priceIrr) {
      onError("قیمت فروش آژانسی را وارد کنید.");
      return;
    }
    setBusyKey(`agency-${row.ruleId}`);
    try {
      await upsertAgencyFareRelease(instanceId, row.ruleId, {
        seats,
        priceIrr,
        specialOffer: specialOffers[row.ruleId] ?? false,
      });
      await load();
      onNotice(`سهمیه آژانسی کلاس ${row.classCode} ثبت شد.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "ثبت سهمیه ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <div className="mt-3 text-xs text-panel-muted">در حال دریافت کنترل فروش…</div>;
  }
  if (!data) return null;

  return (
    <section className="mt-3 rounded-xl border border-panel-border bg-panel-canvas p-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-panel-ink">کنترل فروش کلاس‌های نرخی</h3>
          <p className="mt-1 text-[10px] text-panel-muted">
            قیمت سایت و سهمیه آژانسی هر کلاس مستقل است و تغییرات قیمت در تاریخچه ثبت می‌شود.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-panel-ink">
          <input
            type="checkbox"
            checked={data.publicSaleEnabled}
            disabled={!canManage || busyKey === "visibility"}
            onChange={(event) => void toggleVisibility(event.target.checked)}
            className="h-5 w-5 accent-[#34d399]"
          />
          فروش در سایت
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-panel-border p-2 text-xs text-panel-muted">
        درآمد کلاس‌های نرخی: <strong className="text-accent">{faMoney(totalRevenueIrr.toString())} تومان</strong>
      </div>

      <div className="mt-3 space-y-3">
        {data.fareClasses.length === 0 && (
          <div className="rounded-lg border border-dashed border-panel-border p-5 text-center text-xs text-panel-muted">
            ابتدا کلاس‌های نرخی این پرواز را تعریف کنید.
          </div>
        )}
        {data.fareClasses.map((row) => (
          <article key={row.ruleId} className="rounded-xl border border-panel-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-black text-panel-ink">
                {cabinLabels[row.cabin]} · کلاس {row.classCode}
              </div>
              <div className="text-[10px] text-panel-muted">
                فروش {faDigits(row.soldSeats)} از {faDigits(row.seatsAllocated)} · مانده {faDigits(row.remainingSeats)}
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <input
                value={sitePriceInputs[row.ruleId] ?? ""}
                onChange={(event) =>
                  setSitePriceInputs((current) => ({
                    ...current,
                    [row.ruleId]: event.target.value,
                  }))
                }
                disabled={!canManage}
                inputMode="numeric"
                placeholder="قیمت سایت (تومان)"
                className="rounded-lg border border-panel-border-2 bg-panel-surface px-3 py-2 text-xs text-panel-ink outline-none"
              />
              <input
                value={siteSeats[row.ruleId] ?? "0"}
                onChange={(event) =>
                  setSiteSeats((current) => ({ ...current, [row.ruleId]: event.target.value }))
                }
                disabled={!canManage}
                inputMode="numeric"
                placeholder="صندلی آزادشده برای سایت"
                className="rounded-lg border border-panel-border-2 bg-panel-surface px-3 py-2 text-xs text-panel-ink outline-none"
              />
              <input
                value={reasons[row.ruleId] ?? ""}
                onChange={(event) =>
                  setReasons((current) => ({ ...current, [row.ruleId]: event.target.value }))
                }
                disabled={!canManage}
                placeholder="دلیل تغییر قیمت"
                className="rounded-lg border border-panel-border-2 bg-panel-surface px-3 py-2 text-xs text-panel-ink outline-none"
              />
              <button
                type="button"
                disabled={!canManage || busyKey === `site-${row.ruleId}`}
                onClick={() => void saveSitePrice(row)}
                className="rounded-lg bg-[#7c3aed] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                ثبت قیمت سایت
              </button>
            </div>

            <div className="mt-2 grid gap-2 border-t border-panel-border pt-2 sm:grid-cols-4">
              <input
                value={agencySeats[row.ruleId] ?? "0"}
                onChange={(event) =>
                  setAgencySeats((current) => ({ ...current, [row.ruleId]: event.target.value }))
                }
                disabled={!canManage}
                inputMode="numeric"
                placeholder="تعداد صندلی آژانسی"
                className="rounded-lg border border-panel-border-2 bg-panel-surface px-3 py-2 text-xs text-panel-ink outline-none"
              />
              <input
                value={agencyPrices[row.ruleId] ?? ""}
                onChange={(event) =>
                  setAgencyPrices((current) => ({ ...current, [row.ruleId]: event.target.value }))
                }
                disabled={!canManage}
                inputMode="numeric"
                placeholder="قیمت آژانسی (تومان)"
                className="rounded-lg border border-panel-border-2 bg-panel-surface px-3 py-2 text-xs text-panel-ink outline-none"
              />
              <label className="flex items-center gap-2 rounded-lg border border-panel-border-2 px-3 py-2 text-xs text-panel-muted">
                <input
                  type="checkbox"
                  checked={specialOffers[row.ruleId] ?? false}
                  disabled={!canManage}
                  onChange={(event) =>
                    setSpecialOffers((current) => ({
                      ...current,
                      [row.ruleId]: event.target.checked,
                    }))
                  }
                />
                پیشنهاد ویژه
              </label>
              <button
                type="button"
                disabled={!canManage || busyKey === `agency-${row.ruleId}`}
                onClick={() => void saveAgencyRelease(row)}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                ثبت سهمیه آژانسی
              </button>
            </div>

            {row.priceHistory.length > 0 && (
              <details className="mt-2 text-[10px] text-panel-muted">
                <summary className="cursor-pointer font-bold text-accent">تاریخچه تغییر قیمت</summary>
                <div className="mt-2 space-y-1">
                  {row.priceHistory.map((entry) => (
                    <div key={`${entry.changedAt}-${entry.newPriceIrr}`} className="rounded bg-panel-surface p-2">
                      {faMoney(entry.previousPriceIrr)} ← {faMoney(entry.newPriceIrr)} تومان · {entry.reason}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
