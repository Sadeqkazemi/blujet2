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

      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-white p-4">
        <div>
          <div className="text-sm font-bold text-ink">{settings.title}</div>
          <div className="mt-0.5 text-[10.5px] text-muted">
            {settings.enabled ? 'نظرسنجی برای مسافران فعال است' : 'نظرسنجی غیرفعال است'}
          </div>
        </div>
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[10.5px] text-muted">پروازهای دارای نظرسنجی</div>
          <div className="font-num mt-1 text-lg font-black text-ink">
            {faDigits(stats?.flightsWithSurvey ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[10.5px] text-muted">مجموع پاسخ‌ها</div>
          <div className="font-num mt-1 text-lg font-black text-ink">
            {faDigits(stats?.totalResponses ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[10.5px] text-muted">میانگین امتیاز کلی</div>
          <div className="font-num mt-1 text-lg font-black text-[#f59e0b]">
            {faDigits(stats?.avgRating ?? 0)} / {faDigits(5)}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">سؤالات نظرسنجی</h2>
        <div className="mb-3 flex flex-col gap-2">
          {questions.length === 0 && (
            <p className="text-xs text-muted">سؤالی تعریف نشده است.</p>
          )}
          {questions.map((q) => (
            <div
              key={q.id}
              data-testid="survey-question-row"
              className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs text-ink"
            >
              <span>{q.label}</span>
              <button
                onClick={() => void onRemoveQuestion(q.id)}
                className="text-[10.5px] font-bold text-danger"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="سؤال جدید…"
            className="flex-1 rounded-lg border border-border p-2.5 text-xs outline-none transition focus:border-accent"
          />
          <button
            onClick={() => void onAddQuestion()}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
          >
            افزودن
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">آخرین پاسخ‌ها</h2>
        <div className="flex flex-col divide-y divide-border/60">
          {(stats?.recentResponses.length ?? 0) === 0 && (
            <p className="py-2 text-xs text-muted">پاسخی ثبت نشده است.</p>
          )}
          {stats?.recentResponses.map((r) => (
            <div key={r.id} data-testid="survey-recent-row" className="flex items-center gap-3 py-2 text-xs">
              <div className="min-w-[70px] font-bold text-ink">{r.flightNo}</div>
              <div className="font-num text-[#f59e0b]">{faDigits(r.rating)}/{faDigits(5)}</div>
              {r.comment && <div className="flex-1 truncate text-muted">{r.comment}</div>}
              <span className="mr-auto text-[10.5px] text-muted">{formatJalaliDateTime(r.at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
