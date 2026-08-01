import type { CSSProperties } from 'react';
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
import {
  StaffAlert,
  StaffCountPill,
  StaffPanelCard,
  StaffPanelPageHeader,
  StaffPrimaryButton,
  StaffSecondaryButton,
  StaffToggle,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { staffInnerTile, staffInput, staffStatusStyle } from '../../lib/staff-panel-styles';
import type { ExternalService, InternalService, SmsLogResult } from '../../types/it-manager';

const SMS_MESSAGE_TYPE_LABEL: Record<string, string> = {
  OTP: 'کد یکبار مصرف',
  TEMP_PASSWORD: 'رمز موقت',
};

const inputStyle: CSSProperties = {
  ...staffInput,
  width: '100%',
  padding: 12,
  fontSize: 12,
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 800,
  fontSize: 12,
  color: STAFF_PANEL.text,
};

const serviceCardStyle: CSSProperties = {
  background: STAFF_PANEL.cardBg,
  border: `1px solid ${STAFF_PANEL.cardBorder}`,
  borderRadius: 14,
  padding: 12,
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

  const [confirmTarget, setConfirmTarget] = useState<
    { kind: 'internal'; service: InternalService } | { kind: 'external'; service: ExternalService } | null
  >(null);

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
    setConfirmTarget({ kind: 'internal', service: s });
  }

  async function confirmToggleInternal() {
    if (!confirmTarget || confirmTarget.kind !== 'internal') return;
    const s = confirmTarget.service;
    try {
      await toggleInternalService(s.key, !s.enabled);
      setConfirmTarget(null);
      await load();
    } catch {
      setError('خطا در تغییر وضعیت سرویس.');
    }
  }

  async function onToggleExternal(s: ExternalService) {
    setConfirmTarget({ kind: 'external', service: s });
  }

  async function confirmToggleExternal() {
    if (!confirmTarget || confirmTarget.kind !== 'external') return;
    const s = confirmTarget.service;
    try {
      await updateExternalService(s.id, { enabled: !s.enabled });
      setConfirmTarget(null);
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

  const activeCount = internal.filter((s) => s.enabled).length + external.filter((s) => s.enabled).length;
  const totalCount = internal.length + external.length;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StaffPanelPageHeader
          title="سرویس‌های سایت"
          subtitle="وضعیت و کنترل تمام سرویس‌های فعال در سایت"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 11 }}>
          <StaffCountPill>
            <span style={{ fontWeight: 900, color: STAFF_PANEL.success }}>{faDigits(activeCount)}</span>{' '}
            <span style={{ color: STAFF_PANEL.textMuted }}>سرویس فعال</span>
          </StaffCountPill>
          <StaffCountPill>
            <span style={{ fontWeight: 900, color: STAFF_PANEL.text }}>{faDigits(totalCount)}</span>{' '}
            <span style={{ color: STAFF_PANEL.textMuted }}>کل سرویس‌ها</span>
          </StaffCountPill>
        </div>
      </div>

      {error && <StaffAlert tone="error">{error}</StaffAlert>}

      <h2 style={{ marginBottom: 12, fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>سرویس‌های داخلی سایت</h2>
      <div
        style={{
          marginBottom: 32,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {internal.map((s) => (
          <div key={s.id} style={serviceCardStyle}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: STAFF_PANEL.text }}>{s.nameFa}</div>
                <div style={{ marginTop: 2, fontSize: 10, color: STAFF_PANEL.textMuted }}>آپ‌تایم {faPercent(s.uptimePct)}</div>
              </div>
              <StaffToggle checked={s.enabled} onChange={() => void onToggleInternal(s)} label={s.nameFa} />
            </div>
            <span style={staffStatusStyle(s.enabled ? 'success' : 'danger')}>{s.enabled ? 'فعال' : 'غیرفعال'}</span>
          </div>
        ))}
      </div>

      {smsLog && (
        <StaffPanelCard
          title="سامانه پیامک (SMS)"
          style={{ marginBottom: 32 }}
          headerAction={
            <span style={staffStatusStyle(smsLog.enabled ? 'success' : 'danger')}>
              {smsLog.enabled ? 'فعال' : 'غیرفعال'}
            </span>
          }
        >
          <div style={{ marginBottom: 16, display: 'flex', gap: 24, fontSize: 11 }}>
            <div>
              <span style={{ fontWeight: 900, color: STAFF_PANEL.success }}>{faDigits(smsLog.todaySuccessCount)}</span>{' '}
              <span style={{ color: STAFF_PANEL.textMuted }}>ارسال موفق امروز</span>
            </div>
            <div>
              <span style={{ fontWeight: 900, color: STAFF_PANEL.danger }}>{faDigits(smsLog.todayFailedCount)}</span>{' '}
              <span style={{ color: STAFF_PANEL.textMuted }}>ارسال ناموفق امروز</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {smsLog.recent.length === 0 && (
              <p style={{ padding: '8px 0', fontSize: 11, color: STAFF_PANEL.textMuted, margin: 0 }}>
                پیامکی ثبت نشده است.
              </p>
            )}
            {smsLog.recent.map((r, idx) => (
              <div
                key={r.id}
                data-testid="sms-log-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  fontSize: 11,
                  borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
                }}
              >
                <div style={{ direction: 'ltr', minWidth: 110, color: STAFF_PANEL.textMuted }}>{r.phoneMasked}</div>
                <div style={{ minWidth: 110, color: STAFF_PANEL.text }}>
                  {SMS_MESSAGE_TYPE_LABEL[r.messageType] ?? r.messageType}
                </div>
                <span style={staffStatusStyle(r.status === 'SUCCESS' ? 'success' : 'danger')}>
                  {r.status === 'SUCCESS' ? 'موفق' : 'ناموفق'}
                </span>
                {r.failureReason && (
                  <span style={{ fontSize: 10.5, color: STAFF_PANEL.danger }}>{r.failureReason}</span>
                )}
                <span style={{ marginRight: 'auto', fontSize: 10.5, color: STAFF_PANEL.textMuted }}>
                  {formatJalaliDateTime(r.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </StaffPanelCard>
      )}

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text, margin: 0 }}>سرویس‌های خارجی (API)</h2>
        <StaffPrimaryButton
          onClick={() => {
            setAddError(null);
            setAddOpen(true);
          }}
          style={{ padding: '6px 12px', fontSize: 11 }}
        >
          افزودن سرویس خارجی
        </StaffPrimaryButton>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {external.map((s) => (
          <div key={s.id} style={serviceCardStyle}>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: STAFF_PANEL.text }}>{s.nameFa}</div>
                <div style={{ marginTop: 2, fontSize: 10, color: STAFF_PANEL.textMuted }}>{s.provider}</div>
              </div>
              <StaffToggle checked={s.enabled} onChange={() => onToggleExternal(s)} label={s.nameFa} />
            </div>
            <div
              style={{
                ...staffInnerTile,
                marginBottom: 8,
                direction: 'ltr',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 10,
                color: STAFF_PANEL.textMuted,
              }}
            >
              {s.endpoint}
            </div>
            {testResult?.id === s.id && (
              <div
                style={{
                  marginBottom: 8,
                  borderRadius: 8,
                  padding: 6,
                  fontSize: 10,
                  ...(testResult.ok
                    ? { background: 'rgba(52,211,153,0.12)', color: STAFF_PANEL.success }
                    : { background: 'rgba(248,113,113,0.12)', color: STAFF_PANEL.danger }),
                }}
              >
                {testResult.message}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={staffStatusStyle(s.enabled ? 'success' : 'danger')}>{s.enabled ? 'فعال' : 'غیرفعال'}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onOpenSettings(s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: STAFF_PANEL.link,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  تنظیمات
                </button>
                <button
                  type="button"
                  onClick={() => void onTest(s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: STAFF_PANEL.link,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  تست اتصال
                </button>
                <button
                  type="button"
                  onClick={() => void onRemove(s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: STAFF_PANEL.danger,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  حذف
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {addOpen && (
        <Modal dark title="تعریف سرویس خارجی جدید" onClose={() => setAddOpen(false)}>
          <label style={labelStyle} htmlFor="svc-name">
            نام سرویس
          </label>
          <input
            id="svc-name"
            value={form.nameFa}
            onChange={(e) => setForm({ ...form, nameFa: e.target.value })}
            style={inputStyle}
          />
          <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="svc-endpoint">
            آدرس Endpoint
          </label>
          <input
            id="svc-endpoint"
            dir="ltr"
            value={form.endpoint}
            onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
            placeholder="https://api.provider.com/v1/"
            style={inputStyle}
          />
          <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="svc-key">
            کلید احراز (API Key)
          </label>
          <input
            id="svc-key"
            dir="ltr"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            style={inputStyle}
          />
          {addError && (
            <p role="alert" style={{ marginTop: 8, fontSize: 11, color: STAFF_PANEL.danger }}>
              {addError}
            </p>
          )}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <StaffSecondaryButton onClick={() => setAddOpen(false)}>انصراف</StaffSecondaryButton>
            <StaffPrimaryButton onClick={() => void onCreate()}>ثبت و اتصال سرویس</StaffPrimaryButton>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal dark title="تنظیمات سرویس" onClose={() => setEditTarget(null)}>
          <label style={labelStyle} htmlFor="edit-svc-name">
            نام سرویس
          </label>
          <input
            id="edit-svc-name"
            value={editForm.nameFa}
            onChange={(e) => setEditForm({ ...editForm, nameFa: e.target.value })}
            style={inputStyle}
          />
          <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="edit-svc-endpoint">
            آدرس Endpoint
          </label>
          <input
            id="edit-svc-endpoint"
            dir="ltr"
            value={editForm.endpoint}
            onChange={(e) => setEditForm({ ...editForm, endpoint: e.target.value })}
            style={inputStyle}
          />
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="edit-svc-method">
                متد
              </label>
              <select
                id="edit-svc-method"
                dir="ltr"
                value={editForm.method}
                onChange={(e) => setEditForm({ ...editForm, method: e.target.value as 'GET' | 'POST' })}
                style={inputStyle}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="edit-svc-timeout">
                مهلت اتصال (میلی‌ثانیه)
              </label>
              <input
                id="edit-svc-timeout"
                dir="ltr"
                inputMode="numeric"
                value={editForm.timeoutMs}
                onChange={(e) => setEditForm({ ...editForm, timeoutMs: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>
          <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="edit-svc-key">
            کلید احراز (API Key)
          </label>
          <input
            id="edit-svc-key"
            dir="ltr"
            value={editForm.apiKey}
            onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
            placeholder={editTarget.hasApiKey ? 'برای تغییر وارد کنید — خالی یعنی بدون تغییر' : '—'}
            style={{ ...inputStyle, fontSize: 11 }}
          />
          {editError && (
            <p role="alert" style={{ marginTop: 8, fontSize: 11, color: STAFF_PANEL.danger }}>
              {editError}
            </p>
          )}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <StaffSecondaryButton onClick={() => setEditTarget(null)}>انصراف</StaffSecondaryButton>
            <StaffPrimaryButton onClick={() => void onSaveSettings()}>ثبت تغییرات</StaffPrimaryButton>
          </div>
        </Modal>
      )}

      {confirmTarget && (
        <Modal
          dark
          title={confirmTarget.service.enabled ? 'غیرفعال‌سازی سرویس' : 'فعال‌سازی سرویس'}
          onClose={() => setConfirmTarget(null)}
        >
          <p style={{ marginBottom: 16, fontSize: 11, color: STAFF_PANEL.textMuted }}>
            آیا سرویس «{confirmTarget.service.nameFa}» روی سایت{' '}
            {confirmTarget.service.enabled ? 'غیرفعال' : 'فعال'} شود؟
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <StaffSecondaryButton onClick={() => setConfirmTarget(null)}>انصراف</StaffSecondaryButton>
            {confirmTarget.service.enabled ? (
              <button
                type="button"
                onClick={() =>
                  void (confirmTarget.kind === 'internal'
                    ? confirmToggleInternal()
                    : confirmToggleExternal())
                }
                style={{
                  borderRadius: 10,
                  background: STAFF_PANEL.danger,
                  color: '#fff',
                  padding: '8px 16px',
                  fontSize: 11.5,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                غیرفعال کن
              </button>
            ) : (
              <StaffPrimaryButton
                onClick={() =>
                  void (confirmTarget.kind === 'internal'
                    ? confirmToggleInternal()
                    : confirmToggleExternal())
                }
              >
                فعال کن
              </StaffPrimaryButton>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
