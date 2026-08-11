import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchAircraftDefinitions } from '../../api/aircraft';
import {
  createScheduleTemplate,
  deactivateScheduleTemplate,
  fetchAirports,
  fetchScheduleTemplates,
  previewScheduleTemplate,
} from '../../api/flights';
import ConfirmActionDialog from '../../components/ConfirmActionDialog';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import { faDigits, faMoney, parseTomanToRialString } from '../../lib/fa-format';
import { dayjs, formatJalaliDate, toIsoDateOnly } from '../../lib/jalali';
import type { AircraftDefinitionListItem } from '../../types/aircraft';
import type { AirportEntry } from '../../types/flights';
import type { ScheduleTemplatePayload, ScheduleTemplatePreview, ScheduleTemplateRow } from '../../types/schedule-templates';

const WEEKDAYS = [
  [6, 'شنبه'], [7, 'یکشنبه'], [1, 'دوشنبه'], [2, 'سه‌شنبه'],
  [3, 'چهارشنبه'], [4, 'پنجشنبه'], [5, 'جمعه'],
] as const;

const INITIAL = {
  originAirportId: '', destinationAirportId: '', flightNoBase: '', aircraftDefinitionId: '',
  departureTime: '08:00', durationMinutes: '90', startDate: null as string | null,
  endDate: null as string | null, weekdays: [] as number[], agencyPriceToman: '', legalCeilingToman: '',
};

const INPUT_CLASS = 'mt-2 h-11 w-full rounded-lg border border-panel-border bg-panel-surface px-3 text-sm text-panel-ink outline-none focus:border-accent';

export default function ScheduleTemplatesTab() {
  const [airports, setAirports] = useState<AirportEntry[]>([]);
  const [aircraft, setAircraft] = useState<AircraftDefinitionListItem[]>([]);
  const [items, setItems] = useState<ScheduleTemplateRow[] | null>(null);
  const [form, setForm] = useState(INITIAL);
  const [preview, setPreview] = useState<ScheduleTemplatePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deactivateRow, setDeactivateRow] = useState<ScheduleTemplateRow | null>(null);

  const selectedAircraft = aircraft.find((row) => row.id === form.aircraftDefinitionId);

  const load = useCallback(async () => {
    const result = await fetchScheduleTemplates();
    setItems(result.items);
  }, []);

  useEffect(() => {
    Promise.all([fetchAirports(), fetchAircraftDefinitions(), fetchScheduleTemplates()])
      .then(([airportRows, aircraftRows, templates]) => {
        setAirports(airportRows);
        setAircraft(aircraftRows.filter((row) => row.status === 'ACTIVE'));
        setItems(templates.items);
      })
      .catch(() => setError('دریافت اطلاعات مسیرهای پروازی انجام نشد.'));
  }, []);

  const payload = useMemo<ScheduleTemplatePayload | null>(() => {
    const agencyPriceIrr = parseTomanToRialString(form.agencyPriceToman);
    const legalCeilingIrr = parseTomanToRialString(form.legalCeilingToman);
    if (!form.originAirportId || !form.destinationAirportId || !form.aircraftDefinitionId ||
      !form.flightNoBase.trim() || !form.startDate || !form.endDate || form.weekdays.length === 0 ||
      !agencyPriceIrr || !legalCeilingIrr || Number(form.durationMinutes) <= 0) return null;
    return {
      originAirportId: form.originAirportId,
      destinationAirportId: form.destinationAirportId,
      flightNoBase: form.flightNoBase.trim().toUpperCase(),
      aircraftDefinitionId: form.aircraftDefinitionId,
      departureTime: form.departureTime,
      durationMinutes: Number(form.durationMinutes),
      startDate: toIsoDateOnly(dayjs(form.startDate)),
      endDate: toIsoDateOnly(dayjs(form.endDate)),
      weekdays: form.weekdays,
      agencyPriceIrr,
      legalCeilingIrr,
    };
  }, [form]);

  function toggleWeekday(day: number) {
    setPreview(null);
    setForm((current) => ({ ...current, weekdays: current.weekdays.includes(day) ? current.weekdays.filter((x) => x !== day) : [...current.weekdays, day] }));
  }

  async function runPreview() {
    if (!payload) { setError('همه فیلدهای ضروری مسیر، بازه، روزها و قیمت را کامل کنید.'); return; }
    setBusy(true); setError(null); setNotice(null);
    try { setPreview(await previewScheduleTemplate(payload)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'پیش‌نمایش مسیر ایجاد نشد.'); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!payload) { setError('همه فیلدهای ضروری را کامل کنید.'); return; }
    setBusy(true); setError(null);
    try {
      await createScheduleTemplate({ ...payload, idempotencyKey: crypto.randomUUID() });
      setForm(INITIAL); setPreview(null); setNotice('مسیر فصلی و پروازهای متناظر با موفقیت ایجاد شدند.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ایجاد مسیر انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function confirmDeactivate() {
    if (!deactivateRow) return;
    setBusy(true); setError(null);
    try { await deactivateScheduleTemplate(deactivateRow.id); setDeactivateRow(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'غیرفعال‌سازی مسیر انجام نشد.'); }
    finally { setBusy(false); }
  }

  return <div className="flex flex-col gap-5" data-testid="schedule-templates-tab">
    <section className="rounded-xl border border-panel-border bg-panel-surface p-5">
      <h2 className="text-base font-black text-panel-ink">تعریف مسیر پروازی جدید</h2>
      <p className="mt-1 text-xs leading-6 text-panel-muted">روزهای هفته و ساعت را مشخص کنید؛ سامانه پروازهای بازه انتخابی را پس از کنترل تداخل ایجاد می‌کند.</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-300">{notice}</p>}
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-xs font-bold text-panel-muted">مبدأ<select value={form.originAirportId} onChange={(e) => setForm({ ...form, originAirportId: e.target.value })} className={INPUT_CLASS}><option value="">انتخاب مبدأ</option>{airports.map((a) => <option key={a.id} value={a.id}>{a.cityFa} ({a.code})</option>)}</select></label>
        <label className="text-xs font-bold text-panel-muted">مقصد<select value={form.destinationAirportId} onChange={(e) => setForm({ ...form, destinationAirportId: e.target.value })} className={INPUT_CLASS}><option value="">انتخاب مقصد</option>{airports.map((a) => <option key={a.id} value={a.id}>{a.cityFa} ({a.code})</option>)}</select></label>
        <label className="text-xs font-bold text-panel-muted">شماره پرواز<input dir="ltr" value={form.flightNoBase} onChange={(e) => setForm({ ...form, flightNoBase: e.target.value })} placeholder="XY1234" className={INPUT_CLASS} /></label>
        <label className="text-xs font-bold text-panel-muted">هواپیما<select value={form.aircraftDefinitionId} onChange={(e) => setForm({ ...form, aircraftDefinitionId: e.target.value })} className={INPUT_CLASS}><option value="">انتخاب هواپیما</option>{aircraft.map((a) => <option key={a.id} value={a.id}>{a.title} · {faDigits(a.totalCapacity)} صندلی</option>)}</select></label>
        <label className="text-xs font-bold text-panel-muted">تعداد صندلی<input readOnly value={selectedAircraft ? faDigits(selectedAircraft.totalCapacity) : ''} placeholder="پس از انتخاب هواپیما" className={`${INPUT_CLASS} cursor-not-allowed opacity-80`} /></label>
        <label className="text-xs font-bold text-panel-muted">ساعت پرواز<input type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} className={INPUT_CLASS} /></label>
        <label className="text-xs font-bold text-panel-muted">مدت پرواز (دقیقه)<input inputMode="numeric" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className={INPUT_CLASS} /></label>
        <div className="rounded-xl border border-panel-border bg-panel-surface-2 p-3" data-testid="schedule-start-date-field">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-black text-panel-ink">تاریخ شروع پروازها</span>
            <span className="font-num text-[11px] text-accent">{form.startDate ? formatJalaliDate(toIsoDateOnly(dayjs(form.startDate))) : 'انتخاب نشده'}</span>
          </div>
          <JalaliDatePicker label="شروع بازه" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} theme="dark" singleLine />
        </div>
        <div className="rounded-xl border border-panel-border bg-panel-surface-2 p-3" data-testid="schedule-end-date-field">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-black text-panel-ink">تاریخ پایان پروازها</span>
            <span className="font-num text-[11px] text-accent">{form.endDate ? formatJalaliDate(toIsoDateOnly(dayjs(form.endDate))) : 'انتخاب نشده'}</span>
          </div>
          <JalaliDatePicker label="پایان بازه" value={form.endDate} minDate={form.startDate ?? undefined} onChange={(v) => setForm({ ...form, endDate: v })} theme="dark" singleLine />
        </div>
        <div className="md:col-span-3"><div className="mb-2 text-xs font-bold text-panel-muted">روزهای پرواز</div><div className="flex flex-wrap gap-2">{WEEKDAYS.map(([day, label]) => <button key={day} type="button" onClick={() => toggleWeekday(day)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${form.weekdays.includes(day) ? 'border-accent bg-accent text-white' : 'border-panel-border text-panel-muted'}`}>{label}</button>)}</div></div>
        <label className="text-xs font-bold text-panel-muted">قیمت آژانس (تومان)<input inputMode="numeric" value={form.agencyPriceToman} onChange={(e) => setForm({ ...form, agencyPriceToman: e.target.value })} className={INPUT_CLASS} /></label>
        <label className="text-xs font-bold text-panel-muted">سقف قانونی (تومان)<input inputMode="numeric" value={form.legalCeilingToman} onChange={(e) => setForm({ ...form, legalCeilingToman: e.target.value })} className={INPUT_CLASS} /></label>
        <div className="flex items-end gap-2"><button type="button" onClick={() => void runPreview()} disabled={busy} className="rounded-lg border border-accent px-4 py-3 text-xs font-black text-accent">پیش‌نمایش</button><button type="submit" disabled={busy || !preview} className="rounded-lg bg-accent px-4 py-3 text-xs font-black text-white disabled:opacity-40">ایجاد مسیر</button></div>
      </form>
      {preview && <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-xs text-panel-muted">این برنامه <b className="text-emerald-300">{faDigits(preview.occurrenceCount)} پرواز</b> با ظرفیت <b className="text-panel-ink">{faDigits(preview.capacity)}</b> ایجاد می‌کند.</div>}
    </section>
    <section className="rounded-xl border border-panel-border bg-panel-surface p-5"><h2 className="mb-4 text-sm font-black text-panel-ink">مسیرهای پروازی تعریف‌شده</h2>
      {items === null ? <p className="py-6 text-center text-xs text-panel-muted">در حال بارگذاری…</p> : items.length === 0 ? <p className="py-6 text-center text-xs text-panel-muted">هنوز مسیر پروازی تعریف نشده است.</p> : <div className="flex flex-col gap-3">{items.map((row) => <article key={row.id} className="rounded-xl border border-panel-border bg-panel-surface-2 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><b className="text-sm text-panel-ink">{row.originCode ?? '—'} ← {row.destCode ?? '—'}</b><div dir="ltr" className="mt-1 font-num text-xs text-panel-muted">{row.flightNoBase} · {row.departureTime}</div></div><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${row.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>{row.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}</span></div><div className="mt-3 flex flex-wrap gap-4 text-[11px] text-panel-muted"><span>{formatJalaliDate(row.startDate)} تا {formatJalaliDate(row.endDate)}</span><span>{faDigits(row.weekdays.length)} روز در هفته</span><span>{faDigits(row.capacity)} صندلی</span><span>{faMoney(row.agencyPriceIrr)} تومان</span></div>{row.status === 'ACTIVE' && <button type="button" onClick={() => setDeactivateRow(row)} className="mt-3 text-xs font-bold text-red-300">غیرفعال‌سازی</button>}</article>)}</div>}
    </section>
    <ConfirmActionDialog open={!!deactivateRow} title="غیرفعال‌سازی مسیر" message="پروازهای آینده بدون رزرو، تعهد یا قفل لغو می‌شوند؛ سوابق و پروازهای متعهد حفظ خواهند شد." confirmLabel="غیرفعال کن" cancelLabel="انصراف" busy={busy} onConfirm={confirmDeactivate} onCancel={() => setDeactivateRow(null)} />
  </div>;
}
