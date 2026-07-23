import { useCallback, useEffect, useState } from 'react';
import { fetchRefundDetail, fetchRefunds, payRefund, referRefund } from '../../api/refunds';
import { fetchStaffDirectory } from '../../api/cartable';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useStepUp } from '../../hooks/useStepUp';
import Modal from '../../components/Modal';
import type { RefundDetail, RefundListRow, RefundsResult, RefundStatus } from '../../types/refunds';
import type { StaffDirectoryEntry } from '../../types/cartable';

const STATUS_META: Record<RefundStatus, { label: string; className: string }> = {
  SUBMITTED: { label: 'ثبت مشتری', className: 'bg-[#f59e0b24] text-[#b45309]' },
  REVIEW: { label: 'بررسی ادمین', className: 'bg-[#60a5fa2e] text-[#1d4ed8]' },
  FINANCE: { label: 'آمادهٔ پرداخت', className: 'bg-[#a855f72e] text-[#7c3aed]' },
  PAID: { label: 'پرداخت شد', className: 'bg-[#10b98124] text-[#059669]' },
};

function routeLabel(r: RefundListRow) {
  const { originCode, destCode } = r.booking.flightInstance.flight.route;
  return `${originCode} ← ${destCode}`;
}

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
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">استرداد بلیط</h1>
          <p className="mt-1 text-sm text-muted">
            درخواست‌های استرداد ارجاع‌شده از ادمین سایت — بررسی، تأیید، پرداخت و بستن پرونده
          </p>
        </div>
        {kpis && (
          <span className="font-num rounded-full bg-[#a855f71f] px-3 py-1.5 text-[11px] font-bold text-[#7c3aed]">
            {faDigits(kpis.payoutQueue)} در صف پرداخت
          </span>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      {kpis && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">در صف پرداخت</div>
            <div className="font-num mt-1 text-lg font-black text-[#7c3aed]">{faDigits(kpis.payoutQueue)}</div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">پرداخت‌شده</div>
            <div className="font-num mt-1 text-lg font-black text-[#059669]">{faDigits(kpis.paid)}</div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">در انتظار بررسی ادمین</div>
            <div className="font-num mt-1 text-lg font-black text-[#b45309]">{faDigits(kpis.awaitingAdmin)}</div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">فهرست درخواست‌های استرداد</h2>
          <span className="font-num text-[11px] text-muted">{faDigits(requests.length)} درخواست</span>
        </div>
        <p className="mb-3 text-[11px] text-muted">
          روی هر کارت بزنید تا اطلاعات مسافر، شبا و مبلغ نمایش داده شود.
        </p>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted">در حال بارگذاری…</p>
        ) : requests.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">درخواست استردادی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => {
              const st = STATUS_META[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <button
                    onClick={() => void openDetail(r.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-right"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-sm font-black text-accent">
                      {r.passengerName.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink">
                        {r.passengerName}{' '}
                        <span className="ltr font-num text-[11px] text-muted">{r.booking.pnr}</span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {routeLabel(r)}
                        {r.assignee ? ` · ارجاع به: ${r.assignee.fullName}` : ''}
                      </span>
                    </span>
                  </button>
                  <div className="text-left">
                    <div className="text-[10px] text-muted">شماره پرواز</div>
                    <div className="ltr font-num text-xs font-bold text-ink">
                      {r.booking.flightInstance.flight.flightNo}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-muted">مبلغ قابل پرداخت</div>
                    <div className="font-num text-xs font-black text-[#059669]">{faMoney(r.refundableIrr)} تومان</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                  {r.status === 'FINANCE' ? (
                    <button
                      onClick={() => void onPay(r.id)}
                      className="rounded-lg bg-[#059669] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#047857]"
                    >
                      تأیید و پرداخت
                    </button>
                  ) : r.status === 'PAID' ? (
                    <span className="text-[11px] font-bold text-[#059669]">پرداخت شد</span>
                  ) : (
                    <span className="text-[11px] text-muted">در انتظار ادمین</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detail && (
        <Modal title={`درخواست استرداد · بلیط ${detail.booking.pnr}`} onClose={() => setDetail(null)}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] text-muted">وضعیت درخواست</span>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold ${STATUS_META[detail.status].className}`}
            >
              {STATUS_META[detail.status].label}
            </span>
          </div>

          <div className="mb-3 rounded-lg bg-surface p-3">
            <h3 className="mb-2 text-xs font-bold text-ink">اطلاعات مسافر و حساب</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <div>
                <dt className="text-muted">نام مسافر</dt>
                <dd className="font-bold text-ink">{detail.passengerName}</dd>
              </div>
              <div>
                <dt className="text-muted">کد ملی</dt>
                <dd className="ltr font-num font-bold text-ink">{detail.nationalId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">شماره تماس</dt>
                <dd className="ltr font-num font-bold text-ink">{detail.mobile ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">زمان ثبت درخواست</dt>
                <dd className="font-num font-bold text-ink">{formatJalaliDateTime(detail.createdAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">شماره شبا (IBAN)</dt>
                <dd className="ltr font-num font-bold text-ink">{detail.iban}</dd>
              </div>
            </dl>
          </div>

          <div className="mb-3 rounded-lg bg-surface p-3">
            <h3 className="mb-2 text-xs font-bold text-ink">اطلاعات پرواز</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <div>
                <dt className="text-muted">مسیر</dt>
                <dd className="font-bold text-ink">{routeLabel(detail)}</dd>
              </div>
              <div>
                <dt className="text-muted">ایرلاین / شماره پرواز</dt>
                <dd className="font-bold text-ink">
                  blujet · <span className="ltr font-num">{detail.booking.flightInstance.flight.flightNo}</span>
                </dd>
              </div>
              <div>
                <dt className="text-muted">تاریخ و ساعت پرواز</dt>
                <dd className="font-num font-bold text-ink">
                  {formatJalaliDateTime(detail.booking.flightInstance.departureAt)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mb-3 rounded-lg bg-surface p-3 text-[11px]">
            <div className="flex justify-between py-1">
              <span className="text-muted">مبلغ پرداخت‌شدهٔ بلیط</span>
              <span className="font-num font-bold text-ink">{faMoney(detail.totalPaidIrr)} تومان</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">درصد جریمهٔ کنسلی (٪{faDigits(detail.penaltyPct)})</span>
              <span className="font-num font-bold text-danger">−{faMoney(detail.penaltyAmountIrr)} تومان</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-bold text-ink">مبلغ نهایی قابل پرداخت</span>
              <span className="font-num font-black text-[#059669]">{faMoney(detail.refundableIrr)} تومان</span>
            </div>
          </div>

          {detail.status === 'PAID' ? (
            <p className="rounded-lg bg-[#10b98115] p-3 text-center text-xs font-bold text-[#059669]">
              پرداخت شد و پرونده بسته است ✓
            </p>
          ) : (
            <>
              <div className="mb-3 rounded-lg border border-border p-3">
                <h3 className="mb-2 text-xs font-bold text-ink">ارجاع به کارمند مالی</h3>
                <div className="flex gap-2">
                  <select
                    aria-label="گیرنده ارجاع"
                    value={assigneePick}
                    onChange={(e) => setAssigneePick(e.target.value)}
                    className="h-9 flex-1 rounded-lg border border-border bg-white px-2 text-xs outline-none"
                  >
                    <option value="">— انتخاب کارمند —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} — {s.roleLabelFa}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void onRefer()}
                    disabled={!assigneePick}
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent/90 disabled:opacity-50"
                  >
                    ثبت و انتقال فرآیند ارجاع
                  </button>
                </div>
                {detail.assignee && (
                  <p className="mt-2 text-[11px] text-muted">ارجاع فعلی: {detail.assignee.fullName}</p>
                )}
              </div>
              {detail.status === 'FINANCE' ? (
                <button
                  onClick={() => void onPay(detail.id)}
                  className="w-full rounded-lg bg-[#059669] py-2.5 text-xs font-bold text-white transition hover:bg-[#047857]"
                >
                  تأیید، واریز به شبا و بستن پرونده
                </button>
              ) : (
                <p className="rounded-lg bg-surface p-3 text-center text-[11px] text-muted">در انتظار ادمین</p>
              )}
            </>
          )}
        </Modal>
      )}
      {stepUp.modal}
    </div>
  );
}
