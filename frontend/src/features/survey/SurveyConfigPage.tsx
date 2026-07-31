import { useCallback, useEffect, useState } from 'react';
import {
  addSurveyQuestion,
  fetchSurveyQuestions,
  fetchSurveySettings,
  fetchSurveyStats,
  removeSurveyQuestion,
  updateSurveySettings,
} from '../../api/survey';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { SurveyQuestion, SurveySettings, SurveyStats } from '../../types/survey';

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`امتیاز ${faDigits(rating)} از ${faDigits(5)}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'text-[#fbbf24]' : 'text-border'}>
          ★
        </span>
      ))}
    </span>
  );
}

/** پنل مدیر IT — «نظرسنجی مسافران»: ایجاد/پیکربندی نظرسنجی (فعال‌سازی،
 * فهرست سؤالات) و آمار کلی. نتایج و تحلیل هوش مصنوعی نزد
 * CEO/SENIOR_MANAGER/BOARD_CHAIR است (SurveyResultsPage). */
export default function SurveyConfigPage() {
  const [settings, setSettings] = useState<SurveySettings | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, q, st] = await Promise.all([
        fetchSurveySettings(),
        fetchSurveyQuestions(),
        fetchSurveyStats(),
      ]);
      setSettings(s);
      setQuestions(q);
      setStats(st);
    } catch {
      setError('خطا در دریافت اطلاعات نظرسنجی.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggleEnabled() {
    if (!settings) return;
    try {
      const updated = await updateSurveySettings({ enabled: !settings.enabled });
      setSettings(updated);
    } catch {
      setError('خطا در تغییر وضعیت نظرسنجی.');
    }
  }

  async function onAddQuestion() {
    if (!newQuestion.trim()) return;
    try {
      await addSurveyQuestion(newQuestion.trim());
      setNewQuestion('');
      await load();
    } catch {
      setError('خطا در افزودن سؤال.');
    }
  }

  async function onRemoveQuestion(id: string) {
    try {
      await removeSurveyQuestion(id);
      await load();
    } catch {
      setError('خطا در حذف سؤال.');
    }
  }

  if (!settings) {
    if (error) {
      return (
        <div className="p-8">
          <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>
        </div>
      );
    }
    return <div className="p-8 text-sm text-muted">در حال بارگذاری…</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-ink">نظرسنجی مسافران</h1>
        <p className="mt-1 text-sm text-muted">
          ایجاد و پیکربندی نظرسنجی رضایت پس از پرواز — نتایج نزد مدیران ارشد
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">فعال‌سازی نظرسنجی پس از پرواز</h2>
            <button
              role="switch"
              aria-checked={settings.enabled}
              aria-label="فعال‌سازی نظرسنجی"
              onClick={() => void onToggleEnabled()}
              className={`relative h-6 w-11 rounded-full transition ${settings.enabled ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  settings.enabled ? 'right-0.5' : 'right-[22px]'
                }`}
              />
            </button>
          </div>
          <p className="mb-4 text-[11px] leading-6 text-muted">
            با فعال بودن این گزینه، بعد از هر پرواز تکمیل‌شده، پیامک/ایمیل نظرسنجی برای مسافران
            ارسال می‌شود.
          </p>

          <h3 className="mb-2 text-xs font-bold text-ink">سؤالات نظرسنجی</h3>
          <div className="mb-3 flex flex-col gap-2">
            {questions.length === 0 && (
              <p className="text-xs text-muted">سؤالی تعریف نشده است.</p>
            )}
            {questions.map((q) => (
              <div
                key={q.id}
                data-testid="survey-question-row"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"
              >
                <span className="h-2 w-2 flex-none rounded-full bg-accent" />
                <span className="flex-1 text-ink">{q.label}</span>
                <span className="rounded-full bg-[#fbbf2420] px-2 py-0.5 text-[10px] font-bold text-[#f59e0b]">
                  ★ ۵ ستاره
                </span>
                <button
                  onClick={() => void onRemoveQuestion(q.id)}
                  className="text-[10.5px] font-bold text-muted hover:text-danger"
                  aria-label={`حذف ${q.label}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="متن سؤال جدید…"
              className="flex-1 rounded-lg border border-border p-2.5 text-xs outline-none transition focus:border-accent"
            />
            <button
              onClick={() => void onAddQuestion()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            >
              افزودن سؤال
            </button>
          </div>
          <p className="mt-2 text-[10.5px] text-muted">هر سؤال با پاسخ ۵ ستاره‌ای برای مسافران ارسال می‌شود.</p>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">نتایج جمع‌آوری‌شده</h2>
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-2">پروازهای دارای نظرسنجی</span>
                <span className="font-num font-bold text-ink">{faDigits(stats?.flightsWithSurvey ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">مجموع پاسخ‌ها</span>
                <span className="font-num font-bold text-ink">{faDigits(stats?.totalResponses ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">میانگین امتیاز کلی</span>
                <span className="font-num font-bold text-[#f59e0b]">
                  {faDigits(stats?.avgRating ?? 0)} / {faDigits(5)}
                </span>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-bold text-ink">پاسخ‌های اخیر</h3>
              <div className="flex flex-col gap-2">
                {(stats?.recentResponses.length ?? 0) === 0 && (
                  <p className="text-xs text-muted">پاسخی ثبت نشده است.</p>
                )}
                {stats?.recentResponses.map((r) => (
                  <div
                    key={r.id}
                    data-testid="survey-recent-row"
                    className="rounded-lg border border-border p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-num ltr text-muted">
                        {r.flightNo}
                        {r.route ? ` · ${r.route}` : ''}
                      </span>
                      <StarRating rating={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="mt-2 text-[11px] leading-5 text-muted">{r.comment}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted">{formatJalaliDateTime(r.at)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-white p-4 text-xs leading-6 text-text-2">
            <p>
              نتایج و خلاصهٔ هوش مصنوعی این نظرسنجی برای{' '}
              <strong className="text-ink">رئیس هیئت مدیره</strong>،{' '}
              <strong className="text-ink">مدیر عامل</strong> و{' '}
              <strong className="text-ink">مدیر ارشد</strong> در پنل خودشان نمایش داده می‌شود.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
