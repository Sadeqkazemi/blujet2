import { useEffect, useRef, useState } from 'react';
import { fetchDocuments, fetchProfile, uploadDocument } from '../../api/agency-portal';
import { formatJalaliDate } from '../../lib/jalali';
import { ApiRequestError } from '../../api/envelope';
import { TIER_LABELS } from '../agencies/agency-labels';
import type { AgencyDocument, AgencyDocumentType, AgencyProfile } from '../../types/agency-portal';

const DOC_TYPE_LABEL: Record<AgencyDocumentType, string> = {
  LICENSE: 'مجوز فعالیت',
  CONTRACT: 'قرارداد همکاری',
  OTHER: 'سایر',
};

const DOC_STATUS_LABEL: Record<AgencyDocument['status'], { label: string; className: string }> = {
  PENDING: { label: 'در انتظار بررسی', className: 'bg-[#f59e0b24] text-[#b45309]' },
  APPROVED: { label: 'تأیید شد', className: 'bg-[#10b98124] text-[#059669]' },
  REJECTED: { label: 'رد شد', className: 'bg-danger/15 text-danger' },
};

export default function AgencyProfilePage() {
  const [profile, setProfile] = useState<AgencyProfile | null>(null);
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<AgencyDocumentType>('LICENSE');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reload() {
    Promise.all([fetchProfile(), fetchDocuments()])
      .then(([p, d]) => {
        setProfile(p);
        setDocuments(d);
      })
      .catch(() => setError('خطا در دریافت پروفایل.'));
  }

  useEffect(reload, []);

  async function onUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError('فایلی انتخاب نشده است.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      await uploadDocument(file, docType);
      if (fileInputRef.current) fileInputRef.current.value = '';
      reload();
    } catch (err) {
      setUploadError(err instanceof ApiRequestError ? err.message : 'خطا در آپلود مدرک.');
    } finally {
      setUploading(false);
    }
  }

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!profile) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  const fields: [string, string][] = [
    ['مدیر عامل', profile.managerName],
    ['شماره مجوز', profile.licenseNo],
    ['شهر', profile.city],
    ['تلفن', profile.phone],
    ['ایمیل', profile.email],
    ['نوع همکاری', `آژانس همکار ${TIER_LABELS[profile.tier]}`],
  ];

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">پروفایل و مدارک</h1>
      <p className="mb-6 text-sm text-muted">اطلاعات ثبت‌شده آژانس شما و مدارک ارسالی</p>

      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">اطلاعات آژانس</div>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-muted">{label}</dt>
              <dd className="ltr font-num mt-1 text-sm font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">آپلود مدرک جدید</div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as AgencyDocumentType)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-xs"
          >
            {(Object.keys(DOC_TYPE_LABEL) as AgencyDocumentType[]).map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="text-xs" />
          <button
            disabled={uploading}
            onClick={() => void onUpload()}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {uploading ? 'در حال آپلود…' : 'آپلود'}
          </button>
        </div>
        {uploadError && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {uploadError}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">مدارک ارسالی</div>
        {documents.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">مدرکی آپلود نشده است.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((d) => {
              const st = DOC_STATUS_LABEL[d.status];
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-bold">{DOC_TYPE_LABEL[d.docType]}</div>
                    <div className="text-[10px] text-muted">
                      {d.file.fileName} — {formatJalaliDate(d.createdAt)}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
