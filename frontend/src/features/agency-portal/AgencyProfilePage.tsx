import { useEffect, useRef, useState } from 'react';
import { fetchDocuments, fetchProfile, uploadDocument } from '../../api/agency-portal';
import { formatJalaliDate, toJalali } from '../../lib/jalali';
import { faDigits } from '../../lib/fa-format';
import { ApiRequestError } from '../../api/envelope';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyDocument, AgencyDocumentType, AgencyProfile } from '../../types/agency-portal';

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const TIER_LABEL_LOCAL: Record<AgencyProfile['tier'], Tr> = {
  GOLD: { fa: 'طلایی', en: 'Gold', ar: 'ذهبية' },
  SILVER: { fa: 'نقره‌ای', en: 'Silver', ar: 'فضية' },
  NORMAL: { fa: 'عادی', en: 'Standard', ar: 'عادية' },
};

const DOC_TYPE_LABEL: Record<AgencyDocumentType, Tr> = {
  LICENSE: { fa: 'مجوز فعالیت', en: 'Operating License', ar: 'ترخيص النشاط' },
  CONTRACT: { fa: 'قرارداد همکاری', en: 'Partnership Contract', ar: 'عقد الشراكة' },
  OTHER: { fa: 'سایر', en: 'Other', ar: 'أخرى' },
};

const DOC_STATUS_STYLE: Record<AgencyDocument['status'], { label: Tr; color: string; bg: string }> = {
  PENDING: {
    label: { fa: 'در انتظار بررسی', en: 'Pending', ar: 'قيد المراجعة' },
    color: '#b45309',
    bg: '#fef3c7',
  },
  APPROVED: {
    label: { fa: 'تأیید شد', en: 'Approved', ar: 'تمت الموافقة' },
    color: '#1f8a5b',
    bg: '#eaf7f0',
  },
  REJECTED: {
    label: { fa: 'رد شد', en: 'Rejected', ar: 'مرفوض' },
    color: '#e8553a',
    bg: '#fdecec',
  },
};

const DOC_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const UPLOAD_ICON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </svg>
);

const STR: Record<
  StoredLocale,
  {
    heading: string;
    subtitle: string;
    errorFallback: string;
    loading: string;
    fieldManager: string;
    fieldLicenseNo: string;
    fieldCity: string;
    fieldPhone: string;
    fieldEmail: string;
    fieldPartnershipType: string;
    partnershipValue: (tier: string) => string;
    accountActive: (year: string) => string;
    documentsTitle: string;
    documentsEmpty: string;
    uploadDocLabel: string;
    noFileSelected: string;
    uploadErrorFallback: string;
    uploadingBtn: string;
  }
> = {
  fa: {
    heading: 'پروفایل و مدارک',
    subtitle: 'اطلاعات ثبت‌شده آژانس شما و مدارک ارسالی',
    errorFallback: 'خطا در دریافت پروفایل.',
    loading: 'در حال بارگذاری…',
    fieldManager: 'مدیر عامل',
    fieldLicenseNo: 'شماره مجوز',
    fieldCity: 'شهر',
    fieldPhone: 'تلفن',
    fieldEmail: 'ایمیل',
    fieldPartnershipType: 'نوع همکاری',
    partnershipValue: (tier) => `آژانس همکار ${tier}`,
    accountActive: (year) => `● حساب فعال · عضو از ${year}`,
    documentsTitle: 'مدارک آژانس',
    documentsEmpty: 'مدرکی آپلود نشده است.',
    uploadDocLabel: 'بارگذاری مدرک جدید',
    noFileSelected: 'فایلی انتخاب نشده است.',
    uploadErrorFallback: 'خطا در آپلود مدرک.',
    uploadingBtn: 'در حال آپلود…',
  },
  en: {
    heading: 'Profile & Documents',
    subtitle: "Your agency's registered information and submitted documents",
    errorFallback: 'Error loading the profile.',
    loading: 'Loading…',
    fieldManager: 'CEO',
    fieldLicenseNo: 'License Number',
    fieldCity: 'City',
    fieldPhone: 'Phone',
    fieldEmail: 'Email',
    fieldPartnershipType: 'Partnership Type',
    partnershipValue: (tier) => `${tier} Partner Agency`,
    accountActive: (year) => `● Active account · Member since ${year}`,
    documentsTitle: 'Agency documents',
    documentsEmpty: 'No documents uploaded yet.',
    uploadDocLabel: 'Upload new document',
    noFileSelected: 'No file selected.',
    uploadErrorFallback: 'Error uploading the document.',
    uploadingBtn: 'Uploading…',
  },
  ar: {
    heading: 'الملف الشخصي والمستندات',
    subtitle: 'معلومات وكالتك المسجّلة والمستندات المُرسلة',
    errorFallback: 'خطأ في تحميل الملف الشخصي.',
    loading: 'جارٍ التحميل…',
    fieldManager: 'المدير العام',
    fieldLicenseNo: 'رقم الترخيص',
    fieldCity: 'المدينة',
    fieldPhone: 'الهاتف',
    fieldEmail: 'البريد الإلكتروني',
    fieldPartnershipType: 'نوع الشراكة',
    partnershipValue: (tier) => `وكالة شريكة ${tier}`,
    accountActive: (year) => `● حساب نشط · عضو منذ ${year}`,
    documentsTitle: 'مستندات الوكالة',
    documentsEmpty: 'لم يتم رفع أي مستند بعد.',
    uploadDocLabel: 'رفع مستند جديد',
    noFileSelected: 'لم يتم اختيار ملف.',
    uploadErrorFallback: 'خطأ في رفع المستند.',
    uploadingBtn: 'جارٍ الرفع…',
  },
};

function agencyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'PA';
}

function memberYear(joinedAt: string, locale: StoredLocale): string {
  if (locale === 'en') return String(new Date(joinedAt).getFullYear());
  const { jy } = toJalali(joinedAt);
  return faDigits(jy);
}

function formatFileMeta(fileName: string, createdAt: string): string {
  return `${fileName} · ${formatJalaliDate(createdAt)}`;
}

export default function AgencyProfilePage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
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
      .catch(() => setError(t.errorFallback));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, []);

  async function onUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      await uploadDocument(file, docType);
      if (fileInputRef.current) fileInputRef.current.value = '';
      reload();
    } catch (err) {
      setUploadError(err instanceof ApiRequestError ? err.message : t.uploadErrorFallback);
    } finally {
      setUploading(false);
    }
  }

  function onFileChange() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError(t.noFileSelected);
      return;
    }
    void onUpload(file);
  }

  if (error) return <p style={{ fontSize: 13, color: '#e5484d' }}>{error}</p>;
  if (!profile) return <p style={{ fontSize: 13, color: '#8a96a6' }}>{t.loading}</p>;

  const fields: [string, string][] = [
    [t.fieldManager, profile.managerName],
    [t.fieldLicenseNo, profile.licenseNo],
    [t.fieldCity, profile.city],
    [t.fieldPhone, profile.phone],
    [t.fieldEmail, profile.email],
    [t.fieldPartnershipType, t.partnershipValue(TIER_LABEL_LOCAL[profile.tier][locale])],
  ];

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">{t.agencyInfoHeading}</div>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-muted">{label}</dt>
              <dd className="ltr mt-1 text-sm font-bold text-ink">{value}</dd>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0d2640', margin: '0 0 16px' }}>{t.documentsTitle}</h3>
          {documents.length === 0 ? (
            <p style={{ padding: '12px 0', textAlign: 'center', fontSize: 11.5, color: '#8a96a6', margin: 0 }}>
              {t.documentsEmpty}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {documents.map((d) => {
                const st = DOC_STATUS_STYLE[d.status];
                return (
                  <div
                    key={d.id}
                    data-testid="agency-doc-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 12px',
                      background: '#f8fafc',
                      border: '1px solid #eef2f7',
                      borderRadius: 12,
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          background: '#fff',
                          border: '1px solid #e6ecf3',
                          color: '#1668c4',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 'none',
                        }}
                      >
                        {DOC_ICON}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#16202e' }}>
                          {DOC_TYPE_LABEL[d.docType][locale]}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#8a96a6', marginTop: 2 }}>
                          {formatFileMeta(d.file.fileName, d.createdAt)}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: st.color,
                        background: st.bg,
                        padding: '3px 8px',
                        borderRadius: 7,
                        flex: 'none',
                      }}
                    >
                      {st.label[locale]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as AgencyDocumentType)}
              style={{
                width: '100%',
                height: 40,
                marginBottom: 10,
                background: '#f6f8fb',
                border: '1px solid #e3e9f1',
                borderRadius: 11,
                padding: '0 11px',
                fontFamily: 'inherit',
                fontSize: 12,
                color: '#16202e',
              }}
            >
              {(Object.keys(DOC_TYPE_LABEL) as AgencyDocumentType[]).map((dt) => (
                <option key={dt} value={dt}>
                  {DOC_TYPE_LABEL[dt][locale]}
                </option>
              ))}
            </select>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                height: 46,
                border: '1.5px dashed #c3d2e3',
                borderRadius: 12,
                color: '#1668c4',
                fontSize: 12,
                fontWeight: 700,
                cursor: uploading ? 'wait' : 'pointer',
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {UPLOAD_ICON}
              {uploading ? t.uploadingBtn : t.uploadDocLabel}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={onFileChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            {uploadError && (
              <p role="alert" style={{ fontSize: 11, color: '#e5484d', margin: '8px 0 0' }}>
                {uploadError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
