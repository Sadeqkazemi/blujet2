import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchCeoPricing,
  fetchCommercialPricing,
  registerProposal,
  runAiAnalysis,
  setLegalRate,
  upsertProposal,
} from '../../api/pricing';
import { faDigits, faMoney, parseTomanToRial } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import Modal from '../../components/Modal';
import type {
  CeoPricingResult,
  CommercialFlightRow,
  CommercialPricingResult,
  PricingProposal,
} from '../../types/pricing';

function routeLabel(p: { flight: { flightNo: string; route: { originCode: string; destCode: string } } }) {
  return `${p.flight.route.originCode} ← ${p.flight.route.destCode}`;
}

function vsCompetitorLabel(proposed: number, competitor: number): string {
  const delta = ((proposed - competitor) / competitor) * 100;
  if (Math.abs(delta) < 1) return 'هم‌تراز رقبا';
  const pct = faDigits(Math.abs(Math.round(delta)));
  return delta < 0 ? `${pct}٪ پایین‌تر از رقبا` : `${pct}٪ بالاتر از رقبا`;
}

/** CEO view — «تعیین قیمت بلیط». */
function CeoPricing() {
  const [data, setData] = useState<CeoPricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [legalInputs, setLegalInputs] = useState<Record<string, string>>({});
  const [factorsOpen, setFactorsOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      setData(await fetchCeoPricing());
    } catch {
      setError('خطا در دریافت پیشنهادهای قیمت.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRunAi() {
    setAiRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runAiAnalysis();
      if (!result.available) {
        setError('سرویس تحلیل هوش مصنوعی در دسترس نیست؛ تأیید قیمت پیشنهادی همچنان ممکن است.');
      } else {
        setNotice('تحلیل کامل هوش مصنوعی (فصل، تعطیلات و رقبا) انجام و پیشنهاد قیمت ارائه شد ✓');
      }
      await load();
    } catch {
      setError('خطا در اجرای تحلیل هوش مصنوعی.');
    } finally {
      setAiRunning(false);
    }
  }

  async function onRegister(p: PricingProposal, source: 'PROPOSED' | 'AI') {
    setError(null);
    try {
      await registerProposal(p.id, source);
      setNotice('قیمت پرواز تأیید و ثبت شد ✓');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت قیمت.');
    }
  }

  async function onSaveLegal(p: PricingProposal) {
    const rial = parseTomanToRial(legalInputs[p.id] ?? '');
    if (rial === null) {
      setError('نرخ قانونی را وارد کنید');
      return;
    }
    try {
      await setLegalRate(p.id, rial);
      setNotice('نرخ قانونی (مصوب) ثبت شد ✓');
      setLegalInputs({ ...legalInputs, [p.id]: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت نرخ قانونی.');
    }
  }

  const pending = data?.pending ?? [];
  const registered = data?.registered ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-ink">تعیین قیمت بلیط</h1>
        <p className="mt-1 text-sm text-muted">
          قیمت پیشنهادی مدیر بازرگانی، تحلیل هوش مصنوعی و تأیید نهایی مدیر عامل برای ثبت قیمت پرواز
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-text-2">
          <span className="rounded-full bg-surface px-3 py-1.5">۱ پیشنهاد مدیر بازرگانی</span>
          <span className="text-muted">←</span>
          <span className="rounded-full bg-surface px-3 py-1.5">۲ تحلیل هوش مصنوعی</span>
          <span className="text-muted">←</span>
          <span className="rounded-full bg-surface px-3 py-1.5">۳ تأیید و ثبت مدیر عامل</span>
        </div>
        <button
          onClick={() => void onRunAi()}
          disabled={aiRunning}
          className="rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#6d28d9] disabled:opacity-60"
        >
          {aiRunning ? 'در حال تحلیل قیمت رقبا…' : 'تحلیل و پیشنهاد قیمت هوش مصنوعی'}
        </button>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-ink">
          در انتظار تأیید مدیر عامل
          <span className="font-num mr-2 rounded-full bg-[#f59e0b1f] px-2.5 py-0.5 text-[11px] text-[#b45309]">
            {faDigits(pending.length)}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-border bg-white py-8 text-center text-sm text-muted">
            قیمت بلیطی در انتظار تأیید نیست.
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-white p-5">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">
                      {routeLabel(p.flightInstance)}{' '}
                      <span className="ltr font-num text-xs text-muted">{p.flightInstance.flight.flightNo}</span>
                    </div>
                    <div className="font-num mt-0.5 text-[11px] text-muted">
                      {formatJalaliDate(p.flightInstance.departureAt)} · ظرفیت {faDigits(p.flightInstance.capacity)} ·
                      چارتری {faDigits(p.flightInstance.charterSeats)} · {p.proposedBy.fullName}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void onRegister(p, 'PROPOSED')}
                      className="rounded-lg bg-[#059669] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#047857]"
                    >
                      تأیید بازرگانی
                    </button>
                    {p.aiSuggestion && (
                      <button
                        onClick={() => void onRegister(p, 'AI')}
                        className="rounded-lg bg-[#7c3aed] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#6d28d9]"
                      >
                        ثبت با AI
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-surface p-3">
                    <div className="text-[10px] text-muted">رقبا</div>
                    <div className="font-num mt-1 text-sm font-black text-ink">{faMoney(p.competitorPriceIrr)} تومان</div>
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <div className="text-[10px] text-muted">پیشنهاد بازرگانی</div>
                    <div className="font-num mt-1 text-sm font-black text-accent">{faMoney(p.proposedPriceIrr)} تومان</div>
                    <div className="mt-0.5 text-[10px] text-muted">{vsCompetitorLabel(p.proposedPriceIrr, p.competitorPriceIrr)}</div>
                  </div>
                  {p.aiSuggestion && (
                    <div className="rounded-lg bg-[#7c3aed0f] p-3">
                      <div className="text-[10px] text-[#6d28d9]">هوش مصنوعی</div>
                      <div className="font-num mt-1 text-sm font-black text-[#6d28d9]">
                        {faMoney(p.aiSuggestion.priceIrr)} تومان
                      </div>
                    </div>
                  )}
                </div>

                {p.aiSuggestion ? (
                  <div className="mt-3 rounded-lg border border-[#7c3aed33] bg-[#7c3aed08] p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                      <span className="text-[#6d28d9]">تحلیل کامل هوش مصنوعی</span>
                      <span className="rounded-full bg-[#7c3aed1a] px-2 py-0.5 text-[#6d28d9]">فصل: {p.aiSuggestion.season}</span>
                      <span className="rounded-full bg-[#7c3aed1a] px-2 py-0.5 text-[#6d28d9]">مناسبت: {p.aiSuggestion.occasion}</span>
                      <span className="font-num rounded-full bg-[#7c3aed1a] px-2 py-0.5 text-[#6d28d9]">
                        اطمینان: {faDigits(Math.round(p.aiSuggestion.confidence * 100))}٪
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-text-2">{p.aiSuggestion.reason}</p>
                    <button
                      onClick={() => setFactorsOpen({ ...factorsOpen, [p.id]: !factorsOpen[p.id] })}
                      className="mt-2 text-[10px] font-bold text-[#6d28d9]"
                    >
                      {factorsOpen[p.id] ? 'بستن جزئیات تحلیل' : 'مشاهدهٔ کامل عوامل تحلیل'}
                    </button>
                    {factorsOpen[p.id] && (
                      <ul className="mt-2 list-disc space-y-1 pr-5 text-[11px] text-text-2">
                        {p.aiSuggestion.factors.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  p.note && (
                    <p className="mt-3 rounded-lg bg-surface p-3 text-[11px] text-text-2">
                      یادداشت مدیر بازرگانی: {p.note}
                    </p>
                  )
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface p-3">
                  <span className="text-[11px] font-bold text-ink">نرخ قانونی (مصوب سازمان هواپیمایی)</span>
                  <input
                    dir="ltr"
                    value={legalInputs[p.id] ?? ''}
                    onChange={(e) => setLegalInputs({ ...legalInputs, [p.id]: e.target.value })}
                    placeholder="مبلغ به تومان"
                    className="font-num h-9 w-40 rounded-lg border border-border bg-white px-3 text-xs outline-none transition focus:border-accent"
                  />
                  <button
                    onClick={() => void onSaveLegal(p)}
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
                  >
                    ثبت نرخ قانونی
                  </button>
                  {p.legalRateIrr && (
                    <span className="font-num text-[11px] text-muted">
                      ثبت‌شده: {faMoney(p.legalRateIrr)} تومان
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">
          قیمت‌های ثبت‌شده
          <span className="font-num mr-2 rounded-full bg-[#10b9811f] px-2.5 py-0.5 text-[11px] text-[#059669]">
            {faDigits(registered.length)}
          </span>
        </h2>
        {registered.length === 0 ? (
          <p className="rounded-xl border border-border bg-white py-6 text-center text-xs text-muted">
            هنوز قیمتی ثبت نشده است.
          </p>
        ) : (
          <div className="space-y-3">
            {registered.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">
                    {routeLabel(p.flightInstance)}{' '}
                    <span className="ltr font-num text-xs text-muted">{p.flightInstance.flight.flightNo}</span>
                  </div>
                  <div className="font-num mt-0.5 text-[11px] text-muted">
                    پیشنهاد بازرگانی: {faMoney(p.proposedPriceIrr)} تومان
                    {p.legalRateIrr ? ` · نرخ قانونی: ${faMoney(p.legalRateIrr)} تومان` : ''}
                  </div>
                </div>
                <span className="rounded-full bg-surface px-3 py-1 text-[10px] font-bold text-muted">قفل‌شده</span>
                <div className="text-left">
                  <div className="text-[10px] text-muted">قیمت ثبت‌شدهٔ پرواز</div>
                  <div className="font-num text-sm font-black text-[#059669]">
                    {faMoney(p.registeredPriceIrr ?? p.proposedPriceIrr)} تومان
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Commercial Manager view — pricing list + set-price modal. */
function CommercialPricing() {
  const [data, setData] = useState<CommercialPricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<CommercialFlightRow | null>(null);
  const [proposedInput, setProposedInput] = useState('');
  const [legalInput, setLegalInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchCommercialPricing());
    } catch {
      setError('خطا در دریافت فهرست قیمت‌گذاری.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function statusOf(row: CommercialFlightRow): { label: string; className: string; btn: string } {
    if (row.pricing?.status === 'REGISTERED')
      return { label: 'تأییدشده و قفل‌شده', className: 'bg-[#10b98124] text-[#059669]', btn: 'قفل‌شده' };
    if (row.pricing)
      return { label: 'در انتظار تأیید مدیر عامل', className: 'bg-[#a78bfa2e] text-[#6d28d9]', btn: 'ویرایش پیشنهاد' };
    return { label: 'قیمت‌گذاری نشده', className: 'bg-surface text-muted', btn: 'تعیین قیمت' };
  }

  function openModal(row: CommercialFlightRow) {
    setSelected(row);
    setModalError(null);
    setProposedInput('');
    setLegalInput('');
    setNoteInput(row.pricing?.note ?? '');
  }

  async function onSubmit() {
    if (!selected) return;
    const rial = parseTomanToRial(proposedInput);
    if (rial === null) {
      setModalError('نرخ پیشنهادی را وارد کنید');
      return;
    }
    const legalRial = legalInput.trim() ? parseTomanToRial(legalInput) : undefined;
    if (legalInput.trim() && legalRial === null) {
      setModalError('نرخ قانونی معتبر نیست.');
      return;
    }
    try {
      await upsertProposal(selected.id, {
        proposedPriceIrr: rial,
        legalRateIrr: legalRial ?? undefined,
        note: noteInput.trim() || undefined,
      });
      setNotice('نرخ پیشنهادی برای تأیید به مدیر عامل ارسال شد ✓');
      setSelected(null);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'خطا در ارسال پیشنهاد.');
    }
  }

  const flights = data?.flights ?? [];
  const locked = selected?.pricing?.status === 'REGISTERED';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-ink">تعیین قیمت پرواز و ارسال به مدیر عامل</h1>
        <p className="mt-1 text-sm text-muted">
          نرخ پیشنهادی و نرخ قانونی هر پرواز را تعیین کنید؛ پس از تأیید مدیر عامل، قیمت ثبت و قفل می‌شود و قابل
          تغییر نخواهد بود.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      {flights.length === 0 ? (
        <p className="rounded-xl border border-border bg-white py-8 text-center text-sm text-muted">
          پرواز برنامه‌ریزی‌شده‌ای وجود ندارد.
        </p>
      ) : (
        <ul className="space-y-3">
          {flights.map((row) => {
            const st = statusOf(row);
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">
                    {routeLabel(row)} <span className="ltr font-num text-xs text-muted">{row.flight.flightNo}</span>
                  </div>
                  <div className="font-num mt-0.5 text-[11px] text-muted">تاریخ {formatJalaliDate(row.departureAt)}</div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-muted">نرخ پیشنهادی</div>
                  <div className="font-num text-xs font-black text-ink">
                    {row.pricing ? `${faMoney(row.pricing.proposedPriceIrr)} تومان` : '—'}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-muted">نرخ قانونی</div>
                  <div className="font-num text-xs font-black text-ink">
                    {row.pricing?.legalRateIrr ? `${faMoney(row.pricing.legalRateIrr)} تومان` : '—'}
                  </div>
                </div>
                {row.pricing?.status === 'REGISTERED' && (
                  <div className="text-left">
                    <div className="text-[10px] text-muted">قیمت قفل‌شده</div>
                    <div className="font-num text-xs font-black text-[#059669]">
                      {faMoney(row.pricing.registeredPriceIrr ?? 0)} تومان
                    </div>
                  </div>
                )}
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                <button
                  onClick={() => openModal(row)}
                  disabled={st.btn === 'قفل‌شده'}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    st.btn === 'قفل‌شده'
                      ? 'cursor-default bg-surface text-muted'
                      : 'bg-accent text-white hover:bg-accent/90'
                  }`}
                >
                  {st.btn}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <Modal title={`تعیین قیمت پرواز — ${routeLabel(selected)}`} onClose={() => setSelected(null)}>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface p-3">
              <div className="text-[10px] text-muted">قیمت پایهٔ شرکت</div>
              <div className="font-num mt-1 text-xs font-black text-ink">
                {selected.pricing ? `${faMoney(selected.pricing.basePriceIrr)} تومان` : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <div className="text-[10px] text-muted">قیمت رقبا</div>
              <div className="font-num mt-1 text-xs font-black text-ink">
                {selected.pricing ? `${faMoney(selected.pricing.competitorPriceIrr)} تومان` : '—'}
              </div>
            </div>
          </div>

          {locked ? (
            <div className="rounded-lg bg-[#10b98115] p-4 text-center">
              <p className="text-xs font-bold text-[#059669]">قیمت این پرواز توسط مدیر عامل تأیید و قفل شده است</p>
              <p className="font-num mt-2 text-lg font-black text-ink">
                {faMoney(selected.pricing?.registeredPriceIrr ?? 0)} تومان
              </p>
              {selected.pricing?.legalRateIrr && (
                <p className="font-num mt-1 text-[11px] text-muted">
                  نرخ قانونی ثبت‌شده: {faMoney(selected.pricing.legalRateIrr)} تومان
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted">این قیمت دیگر قابل تغییر نیست.</p>
            </div>
          ) : (
            <>
              {selected.pricing && (
                <p className="mb-3 rounded-lg bg-[#a78bfa1a] p-3 text-[11px] text-[#6d28d9]">
                  این پیشنهاد در انتظار تأیید مدیر عامل است؛ می‌توانید تا زمان تأیید آن را ویرایش کنید.
                </p>
              )}
              <label className="mb-1 block text-xs font-bold text-ink" htmlFor="proposed-input">
                نرخ پیشنهادی (تومان)
              </label>
              <input
                id="proposed-input"
                dir="ltr"
                value={proposedInput}
                onChange={(e) => setProposedInput(e.target.value)}
                placeholder="مثلاً ۳۸۵۰۰۰۰"
                className="font-num w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
              />
              <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="legal-input">
                نرخ قانونی / مصوب سازمان هواپیمایی (تومان)
              </label>
              <input
                id="legal-input"
                dir="ltr"
                value={legalInput}
                onChange={(e) => setLegalInput(e.target.value)}
                placeholder="سقف نرخ مصوب"
                className="font-num w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
              />
              <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="note-input">
                یادداشت برای مدیر عامل (اختیاری)
              </label>
              <textarea
                id="note-input"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="توضیح دلیل قیمت پیشنهادی…"
                rows={2}
                className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
              />
              {modalError && (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {modalError}
                </p>
              )}
              <button
                onClick={() => void onSubmit()}
                className="mt-4 w-full rounded-lg bg-accent py-2.5 text-xs font-bold text-white transition hover:bg-accent/90"
              >
                ارسال نرخ پیشنهادی برای تأیید مدیر عامل
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

export default function PricingPage() {
  const { user } = useAuth();
  return user?.role === 'COMMERCIAL_MANAGER' ? <CommercialPricing /> : <CeoPricing />;
}
