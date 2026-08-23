import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { fetchAircraftDefinitions } from "../../api/aircraft";
import {
  createScheduleTemplate,
  deactivateScheduleTemplate,
  fetchAirports,
  fetchScheduleTemplates,
  previewScheduleTemplate,
} from "../../api/flights";
import ConfirmActionDialog from "../../components/ConfirmActionDialog";
import JalaliDatePicker from "../../components/JalaliDatePicker";
import { faDigits, faMoney, parseTomanToRialString } from "../../lib/fa-format";
import { dayjs, formatJalaliDate, toIsoDateOnly } from "../../lib/jalali";
import { normalizeTomanInput } from "../../lib/money-input";
import { tomanInputWords } from "../../lib/persian-number-words";
import { createRequestKey } from "../../lib/request-key";
import type { AircraftDefinitionListItem } from "../../types/aircraft";
import type { AirportEntry } from "../../types/flights";
import type {
  ScheduleTemplatePayload,
  ScheduleTemplatePreview,
  ScheduleTemplateRow,
} from "../../types/schedule-templates";

const WEEKDAYS = [
  [6, "شنبه"],
  [7, "یکشنبه"],
  [1, "دوشنبه"],
  [2, "سه‌شنبه"],
  [3, "چهارشنبه"],
  [4, "پنجشنبه"],
  [5, "جمعه"],
] as const;

const INITIAL = {
  originAirportId: "",
  destinationAirportId: "",
  flightNoBase: "",
  aircraftDefinitionId: "",
  departureTime: "08:00",
  durationMinutes: "90",
  startDate: null as string | null,
  endDate: null as string | null,
  weekdays: [] as number[],
  agencyPriceToman: "",
  legalCeilingToman: "",
};

const INPUT_CLASS =
  "mt-2 h-11 w-full rounded-lg border border-panel-border bg-panel-surface px-3 text-sm text-panel-ink outline-none focus:border-accent";

type ScheduleField =
  | "originAirportId"
  | "destinationAirportId"
  | "flightNoBase"
  | "aircraftDefinitionId"
  | "departureTime"
  | "durationMinutes"
  | "startDate"
  | "endDate"
  | "weekdays"
  | "agencyPriceToman"
  | "legalCeilingToman";

const FIELD_LABELS: Record<ScheduleField, string> = {
  originAirportId: "مبدأ",
  destinationAirportId: "مقصد",
  flightNoBase: "شماره پرواز",
  aircraftDefinitionId: "نوع هواپیما",
  departureTime: "ساعت پرواز",
  durationMinutes: "مدت پرواز",
  startDate: "تاریخ شروع",
  endDate: "تاریخ پایان",
  weekdays: "روزهای پرواز",
  agencyPriceToman: "قیمت آژانس",
  legalCeilingToman: "قیمت قانونی",
};

export default function ScheduleTemplatesTab() {
  const [airports, setAirports] = useState<AirportEntry[]>([]);
  const [aircraft, setAircraft] = useState<AircraftDefinitionListItem[]>([]);
  const [items, setItems] = useState<ScheduleTemplateRow[] | null>(null);
  const [form, setForm] = useState(INITIAL);
  const [preview, setPreview] = useState<ScheduleTemplatePreview | null>(null);
  const [previewedPayloadKey, setPreviewedPayloadKey] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<ScheduleField>>(
    new Set(),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivateRow, setDeactivateRow] =
    useState<ScheduleTemplateRow | null>(null);
  const [routeTab, setRouteTab] = useState<"active" | "history">("active");
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [routePreviews, setRoutePreviews] = useState<
    Record<string, ScheduleTemplatePreview>
  >({});
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const selectedAircraft = aircraft.find(
    (row) => row.id === form.aircraftDefinitionId,
  );

  const activeRoutes = useMemo(
    () => (items ?? []).filter((row) => row.status === "ACTIVE"),
    [items],
  );
  const historyRoutes = useMemo(
    () => (items ?? []).filter((row) => row.status === "DEACTIVATED"),
    [items],
  );
  const visibleRoutes = routeTab === "active" ? activeRoutes : historyRoutes;

  const load = useCallback(async () => {
    const result = await fetchScheduleTemplates();
    setItems(result.items);
  }, []);

  useEffect(() => {
    Promise.all([
      fetchAirports(),
      fetchAircraftDefinitions(),
      fetchScheduleTemplates(),
    ])
      .then(([airportRows, aircraftRows, templates]) => {
        setAirports(airportRows);
        setAircraft(aircraftRows.filter((row) => row.status === "ACTIVE"));
        setItems(templates.items);
      })
      .catch(() => setError("دریافت اطلاعات مسیرهای پروازی انجام نشد."));
  }, []);

  const payload = useMemo<ScheduleTemplatePayload | null>(() => {
    const agencyPriceIrr = parseTomanToRialString(form.agencyPriceToman);
    const legalCeilingIrr = parseTomanToRialString(form.legalCeilingToman);
    if (
      !form.originAirportId ||
      !form.destinationAirportId ||
      !form.aircraftDefinitionId ||
      !form.flightNoBase.trim() ||
      !form.startDate ||
      !form.endDate ||
      form.weekdays.length === 0 ||
      !agencyPriceIrr ||
      !legalCeilingIrr ||
      Number(form.durationMinutes) <= 0
    )
      return null;
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

  const payloadKey = payload ? JSON.stringify(payload) : null;
  const previewIsCurrent = Boolean(
    preview && payloadKey && previewedPayloadKey === payloadKey,
  );

  useEffect(() => {
    if (previewedPayloadKey !== null && previewedPayloadKey !== payloadKey) {
      setPreview(null);
      setPreviewedPayloadKey(null);
    }
  }, [payloadKey, previewedPayloadKey]);

  function updateForm<K extends keyof typeof INITIAL>(
    field: K,
    value: (typeof INITIAL)[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field in FIELD_LABELS) {
      setInvalidFields((current) => {
        const next = new Set(current);
        next.delete(field as ScheduleField);
        return next;
      });
    }
    setError(null);
  }

  function fieldClass(field: ScheduleField) {
    return `${INPUT_CLASS} ${invalidFields.has(field) ? "border-red-500 ring-1 ring-red-500/30" : ""}`;
  }

  function validateFields(): ScheduleField[] {
    const invalid: ScheduleField[] = [];
    if (!form.originAirportId) invalid.push("originAirportId");
    if (!form.destinationAirportId) invalid.push("destinationAirportId");
    if (!form.flightNoBase.trim()) invalid.push("flightNoBase");
    if (!form.aircraftDefinitionId) invalid.push("aircraftDefinitionId");
    if (!form.departureTime) invalid.push("departureTime");
    if (!form.durationMinutes || Number(form.durationMinutes) <= 0) {
      invalid.push("durationMinutes");
    }
    if (!form.startDate) invalid.push("startDate");
    if (!form.endDate) invalid.push("endDate");
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      invalid.push("startDate", "endDate");
    }
    if (form.weekdays.length === 0) invalid.push("weekdays");
    if (!parseTomanToRialString(form.agencyPriceToman)) {
      invalid.push("agencyPriceToman");
    }
    if (!parseTomanToRialString(form.legalCeilingToman)) {
      invalid.push("legalCeilingToman");
    }
    return [...new Set(invalid)];
  }

  function showValidationError(fields: ScheduleField[]) {
    setInvalidFields(new Set(fields));
    setError(
      fields.length
        ? `فیلدهای ناقص یا نامعتبر: ${fields
            .map((field) => FIELD_LABELS[field])
            .join("، ")}.`
        : null,
    );
  }

  function markApiError(cause: unknown, fallback: string) {
    const message = cause instanceof Error ? cause.message : fallback;
    const fields: ScheduleField[] = [];
    if (/شماره پرواز|پرواز.*یونیک|پرواز.*مسیر دیگری/.test(message)) {
      fields.push("flightNoBase");
    }
    if (/مبدأ و مقصد|فرودگاه/.test(message)) {
      fields.push("originAirportId", "destinationAirportId");
    }
    if (/هواپیما/.test(message)) fields.push("aircraftDefinitionId");
    if (/قیمت آژانس/.test(message)) fields.push("agencyPriceToman");
    if (/سقف قانونی/.test(message)) fields.push("legalCeilingToman");
    if (/بازه تاریخ|تاریخ/.test(message)) fields.push("startDate", "endDate");
    if (/روزهای هفته|هیچ تاریخی/.test(message)) fields.push("weekdays");
    if (fields.length) setInvalidFields(new Set(fields));
    setError(message);
  }

  function toggleWeekday(day: number) {
    setPreview(null);
    updateForm(
      "weekdays",
      form.weekdays.includes(day)
        ? form.weekdays.filter((x) => x !== day)
        : [...form.weekdays, day],
    );
  }

  async function runPreview() {
    const invalid = validateFields();
    if (invalid.length) {
      showValidationError(invalid);
      return;
    }
    if (!payload) {
      showValidationError(validateFields());
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await previewScheduleTemplate(payload);
      setPreview(result);
      setPreviewedPayloadKey(payloadKey);
      window.setTimeout(
        () =>
          previewRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        0,
      );
    } catch (cause) {
      markApiError(cause, "پیش‌نمایش مسیر ایجاد نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validateFields();
    if (invalid.length) {
      showValidationError(invalid);
      return;
    }
    if (!payload || !previewIsCurrent) {
      setError("ابتدا برای اطلاعات فعلی پیش‌نمایش معتبر بگیرید.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createScheduleTemplate({
        ...payload,
        idempotencyKey: createRequestKey(),
      });
      setForm(INITIAL);
      setInvalidFields(new Set());
      setPreview(null);
      setPreviewedPayloadKey(null);
      setNotice("مسیر فصلی و پروازهای متناظر با موفقیت ایجاد شدند.");
      setFormOpen(false);
      await load();
    } catch (cause) {
      markApiError(cause, "ایجاد مسیر انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateRow) return;
    setBusy(true);
    setError(null);
    try {
      await deactivateScheduleTemplate(deactivateRow.id);
      setDeactivateRow(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "غیرفعال‌سازی مسیر انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  }

  function weekdayLabels(days: number[]) {
    return days
      .map((day) => WEEKDAYS.find(([value]) => value === day)?.[1])
      .filter(Boolean)
      .join("، ");
  }

  async function toggleRouteExpand(row: ScheduleTemplateRow) {
    if (expandedRouteId === row.id) {
      setExpandedRouteId(null);
      return;
    }
    setExpandedRouteId(row.id);
    if (routePreviews[row.id]) return;
    setPreviewBusyId(row.id);
    setError(null);
    try {
      const previewPayload: ScheduleTemplatePayload = {
        originAirportId: row.originAirportId,
        destinationAirportId: row.destinationAirportId,
        flightNoBase: row.flightNoBase,
        aircraftDefinitionId: row.aircraftDefinitionId,
        departureTime: row.departureTime,
        durationMinutes: row.durationMinutes,
        startDate: row.startDate,
        endDate: row.endDate,
        weekdays: row.weekdays,
        agencyPriceIrr: row.agencyPriceIrr,
        legalCeilingIrr: row.legalCeilingIrr,
      };
      const result = await previewScheduleTemplate(previewPayload);
      setRoutePreviews((current) => ({ ...current, [row.id]: result }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "دریافت تاریخ‌های پرواز انجام نشد.",
      );
    } finally {
      setPreviewBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="schedule-templates-tab">
      <button
        type="button"
        aria-expanded={formOpen}
        onClick={() => setFormOpen(true)}
        className="flex w-max self-end items-center gap-2 rounded-[10px] bg-accent px-4 py-3 text-xs font-black text-white transition hover:brightness-110"
      >
        <span aria-hidden>+</span>
        افزودن مسیر جدید
      </button>
      {formOpen && (
      <section className="rounded-xl border border-panel-border bg-panel-surface p-5">
        <h2 className="text-base font-black text-panel-ink">
          تعریف مسیر پروازی جدید
        </h2>
        <p className="mt-1 text-xs leading-6 text-panel-muted">
          روزهای هفته و ساعت را مشخص کنید؛ سامانه پروازهای بازه انتخابی را پس از
          کنترل تداخل ایجاد می‌کند.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-300"
          >
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {notice}
          </p>
        )}
        <form data-testid="schedule-route-form" onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold text-panel-muted">
            مبدأ *
            <select
              value={form.originAirportId}
              onChange={(e) => updateForm("originAirportId", e.target.value)}
              className={fieldClass("originAirportId")}
              aria-invalid={invalidFields.has("originAirportId")}
            >
              <option value="">انتخاب مبدأ</option>
              {airports.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.cityFa} ({a.code})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-panel-muted">
            مقصد *
            <select
              value={form.destinationAirportId}
              onChange={(e) => updateForm("destinationAirportId", e.target.value)}
              className={fieldClass("destinationAirportId")}
              aria-invalid={invalidFields.has("destinationAirportId")}
            >
              <option value="">انتخاب مقصد</option>
              {airports.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.cityFa} ({a.code})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-panel-muted">
            شماره پرواز (پایه) *
            <input
              dir="ltr"
              value={form.flightNoBase}
              onChange={(e) => updateForm("flightNoBase", e.target.value)}
              placeholder="XY1234"
              className={fieldClass("flightNoBase")}
              aria-invalid={invalidFields.has("flightNoBase")}
            />
          </label>
          <label className="text-xs font-bold text-panel-muted">
            نوع هواپیما *
            <select
              value={form.aircraftDefinitionId}
              onChange={(e) => updateForm("aircraftDefinitionId", e.target.value)}
              className={fieldClass("aircraftDefinitionId")}
              aria-invalid={invalidFields.has("aircraftDefinitionId")}
            >
              <option value="">انتخاب هواپیما</option>
              {aircraft.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · {faDigits(a.totalCapacity)} صندلی
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-panel-muted">
            تعداد صندلی هواپیما *
            <input
              readOnly
              value={
                selectedAircraft ? faDigits(selectedAircraft.totalCapacity) : ""
              }
              placeholder="پس از انتخاب هواپیما"
              className={`${INPUT_CLASS} cursor-not-allowed opacity-80`}
            />
          </label>
          <label className="text-xs font-bold text-panel-muted">
            ساعت پرواز *
            <input
              type="time"
              value={form.departureTime}
              onChange={(e) => updateForm("departureTime", e.target.value)}
              className={fieldClass("departureTime")}
              aria-invalid={invalidFields.has("departureTime")}
            />
          </label>
          <label className="text-xs font-bold text-panel-muted">
            مدت پرواز (دقیقه) *
            <input
              inputMode="numeric"
              value={form.durationMinutes}
              onChange={(e) => updateForm("durationMinutes", e.target.value)}
              className={fieldClass("durationMinutes")}
              aria-invalid={invalidFields.has("durationMinutes")}
            />
          </label>
          <div
            className={`rounded-xl border bg-panel-surface-2 p-3 ${invalidFields.has("startDate") ? "border-red-500 ring-1 ring-red-500/30" : "border-panel-border"}`}
            data-testid="schedule-start-date-field"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-panel-ink">
                تاریخ شروع پروازها
              </span>
              <span className="font-num text-[11px] text-accent">
                {form.startDate
                  ? formatJalaliDate(toIsoDateOnly(dayjs(form.startDate)))
                  : "انتخاب نشده"}
              </span>
            </div>
            <JalaliDatePicker
              label="شروع بازه"
              value={form.startDate}
              onChange={(v) => updateForm("startDate", v)}
              theme="dark"
              singleLine
            />
          </div>
          <div
            className={`rounded-xl border bg-panel-surface-2 p-3 ${invalidFields.has("endDate") ? "border-red-500 ring-1 ring-red-500/30" : "border-panel-border"}`}
            data-testid="schedule-end-date-field"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-panel-ink">
                تاریخ پایان پروازها
              </span>
              <span className="font-num text-[11px] text-accent">
                {form.endDate
                  ? formatJalaliDate(toIsoDateOnly(dayjs(form.endDate)))
                  : "انتخاب نشده"}
              </span>
            </div>
            <JalaliDatePicker
              label="پایان بازه"
              value={form.endDate}
              minDate={form.startDate ?? undefined}
              onChange={(v) => updateForm("endDate", v)}
              theme="dark"
              singleLine
            />
          </div>
          <div className="md:col-span-2">
            <div className="mb-2 text-xs font-bold text-panel-muted">
              روزهای پرواز
            </div>
            <div className={`flex flex-wrap gap-2 rounded-lg border p-2 ${invalidFields.has("weekdays") ? "border-red-500 ring-1 ring-red-500/30" : "border-transparent"}`}>
              {WEEKDAYS.map(([day, label]) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeekday(day)}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${form.weekdays.includes(day) ? "border-accent bg-accent text-white" : "border-panel-border text-panel-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs font-bold text-panel-muted">
            قیمت هر صندلی برای آژانس‌ها (تومان) *
            <input
              aria-label="قیمت آژانس (تومان)"
              inputMode="numeric"
              dir="rtl"
              value={form.agencyPriceToman}
              onChange={(e) =>
                updateForm("agencyPriceToman", normalizeTomanInput(e.target.value))
              }
              className={fieldClass("agencyPriceToman")}
              aria-invalid={invalidFields.has("agencyPriceToman")}
            />
            <span
              aria-live="polite"
              className="mt-2 block min-h-5 text-[11px] font-medium text-accent"
            >
              {tomanInputWords(form.agencyPriceToman)}
            </span>
          </label>
          <label className="text-xs font-bold text-panel-muted">
            قیمت مصوب / نرخ قانونی سازمان (تومان) *
            <input
              aria-label="قیمت قانونی (تومان)"
              inputMode="numeric"
              dir="rtl"
              value={form.legalCeilingToman}
              onChange={(e) =>
                updateForm("legalCeilingToman", normalizeTomanInput(e.target.value))
              }
              className={fieldClass("legalCeilingToman")}
              aria-invalid={invalidFields.has("legalCeilingToman")}
            />
            <span
              aria-live="polite"
              className="mt-2 block min-h-5 text-[11px] font-medium text-accent"
            >
              {tomanInputWords(form.legalCeilingToman)}
            </span>
          </label>
          <div className="flex items-end gap-2 md:col-span-2">
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={busy}
              className="rounded-lg border border-accent px-4 py-3 text-xs font-black text-accent"
            >
              پیش‌نمایش
            </button>
            <button
              type="submit"
              disabled={busy || !previewIsCurrent}
              className="flex-1 rounded-lg bg-accent px-4 py-3 text-xs font-black text-white disabled:opacity-40"
            >
              ایجاد مسیر و برنامه پروازی فصل
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setPreview(null);
                setPreviewedPayloadKey(null);
                setError(null);
                setInvalidFields(new Set());
              }}
              className="rounded-lg border border-panel-border px-4 py-3 text-xs font-black text-panel-muted"
            >
              انصراف
            </button>
          </div>
          {previewIsCurrent && preview && (
            <div
              ref={previewRef}
              role="status"
              className="md:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-panel-muted"
            >
              <div className="font-black text-emerald-300">
                پیش‌نمایش آماده است
              </div>
              <p className="mt-2">
                این برنامه{" "}
                <b className="text-emerald-300">
                  {faDigits(preview.occurrenceCount)} پرواز
                </b>{" "}
                با ظرفیت{" "}
                <b className="text-panel-ink">
                  {faDigits(preview.capacity)} صندلی
                </b>{" "}
                ایجاد می‌کند.
              </p>
              <p className="mt-1 text-[11px]">
                پس از بررسی، دکمه «ایجاد مسیر» را بزنید.
              </p>
            </div>
          )}
        </form>
      </section>
      )}
      <section className="rounded-xl border border-panel-border bg-panel-surface p-5">
        <div className="mb-4 flex gap-2 rounded-xl border border-panel-border bg-panel-canvas p-1">
          <button
            type="button"
            onClick={() => setRouteTab("active")}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-bold transition ${
              routeTab === "active"
                ? "bg-accent text-white"
                : "text-panel-muted hover:text-panel-ink"
            }`}
          >
            مسیرهای پروازی فعال ({faDigits(activeRoutes.length)})
          </button>
          <button
            type="button"
            onClick={() => setRouteTab("history")}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-bold transition ${
              routeTab === "history"
                ? "bg-accent text-white"
                : "text-panel-muted hover:text-panel-ink"
            }`}
          >
            تاریخچه پرواز ({faDigits(historyRoutes.length)})
          </button>
        </div>
        {items === null ? (
          <p className="py-6 text-center text-xs text-panel-muted">
            در حال بارگذاری…
          </p>
        ) : visibleRoutes.length === 0 ? (
          <p className="py-6 text-center text-xs text-panel-muted">
            {routeTab === "history"
              ? "هنوز هیچ مسیر پروازی به پایان نرسیده است."
              : "هنوز مسیر پروازی فعالی تعریف نشده است."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleRoutes.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-panel-border bg-panel-surface-2 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <b className="text-sm text-panel-ink">
                      {row.originCode ?? "—"} ← {row.destCode ?? "—"}
                    </b>
                    <div
                      dir="ltr"
                      className="mt-1 font-num text-xs text-panel-muted"
                    >
                      {row.flightNoBase} · {row.departureTime}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold ${row.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300"}`}
                  >
                    {row.status === "ACTIVE" ? "فعال" : "غیرفعال"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-panel-muted">
                  <span>
                    {formatJalaliDate(row.startDate)} تا{" "}
                    {formatJalaliDate(row.endDate)}
                  </span>
                  <span>{weekdayLabels(row.weekdays)}</span>
                  <span>{faDigits(row.capacity)} صندلی</span>
                  <span className="rounded-md bg-[#8b5cf624] px-2 py-0.5 font-bold text-[#a78bfa]">
                    وب‌سرویس: {faMoney(row.agencyPriceIrr)} تومان
                  </span>
                  {row.instanceCount != null && (
                    <span className="rounded-md bg-panel-canvas px-2 py-0.5">
                      {faDigits(row.instanceCount)} پرواز ثبت‌شده
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void toggleRouteExpand(row)}
                  className="mt-3 text-xs font-bold text-accent"
                >
                  {expandedRouteId === row.id
                    ? "بستن تاریخ‌های پرواز"
                    : previewBusyId === row.id
                      ? "در حال بارگذاری…"
                      : "مشاهده تاریخ‌های پرواز"}
                </button>
                {expandedRouteId === row.id && routePreviews[row.id] && (
                  <div className="mt-3 rounded-lg border border-panel-border bg-panel-canvas p-3">
                    <div className="mb-2 text-[11px] font-bold text-panel-ink">
                      {faDigits(routePreviews[row.id].occurrenceCount)} پرواز در این بازه
                    </div>
                    <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                      {routePreviews[row.id].dates.slice(0, 24).map((dateRow) => (
                        <span
                          key={dateRow.departureAt}
                          className="rounded-md bg-panel-surface px-2 py-1 font-num text-[10px] text-panel-muted"
                        >
                          {formatJalaliDate(dateRow.localDate)}
                        </span>
                      ))}
                      {routePreviews[row.id].dates.length > 24 && (
                        <span className="text-[10px] text-panel-muted">
                          +{faDigits(routePreviews[row.id].dates.length - 24)} تاریخ دیگر
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {row.status === "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => setDeactivateRow(row)}
                    className="mt-3 text-xs font-bold text-red-300"
                  >
                    غیرفعال‌سازی
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <ConfirmActionDialog
        open={!!deactivateRow}
        title="غیرفعال‌سازی مسیر"
        message="پروازهای آینده بدون رزرو، تعهد یا قفل لغو می‌شوند؛ سوابق و پروازهای متعهد حفظ خواهند شد."
        confirmLabel="غیرفعال کن"
        cancelLabel="انصراف"
        busy={busy}
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateRow(null)}
      />
    </div>
  );
}
