import { useCallback, useEffect, useState } from 'react';
import {
  createExternalService,
  fetchItServices,
  fetchSmsLog,
  removeExternalService,
  testExternalService,
  toggleInternalService,
  updateExternalService,
} from '../../api/it-manager';
import { faDigits, faPercent } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import type { ExternalService, InternalService, SmsLogResult } from '../../types/it-manager';

const SMS_MESSAGE_TYPE_LABEL: Record<string, string> = {
  OTP: 'کد یکبار مصرف',
  TEMP_PASSWORD: 'رمز موقت',
};

export default function ServicesPage() {
  const [internal, setInternal] = useState<InternalService[]>([]);
  const [external, setExternal] = useState<ExternalService[]>([]);
  const [smsLog, setSmsLog] = useState<SmsLogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState({ nameFa: '', provider: '', endpoint: '', apiKey: '' });

  const [editTarget, setEditTarget] = useState<ExternalService | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nameFa: '',
    endpoint: '',
    method: 'POST' as 'GET' | 'POST',
    timeoutMs: '',
    apiKey: '',
  });

  const load = useCallback(async () => {
    try {
      const data = await fetchItServices();
      setInternal(data.internal);
      setExternal(data.external);
    } catch {
      setError('خطا در دریافت سرویس‌ها.');
    }
    try {
      setSmsLog(await fetchSmsLog());
    } catch {
      setSmsLog(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggleInternal(s: InternalService) {
    try {
      await toggleInternalService(s.key, !s.enabled);
      await load();
    } catch {
      setError('خطا در تغییر وضعیت سرویس.');
    }
  }

  async function onTest(s: ExternalService) {
    try {
      const result = await testExternalService(s.id);
      setTestResult({ id: s.id, ok: result.ok, message: result.message });
      await load();
    } catch {
      setError('خطا در تست اتصال.');
    }
  }

  function onOpenSettings(s: ExternalService) {
    setEditTarget(s);
    setEditError(null);
    setEditForm({
      nameFa: s.nameFa,
      endpoint: s.endpoint,
      method: s.method,
      timeoutMs: String(s.timeoutMs),
      apiKey: '',
    });
  }

  async function onSaveSettings() {
    if (!editTarget) return;
    if (!editForm.nameFa.trim() || !editForm.endpoint.trim()) {
      setEditError('نام سرویس و آدرس Endpoint الزامی است.');
      return;
    }
    const timeoutMs = Number(editForm.timeoutMs);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
      setEditError('مهلت اتصال باید بین ۱۰۰۰ تا ۱۲۰۰۰۰ میلی‌ثانیه باشد.');
      return;
    }
    try {
      await updateExternalService(editTarget.id, {
        nameFa: editForm.nameFa.trim(),
        endpoint: editForm.endpoint.trim(),
        method: editForm.method,
        timeoutMs,
        ...(editForm.apiKey.trim() ? { apiKey: editForm.apiKey.trim() } : {}),
      });
      setEditTarget(null);
      await load();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'خطا در ثبت تنظیمات سرویس.');
    }
  }

  async function onRemove(s: ExternalService) {
    try {
      await removeExternalService(s.id);
      await load();
    } catch {
      setError('خطا در حذف سرویس.');
    }
  }

  async function onCreate() {
    if (!form.nameFa.trim() || !form.endpoint.trim()) {
      setAddError('نام سرویس و آدرس Endpoint الزامی است.');
      return;
    }
    try {
      await createExternalService({
        nameFa: form.nameFa.trim(),
        provider: form.provider.trim() || form.nameFa.trim(),
        endpoint: form.endpoint.trim(),
        apiKey: form.apiKey.trim() || undefined,
      });
      setAddOpen(false);
      setForm({ nameFa: '', provider: '', endpoint: '', apiKey: '' });
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'خطا در ثبت سرویس خارجی.');
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">سرویس‌های سایت</h1>
          <p className="mt-1 text-sm text-muted">وضعیت و کنترل تمام سرویس‌های فعال در سایت</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span>
            <span className="font-num font-black text-[#059669]">
              {faDigits(internal.filter((s) => s.enabled).length + external.filter((s) => s.enabled).length)}
            </span>{' '}
            <span className="text-muted">سرویس فعال</span>
          </span>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <h2 className="mb-3 text-sm font-bold text-ink">سرویس‌های داخلی سایت</h2>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {internal.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-white p-3">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-ink">{s.nameFa}</div>
                <div className="mt-0.5 text-[10px] text-muted">آپ‌تایم {faPercent(s.uptimePct)}</div>
              </div>
              <button
                role="switch"
                aria-checked={s.enabled}
                aria-label={s.nameFa}
                onClick={() => void onToggleInternal(s)}
                className={`relative h-6 w-11 rounded-full transition ${s.enabled ? 'bg-accent' : 'bg-border'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    s.enabled ? 'right-0.5' : 'right-[22px]'
                  }`}
                />
              </button>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                s.enabled ? 'bg-[#10b98124] text-[#059669]' : 'bg-danger/15 text-danger'
              }`}
            >
              {s.enabled ? 'فعال' : 'غیرفعال'}
            </span>
          </div>
        ))}
      </div>

      {smsLog && (
        <div className="mb-8 rounded-xl border border-border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">سامانه پیامک (SMS)</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                smsLog.enabled ? 'bg-[#10b98124] text-[#059669]' : 'bg-danger/15 text-danger'
              }`}
            >
              {smsLog.enabled ? 'فعال' : 'غیرفعال'}
            </span>
          </div>
          <div className="mb-4 flex gap-6 text-xs">
            <div>
              <span className="font-num font-black text-[#059669]">{faDigits(smsLog.todaySuccessCount)}</span>{' '}
              <span className="text-muted">ارسال موفق امروز</span>
            </div>
            <div>
              <span className="font-num font-black text-danger">{faDigits(smsLog.todayFailedCount)}</span>{' '}
              <span className="text-muted">ارسال ناموفق امروز</span>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-border/60">
            {smsLog.recent.length === 0 && (
              <p className="py-2 text-xs text-muted">پیامکی ثبت نشده است.</p>
            )}
            {smsLog.recent.map((r) => (
              <div key={r.id} data-testid="sms-log-row" className="flex items-center gap-3 py-2 text-xs">
                <div className="ltr font-num min-w-[110px] text-muted">{r.phoneMasked}</div>
                <div className="min-w-[110px] text-ink">{SMS_MESSAGE_TYPE_LABEL[r.messageType] ?? r.messageType}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    r.status === 'SUCCESS' ? 'bg-[#10b98124] text-[#059669]' : 'bg-danger/15 text-danger'
                  }`}
                >
                  {r.status === 'SUCCESS' ? 'موفق' : 'ناموفق'}
                </span>
                {r.failureReason && <span className="text-[10.5px] text-danger">{r.failureReason}</span>}
                <span className="mr-auto text-[10.5px] text-muted">{formatJalaliDateTime(r.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">سرویس‌های خارجی (API)</h2>
        <button
          onClick={() => {
            setAddError(null);
            setAddOpen(true);
          }}
          className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-accent/90"
        >
          افزودن سرویس خارجی
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {external.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-white p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-ink">{s.nameFa}</div>
                <div className="mt-0.5 text-[10px] text-muted">{s.provider}</div>
              </div>
            </div>
            <div className="ltr mb-2 truncate rounded-md bg-surface px-2 py-1 text-[10px] text-muted">{s.endpoint}</div>
            {testResult?.id === s.id && (
              <div className={`mb-2 rounded-md p-1.5 text-[10px] ${testResult.ok ? 'bg-[#10b98115] text-[#059669]' : 'bg-danger/10 text-danger'}`}>
                {testResult.message}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  s.enabled ? 'bg-[#10b98124] text-[#059669]' : 'bg-danger/15 text-danger'
                }`}
              >
                {s.enabled ? 'فعال' : 'غیرفعال'}
              </span>
              <div className="flex gap-2">
                <button onClick={() => onOpenSettings(s)} className="text-[10.5px] font-bold text-accent">
                  تنظیمات
                </button>
                <button onClick={() => void onTest(s)} className="text-[10.5px] font-bold text-accent">
                  تست اتصال
                </button>
                <button onClick={() => void onRemove(s)} className="text-[10.5px] font-bold text-danger">
                  حذف
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {addOpen && (
        <Modal title="تعریف سرویس خارجی جدید" onClose={() => setAddOpen(false)}>
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="svc-name">
            نام سرویس
          </label>
          <input
            id="svc-name"
            value={form.nameFa}
            onChange={(e) => setForm({ ...form, nameFa: e.target.value })}
            className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="svc-endpoint">
            آدرس Endpoint
          </label>
          <input
            id="svc-endpoint"
            dir="ltr"
            value={form.endpoint}
            onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
            placeholder="https://api.provider.com/v1/"
            className="ltr w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="svc-key">
            کلید احراز (API Key)
          </label>
          <input
            id="svc-key"
            dir="ltr"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            className="ltr w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          {addError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {addError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
              انصراف
            </button>
            <button
              onClick={() => void onCreate()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            >
              ثبت و اتصال سرویس
            </button>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal title="تنظیمات سرویس" onClose={() => setEditTarget(null)}>
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="edit-svc-name">
            نام سرویس
          </label>
          <input
            id="edit-svc-name"
            value={editForm.nameFa}
            onChange={(e) => setEditForm({ ...editForm, nameFa: e.target.value })}
            className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="edit-svc-endpoint">
            آدرس Endpoint
          </label>
          <input
            id="edit-svc-endpoint"
            dir="ltr"
            value={editForm.endpoint}
            onChange={(e) => setEditForm({ ...editForm, endpoint: e.target.value })}
            className="ltr w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink" htmlFor="edit-svc-method">
                متد
              </label>
              <select
                id="edit-svc-method"
                dir="ltr"
                value={editForm.method}
                onChange={(e) => setEditForm({ ...editForm, method: e.target.value as 'GET' | 'POST' })}
                className="ltr w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink" htmlFor="edit-svc-timeout">
                مهلت اتصال (میلی‌ثانیه)
              </label>
              <input
                id="edit-svc-timeout"
                dir="ltr"
                inputMode="numeric"
                value={editForm.timeoutMs}
                onChange={(e) => setEditForm({ ...editForm, timeoutMs: e.target.value })}
                className="ltr w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
              />
            </div>
          </div>
          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="edit-svc-key">
            کلید احراز (API Key)
          </label>
          <input
            id="edit-svc-key"
            dir="ltr"
            value={editForm.apiKey}
            onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
            placeholder={editTarget.hasApiKey ? 'برای تغییر وارد کنید — خالی یعنی بدون تغییر' : '—'}
            className="ltr w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent placeholder:text-[10px]"
          />
          {editError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {editError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditTarget(null)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
              انصراف
            </button>
            <button
              onClick={() => void onSaveSettings()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            >
              ثبت تغییرات
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
