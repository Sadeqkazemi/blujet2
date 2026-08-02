import { useCallback, useEffect, useState } from 'react';
import { analyzeSurveyFlight, fetchSurveyResults } from '../../api/survey';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import PanelAlert from '../panel/PanelAlert';
import {
  panelAlertWarning,
  panelBtnPrimary,
  panelCard,
  panelMuted,
  panelMuted2,
  panelTitle,
} from '../panel/panel-theme';
import type { SurveyResultRow } from '../../types/survey';

function RatingStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex justify-end gap-0.5" aria-label={`امتیاز ${faDigits(rating)} از ۵`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="text-sm leading-none"
          style={{ color: i <= rounded ? '#f59e0b' : '#3a4a63' }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

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
    <div className="flex flex-col gap-3">
      {error && <PanelAlert className="mb-0">{error}</PanelAlert>}

      {disabled && (
        <div className={panelAlertWarning}>نظرسنجی پس از پرواز توسط مدیر IT غیرفعال است.</div>
      )}

      {!disabled && flights.length === 0 && (
        <div className={`${panelCard} px-8 py-9 text-center text-xs ${panelMuted}`}>
          هنوز نظرسنجی برای هیچ پروازی ثبت نشده است.
        </div>
      )}

      {!disabled &&
        flights.map((f) => (
          <div key={f.flightInstanceId} data-testid="survey-result-row" className={`${panelCard} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className={panelTitle}>{f.flightNo}</div>
                <div className={`mt-0.5 text-[10.5px] ${panelMuted}`}>
                  {f.originCityFa} ← {f.destCityFa} · {formatJalaliDate(f.departureAt)}
                </div>
              </div>
              <div className="text-center">
                <RatingStars rating={f.avgRating} />
                <div className={`mt-0.5 text-[10px] ${panelMuted}`}>
                  <span className="font-num font-black text-[#f59e0b]">{faDigits(f.avgRating)}</span>
                  {' از '}
                  {faDigits(5)}
                  {' · '}
                  <span className="font-num font-black text-white">{faDigits(f.count)}</span> پاسخ
                </div>
              </div>
            </div>

            {summaries[f.flightInstanceId] && (
              <div
                data-testid="survey-ai-summary"
                className="mt-3 flex items-start gap-2 rounded-[11px] border border-[rgba(59,130,246,.25)] bg-[rgba(59,130,246,.08)] p-3"
              >
                <span className="text-sm">✨</span>
                <p className={`text-xs leading-relaxed ${panelMuted2}`}>{summaries[f.flightInstanceId]}</p>
              </div>
            )}

            <div className="mt-3">
              {loadingId === f.flightInstanceId ? (
                <span className={`inline-flex items-center gap-2 text-[11.5px] font-bold ${panelMuted2}`}>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-panel-border-2 border-t-panel-accent" />
                  در حال تحلیل نظرات…
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void onAnalyze(f.flightInstanceId)}
                  className={panelBtnPrimary}
                >
                  ✨ تحلیل با هوش مصنوعی
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
