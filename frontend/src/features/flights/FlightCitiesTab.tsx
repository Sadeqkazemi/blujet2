import { useState } from "react";
import { createAirport, deleteAirport } from "../../api/flights";
import { faDigits, latinDigits } from "../../lib/fa-format";
import type { AirportEntry } from "../../types/flights";

interface FlightCitiesTabProps {
  airports: AirportEntry[];
  onCreated: (airport: AirportEntry) => void;
  onDeleted: (id: string) => void;
}

export default function FlightCitiesTab({
  airports,
  onCreated,
  onDeleted,
}: FlightCitiesTabProps) {
  const [cityFa, setCityFa] = useState("");
  const [code, setCode] = useState("");
  const [airportNameFa, setAirportNameFa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setNotice(null);
    const name = cityFa.trim();
    const iata = latinDigits(code.trim()).toUpperCase();
    const airportName = airportNameFa.trim();
    if (!name || iata.length !== 3) {
      setError("نام شهر و کد فرودگاه (۳ حرف) الزامی است.");
      return;
    }
    setBusy(true);
    try {
      const created = await createAirport({
        cityFa: name,
        code: iata,
        airportNameFa: airportName || undefined,
      });
      setCityFa("");
      setCode("");
      setAirportNameFa("");
      setNotice(
        `شهر «${name}» اضافه شد و در جستجوی بلیط سایت نمایش داده می‌شود ✓`,
      );
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت شهر.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(airport: AirportEntry) {
    if (!window.confirm(`فرودگاه ${airport.cityFa} حذف شود؟`)) return;
    setError(null);
    setNotice(null);
    try {
      await deleteAirport(airport.id);
      onDeleted(airport.id);
      setNotice(`فرودگاه «${airport.cityFa}» حذف شد.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در حذف فرودگاه.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">افزودن شهر جدید</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1.4fr_auto]">
          <div>
            <label
              htmlFor="city-name"
              className="mb-1 block text-[11px] font-bold text-muted"
            >
              نام شهر *
            </label>
            <input
              id="city-name"
              value={cityFa}
              onChange={(e) => setCityFa(e.target.value)}
              placeholder="مثلاً وان"
              className="h-10 w-full rounded-lg border border-border px-3 text-xs outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="city-code"
              className="mb-1 block text-[11px] font-bold text-muted"
            >
              کد فرودگاه *
            </label>
            <input
              id="city-code"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VAS"
              maxLength={3}
              className="font-num h-10 w-full rounded-lg border border-border px-3 text-xs outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="airport-name"
              className="mb-1 block text-[11px] font-bold text-muted"
            >
              نام فرودگاه
            </label>
            <input
              id="airport-name"
              value={airportNameFa}
              onChange={(e) => setAirportNameFa(e.target.value)}
              placeholder="مثلاً فرودگاه وان"
              className="h-10 w-full rounded-lg border border-border px-3 text-xs outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              disabled={busy}
              onClick={() => void onSubmit()}
              className="h-10 rounded-lg bg-accent px-5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? "در حال ثبت…" : "افزودن شهر"}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}
        {notice && (
          <p className="mt-2 text-[11px] font-bold text-[#059669]">{notice}</p>
        )}
        <p className="mt-3 text-[11px] text-muted">
          این شهرها همان لیستی هستند که در باکس جستجوی بلیط در صفحهٔ اصلی سایت
          هم نمایش داده می‌شوند.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-bold text-ink">شهرهای دارای پرواز</h2>
          <span className="text-[11px] text-muted">
            {faDigits(airports.length)} شهر
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            <div className="grid grid-cols-[1.2fr_0.7fr_1.6fr_auto] gap-3 border-b border-border px-5 py-2 text-[10px] font-bold text-muted">
              <span>شهر</span>
              <span>کد</span>
              <span>فرودگاه</span>
              <span>عملیات</span>
            </div>
            {airports.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[1.2fr_0.7fr_1.6fr_auto] items-center gap-3 border-b border-border px-5 py-3 text-xs"
              >
                <span className="font-bold text-ink">{a.cityFa}</span>
                <span className="ltr font-num text-muted">{a.code}</span>
                <span className="text-muted">{a.airportNameFa}</span>
                <button
                  onClick={() => void onDelete(a)}
                  className="text-danger"
                >
                  حذف
                </button>
              </div>
            ))}
            {airports.length === 0 && (
              <p className="py-8 text-center text-xs leading-6 text-muted">
                هنوز هیچ شهر پروازی ثبت نشده است. در سندباکس فقط شهرهایی که مدیر
                بازرگانی ثبت می‌کند نمایش داده می‌شوند.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
