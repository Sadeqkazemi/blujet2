import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { fetchRefundDetail, fetchRefunds, payRefund, referRefund } from '../../api/refunds';
import { fetchStaffDirectory } from '../../api/cartable';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useStepUp } from '../../hooks/useStepUp';
import Modal from '../../components/Modal';
import {
  StaffAlert,
  StaffKpiCard,
  StaffPanelCard,
  StaffPanelPageHeader,
  StaffPrimaryButton,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import type { RefundDetail, RefundListRow, RefundsResult, RefundStatus } from '../../types/refunds';
import type { StaffDirectoryEntry } from '../../types/cartable';

const STATUS_META: Record<RefundStatus, { label: string; style: CSSProperties }> = {
  SUBMITTED: { label: 'ثبت مشتری', style: { background: 'rgba(245,158,11,0.15)', color: STAFF_PANEL.warning } },
  REVIEW: { label: 'بررسی ادمین', style: { background: STAFF_PANEL.accentSoft, color: STAFF_PANEL.accent } },
  FINANCE: { label: 'آمادهٔ پرداخت', style: { background: 'rgba(168,85,247,0.18)', color: STAFF_PANEL.purple } },
  PAID: { label: 'پرداخت شد', style: { background: 'rgba(52,211,153,0.15)', color: STAFF_PANEL.success } },
};

function routeLabel(r: RefundListRow | RefundDetail) {
  const { originCode, destCode } = r.booking.flightInstance.flight.route;
  return `${originCode} ← ${destCode}`;
}

function StatusBadge({ status }: { status: RefundStatus }) {
  const st = STATUS_META[status];
  return (
    <span
      style={{
        borderRadius: 20,
        padding: '4px 12px',
        fontSize: 10,
        fontWeight: 800,
        ...st.style,
      }}
    >
      {st.label}
    </span>
  );
}

const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${STAFF_PANEL.inputBorder}`,
  background: STAFF_PANEL.inputBg,
  color: STAFF_PANEL.text,
  padding: '8px 12px',
  fontSize: 11,
  outline: 'none',
  fontFamily: 'inherit',
};

const infoBlockStyle: CSSProperties = {
  marginBottom: 12,
  borderRadius: 10,
  background: STAFF_PANEL.inputBg,
  padding: 12,
};

export default function RefundsPage() {
  const [data, setData] = useState<RefundsResult | null>(null);
  const [detail, setDetail] = useState<RefundDetail | null>(null);
  const [staff, setStaff] = useState<StaffDirectoryEntry[]>([]);
  const [assigneePick, setAssigneePick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const stepUp = useStepUp('REFUND_PAYOUT');

  const load = useCallback(async () => {
    try {
      setData(await fetchRefunds());
    } catch {
      setError('خطا در دریافت درخواست‌های استرداد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    fetchStaffDirectory()
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [load]);

  async function openDetail(id: string) {
    setError(null);
    try {
      setAssigneePick('');
      setDetail(await fetchRefundDetail(id));
    } catch {
      setError('خطا در دریافت جزئیات درخواست.');
    }
  }

  async function onRefer() {
    if (!detail || !assigneePick) return;
    try {
      await referRefund(detail.id, assigneePick);
      const target = staff.find((s) => s.id === assigneePick);
      setNotice(`فرآیند به ${target?.fullName ?? 'کارمند مالی'} ارجاع شد ✓`);
      setDetail(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت ارجاع.');
    }
  }

  async function onPay(id: string) {
    setError(null);
    try {
      const fields = await stepUp.confirm();
      await payRefund(id, fields);
      setNotice('تأیید، واریز وجه و بستن پرونده انجام شد ✓');
      setDetail(null);
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === 'CANCELLED') return;
      setError(e instanceof Error ? e.message : 'خطا در پرداخت.');
    }
  }

  const requests = data?.requests ?? [];
  const kpis = data?.kpis;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <StaffPanelPageHeader
          title="استرداد بلیط"
          subtitle="درخواست‌های استرداد ارجاع‌شده از ادمین سایت — بررسی، تأیید، پرداخت و بستن پرونده"
        />
        {kpis && (
          <span
            style={{
              borderRadius: 20,
              background: 'rgba(168,85,247,0.12)',
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 800,
              color: STAFF_PANEL.purple,
              marginTop: 4,
            }}
          >
            {faDigits(kpis.payoutQueue)} در صف پرداخت
          </span>
        )}
      </div>

      {error && <StaffAlert tone="error">{error}</StaffAlert>}
      {notice && <StaffAlert tone="success">{notice}</StaffAlert>}

      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <StaffKpiCard label="در صف پرداخت" value={faDigits(kpis.payoutQueue)} iconColor={STAFF_PANEL.purple} />
          <StaffKpiCard label="پرداخت‌شده" value={faDigits(kpis.paid)} iconColor={STAFF_PANEL.success} />
          <StaffKpiCard label="در انتظار بررسی ادمین" value={faDigits(kpis.awaitingAdmin)} iconColor={STAFF_PANEL.warning} />
        </div>
      )}

      <StaffPanelCard
        title="فهرست درخواست‌های استرداد"
        subtitle="روی هر کارت بزنید تا اطلاعات مسافر، شبا و مبلغ نمایش داده شود."
        headerAction={
          <span style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>{faDigits(requests.length)} درخواست</span>
        }
      >
        {loading ? (
          <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>
        ) : requests.length === 0 ? (
          <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted }}>
            درخواست استردادی ثبت نشده است.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {requests.map((r, idx) => (
              <li
                key={r.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => void openDetail(r.id)}
                  style={{
                    display: 'flex',
                    minWidth: 0,
                    flex: 1,
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'right',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      width: 40,
                      height: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      background: STAFF_PANEL.accentSoft,
                      fontSize: 13,
                      fontWeight: 900,
                      color: STAFF_PANEL.accent,
                      flexShrink: 0,
                    }}
                  >
                    {r.passengerName.slice(0, 1)}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>
                      {r.passengerName}{' '}
                      <span style={{ direction: 'ltr', fontSize: 11, color: STAFF_PANEL.textMuted }}>{r.booking.pnr}</span>
                    </span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: STAFF_PANEL.textMuted }}>
                      {routeLabel(r)}
                      {r.assignee ? ` · ارجاع به: ${r.assignee.fullName}` : ''}
                    </span>
                  </span>
                </button>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>شماره پرواز</div>
                  <div style={{ direction: 'ltr', fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>
                    {r.booking.flightInstance.flight.flightNo}
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>مبلغ قابل پرداخت</div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: STAFF_PANEL.success }}>{faMoney(r.refundableIrr)} تومان</div>
                </div>
                <StatusBadge status={r.status} />
                {r.status === 'FINANCE' ? (
                  <button
                    type="button"
                    onClick={() => void onPay(r.id)}
                    style={{
                      borderRadius: 10,
                      background: STAFF_PANEL.success,
                      color: '#fff',
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    تأیید و پرداخت
                  </button>
                ) : r.status === 'PAID' ? (
                  <span style={{ fontSize: 11, fontWeight: 800, color: STAFF_PANEL.success }}>پرداخت شد</span>
                ) : (
                  <span style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>در انتظار ادمین</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </StaffPanelCard>

      {detail && (
        <Modal title={`درخواست استرداد · بلیط ${detail.booking.pnr}`} onClose={() => setDetail(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>وضعیت درخواست</span>
            <StatusBadge status={detail.status} />
          </div>

          <div style={infoBlockStyle}>
            <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>اطلاعات مسافر و حساب</h3>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: 11, margin: 0 }}>
              <div>
                <dt style={{ color: STAFF_PANEL.textMuted }}>نام مسافر</dt>
                <dd style={{ margin: 0, fontWeight: 800, color: STAFF_PANEL.text }}>{detail.passengerName}</dd>
              </div>
              <div>
                <dt style={{ color: STAFF_PANEL.textMuted }}>کد ملی</dt>
                <dd style={{ margin: 0, direction: 'ltr', fontWeight: 800, color: STAFF_PANEL.text }}>{detail.nationalId ?? '—'}</dd>
              </div>
              <div>
                <dt style={{ color: STAFF_PANEL.textMuted }}>شماره تماس</dt>
                <dd style={{ margin: 0, direction: 'ltr', fontWeight: 800, color: STAFF_PANEL.text }}>{detail.mobile ?? '—'}</dd>
              </div>
              <div>
                <dt style={{ color: STAFF_PANEL.textMuted }}>زمان ثبت درخواست</dt>
                <dd style={{ margin: 0, fontWeight: 800, color: STAFF_PANEL.text }}>{formatJalaliDateTime(detail.createdAt)}</dd>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <dt style={{ color: STAFF_PANEL.textMuted }}>شماره شبا (IBAN)</dt>
                <dd style={{ margin: 0, direction: 'ltr', fontWeight: 800, color: STAFF_PANEL.text }}>{detail.iban}</dd>
              </div>
            </dl>
          </div>

          <div style={infoBlockStyle}>
            <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>اطلاعات پرواز</h3>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: 11, margin: 0 }}>
              <div>
                <dt style={{ color: STAFF_PANEL.textMuted }}>مسیر</dt>
                <dd style={{ margin: 0, fontWeight: 800, color: STAFF_PANEL.text }}>{routeLabel(detail)}</dd>
              </div>
              <div>
                <dt style={{ color: STAFF_PANEL.textMuted }}>ایرلاین / شماره پرواز</dt>
                <dd style={{ margin: 0, fontWeight: 800, color: STAFF_PANEL.text }}>
                  blujet · <span style={{ direction: 'ltr' }}>{detail.booking.flightInstance.flight.flightNo}</span>
                </dd>
              </div>
              <div>
                <dt style={{ color: STAFF_PANEL.textMuted }}>تاریخ و ساعت پرواز</dt>
                <dd style={{ margin: 0, fontWeight: 800, color: STAFF_PANEL.text }}>
                  {formatJalaliDateTime(detail.booking.flightInstance.departureAt)}
                </dd>
              </div>
            </dl>
          </div>

          <div style={{ ...infoBlockStyle, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: STAFF_PANEL.textMuted }}>مبلغ پرداخت‌شدهٔ بلیط</span>
              <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faMoney(detail.totalPaidIrr)} تومان</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: STAFF_PANEL.textMuted }}>درصد جریمهٔ کنسلی (٪{faDigits(detail.penaltyPct)})</span>
              <span style={{ fontWeight: 800, color: STAFF_PANEL.danger }}>−{faMoney(detail.penaltyAmountIrr)} تومان</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 8,
                marginTop: 4,
                borderTop: `1px solid ${STAFF_PANEL.sidebarBorder}`,
              }}
            >
              <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>مبلغ نهایی قابل پرداخت</span>
              <span style={{ fontWeight: 900, color: STAFF_PANEL.success }}>{faMoney(detail.refundableIrr)} تومان</span>
            </div>
          </div>

          {detail.status === 'PAID' ? (
            <p
              style={{
                borderRadius: 10,
                background: 'rgba(52,211,153,0.12)',
                padding: 12,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 800,
                color: STAFF_PANEL.success,
              }}
            >
              پرداخت شد و پرونده بسته است ✓
            </p>
          ) : (
            <>
              <div
                style={{
                  marginBottom: 12,
                  borderRadius: 10,
                  border: `1px solid ${STAFF_PANEL.cardBorder}`,
                  padding: 12,
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>ارجاع به کارمند مالی</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    aria-label="گیرنده ارجاع"
                    value={assigneePick}
                    onChange={(e) => setAssigneePick(e.target.value)}
                    style={{ ...inputStyle, flex: 1, height: 36 }}
                  >
                    <option value="">— انتخاب کارمند —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} — {s.roleLabelFa}
                      </option>
                    ))}
                  </select>
                  <StaffPrimaryButton onClick={() => void onRefer()} disabled={!assigneePick}>
                    ثبت و انتقال فرآیند ارجاع
                  </StaffPrimaryButton>
                </div>
                {detail.assignee && (
                  <p style={{ marginTop: 8, fontSize: 11, color: STAFF_PANEL.textMuted }}>ارجاع فعلی: {detail.assignee.fullName}</p>
                )}
              </div>
              {detail.status === 'FINANCE' ? (
                <button
                  type="button"
                  onClick={() => void onPay(detail.id)}
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    background: STAFF_PANEL.success,
                    color: '#fff',
                    padding: '10px 16px',
                    fontSize: 11.5,
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  تأیید، واریز به شبا و بستن پرونده
                </button>
              ) : (
                <p
                  style={{
                    borderRadius: 10,
                    background: STAFF_PANEL.inputBg,
                    padding: 12,
                    textAlign: 'center',
                    fontSize: 11,
                    color: STAFF_PANEL.textMuted,
                  }}
                >
                  در انتظار ادمین
                </p>
              )}
            </>
          )}
        </Modal>
      )}
      {stepUp.modal}
    </div>
  );
}
