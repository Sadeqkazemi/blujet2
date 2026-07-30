import { useCallback, useEffect, useState } from 'react';
import { analyzeSurveyFlight, fetchSurveyResults } from '../../api/survey';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import type { SurveyResultRow } from '../../types/survey';

/** CEO/SENIOR_MANAGER/BOARD_CHAIR — «نظرسنجی مسافران»: نتایج فقط‌خواندنی
 * به تفکیک پرواز + خلاصهٔ هوش مصنوعی نظرات هر پرواز. پیکربندی نزد مدیر
 * IT است (SurveyConfigPage). */
export default function SurveyResultsPage() {
  const [disabled, setDisabled] = useState(false);
  const [flights, setFlights] = useState<SurveyResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchSurveyResults();
      setDisabled(res.disabled);
      setFlights(res.flights);
    } catch {
      setError('خطا در دریافت نتایج نظرسنجی.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAnalyze(flightInstanceId: string) {
    setLoadingId(flightInstanceId);
    try {
      const { summary } = await analyzeSurveyFlight(flightInstanceId);
      setSummaries((prev) => ({ ...prev, [flightInstanceId]: summary }));
    } catch {
      setError('خطا در دریافت خلاصهٔ هوش مصنوعی.');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-ink">نظرسنجی مسافران</h1>
        <p className="mt-1 text-sm text-muted">
          نتایج نظرسنجی رضایت مسافران پس از پرواز و خلاصهٔ هوش مصنوعی نظرات هر پرواز
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {disabled && (
        <div className="rounded-xl border border-[#f59e0b4d] bg-[#f59e0b14] p-4 text-xs text-ink">
          نظرسنجی پس از پرواز توسط مدیر IT غیرفعال است.
        </div>
      )}

      {!disabled && flights.length === 0 && (
        <div className="rounded-xl border border-border bg-white p-8 text-center text-xs text-muted">
          هنوز نظرسنجی برای هیچ پروازی ثبت نشده است.
        </div>
      )}

      {!disabled && (
        <div className="flex flex-col gap-3">
          {flights.map((f) => (
            <div key={f.flightInstanceId} data-testid="survey-result-row" className="rounded-xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-ink">{f.flightNo}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted">
                    {f.originCityFa} ← {f.destCityFa} · {formatJalaliDate(f.departureAt)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs">
                    <span className="font-num font-black text-[#f59e0b]">{faDigits(f.avgRating)}</span>
                    <span className="text-muted"> / {faDigits(5)} · </span>
                    <span className="font-num font-black text-ink">{faDigits(f.count)}</span>
                    <span className="text-muted"> پاسخ</span>
                  </div>
                  <button
                    onClick={() => void onAnalyze(f.flightInstanceId)}
                    disabled={loadingId === f.flightInstanceId}
                    className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-accent/90 disabled:opacity-60"
                  >
                    {loadingId === f.flightInstanceId ? 'در حال تحلیل…' : 'تحلیل با هوش مصنوعی'}
                  </button>
                </div>
              </div>
              {summaries[f.flightInstanceId] && (
                <p data-testid="survey-ai-summary" className="mt-3 rounded-lg bg-surface p-3 text-xs text-ink">
                  {summaries[f.flightInstanceId]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
