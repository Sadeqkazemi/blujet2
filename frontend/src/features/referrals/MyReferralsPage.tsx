import { useCallback, useEffect, useState } from 'react';
import { fetchMyReferrals, submitReferralReport } from '../../api/cartable';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import AttachmentPicker from '../../components/AttachmentPicker';
import AttachmentList from '../../components/AttachmentList';
import type { MyReferral, MyReferralListResult, ReferralAttachment, ReferralStatus } from '../../types/cartable';

const STATUS_META: Record<ReferralStatus, { label: string; className: string }> = {
  SENT: { label: 'در انتظار اقدام', className: 'bg-[#f59e0b24] text-[#b45309]' },
  REVIEWING: { label: 'در حال بررسی', className: 'bg-accent/10 text-accent' },
  REPORTED: { label: 'گزارش ارسال‌شده', className: 'bg-[#10b98124] text-[#059669]' },
  CLOSED: { label: 'تکمیل‌شده', className: 'bg-surface text-muted' },
};

const PRIORITY_META: Record<MyReferral['priority'], string> = { HIGH: 'بالا', MEDIUM: 'متوسط', LOW: 'پایین' };

export default function MyReferralsPage() {
  const [result, setResult] = useState<MyReferralListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<MyReferral | null>(null);
  const [reportBody, setReportBody] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reportAttachments, setReportAttachments] = useState<ReferralAttachment[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchMyReferrals();
      setResult(data);
      return data;
    } catch {
      setError('خطا در دریافت ارجاعات.');
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmitReport() {
    if (!selected) return;
    if (!reportBody.trim()) {
      setReportError('متن گزارش را وارد کنید.');
      return;
    }
    setReportError(null);
    setSubmitting(true);
    try {
      await submitReferralReport(
        selected.id,
        reportBody.trim(),
        reportAttachments.map((a) => a.id),
      );
      setReportBody('');
      setReportAttachments([]);
      setNotice('گزارش شما ثبت شد ✓');
      const data = await load();
      if (data) {
        setSelected(data.referrals.find((r) => r.id === selected.id) ?? null);
      }
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'خطا در ثبت گزارش.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!result) {
    return (
      <div className="p-8">
        {error ? <p className="text-sm text-danger">{error}</p> : <p className="text-sm text-muted">در حال بارگذاری…</p>}
      </div>
    );
  }

  if (selected) {
    const st = STATUS_META[selected.status];
    return (
      <div className="space-y-4 p-8">
        <button
          onClick={() => {
            setSelected(null);
            setReportBody('');
            setReportError(null);
            setReportAttachments([]);
          }}
          className="text-xs font-bold text-accent"
        >
          بازگشت به فهرست ارجاعات
        </button>
        {notice && <p className="rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

        <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-2 p-6 text-white">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex-1 text-lg font-black">{selected.title}</h1>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${st.className}`}>{st.label}</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">
              اولویت {PRIORITY_META[selected.priority]}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/80">
            <span>ارجاع از: {selected.from.fullName}</span>
            <span className="font-num">تاریخ ارجاع: {formatJalaliDate(selected.createdAt)}</span>
            {selected.dueAt && <span className="font-num">مهلت: {formatJalaliDate(selected.dueAt)}</span>}
          </div>
        </header>

        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-2 text-sm font-bold text-ink">شرح درخواست</h2>
          <p className="text-xs leading-relaxed text-text-2">{selected.body}</p>
          <AttachmentList attachments={selected.attachments} variant="neutral" />
        </section>

        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">ثبت گزارش</h2>
          {selected.status === 'CLOSED' ? (
            <p className="text-xs text-muted">این ارجاع بسته شده است.</p>
          ) : (
            <>
              {selected.hasMyReport && (
                <p className="mb-3 rounded-lg bg-[#10b98115] p-3 text-xs text-[#059669]">
                  شما پیش‌تر گزارشی برای این ارجاع ثبت کرده‌اید. در صورت نیاز می‌توانید گزارش تکمیلی ارسال کنید.
                </p>
              )}
              <textarea
                data-testid="referral-report-body"
                value={reportBody}
                onChange={(e) => setReportBody(e.target.value)}
                placeholder="گزارش خود را وارد کنید…"
                rows={4}
                className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
              />
              <div className="mt-3">
                <label className="mb-1 block text-xs font-bold text-ink">بارگذاری مستندات (PDF یا تصویر)</label>
                <AttachmentPicker value={reportAttachments} onChange={setReportAttachments} />
              </div>
              {reportError && (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {reportError}
                </p>
              )}
              <button
                onClick={() => void onSubmitReport()}
                disabled={submitting}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90 disabled:opacity-60"
              >
                {submitting ? 'در حال ثبت…' : 'ثبت گزارش'}
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-ink">ارجاعات محول‌شده به من</h1>
        <p className="mt-1 text-sm text-muted">درخواست‌های ارجاع‌شده به شما توسط مدیران؛ برای هر مورد می‌توانید گزارش ثبت کنید.</p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">کل ارجاعات</div>
          <div className="font-num mt-1 text-lg font-black text-ink">{faDigits(result.counts.total)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">ارجاعات در انتظار</div>
          <div className="font-num mt-1 text-lg font-black text-[#b45309]">{faDigits(result.counts.awaitingMyReport)}</div>
        </div>
      </div>

      {result.referrals.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted" data-testid="my-referrals-empty">
          ارجاعی به شما ثبت نشده است.
        </p>
      ) : (
        <div className="space-y-3">
          {result.referrals.map((r) => {
            const st = STATUS_META[r.status];
            return (
              <div
                key={r.id}
                data-testid={`my-referral-${r.id}`}
                onClick={() => {
                  setSelected(r);
                  setNotice(null);
                }}
                className="cursor-pointer rounded-xl border border-border bg-white p-4 transition hover:border-accent"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-ink">{r.title}</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  ارجاع از {r.from.fullName} · {formatJalaliDate(r.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
