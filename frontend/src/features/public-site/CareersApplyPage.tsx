import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { applyToJob, fetchJobDetail } from '../../api/careers';
import { parseJalaliDateToIso } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import type {
  EducationEntry,
  JobApplicantGender,
  JobDetail,
  LanguageEntry,
  MaritalStatus,
  MilitaryStatus,
  WorkEntry,
} from '../../types/careers';

const RESUME_MAX_BYTES = 3 * 1024 * 1024;

const STR: Record<
  StoredLocale,
  {
    notFound: string;
    generalReqs: string;
    specialReqs: string;
    formHeading: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    fatherName: string;
    birthDate: string;
    birthDatePlaceholder: string;
    gender: string;
    genderFemale: string;
    genderMale: string;
    marital: string;
    maritalSingle: string;
    maritalMarried: string;
    military: string;
    militaryConscript: string;
    militaryExempt: string;
    militaryWaived: string;
    phone: string;
    email: string;
    residenceAddress: string;
    skills: string;
    education: string;
    addEducation: string;
    work: string;
    addWork: string;
    languages: string;
    addLanguage: string;
    resume: string;
    resumeHint: string;
    submit: string;
    submitting: string;
    sentTitle: string;
    sentBody: string;
    remove: string;
  }
> = {
  fa: {
    notFound: 'این فرصت شغلی یافت نشد یا دیگر فعال نیست.',
    generalReqs: 'شرایط عمومی',
    specialReqs: 'شرایط تخصصی',
    formHeading: 'فرم درخواست همکاری',
    firstName: 'نام',
    lastName: 'نام خانوادگی',
    nationalId: 'کد ملی',
    fatherName: 'نام پدر',
    birthDate: 'تاریخ تولد',
    birthDatePlaceholder: '۱۳۷۰/۰۱/۰۱',
    gender: 'جنسیت',
    genderFemale: 'زن',
    genderMale: 'مرد',
    marital: 'وضعیت تأهل',
    maritalSingle: 'مجرد',
    maritalMarried: 'متأهل',
    military: 'وضعیت نظام‌وظیفه',
    militaryConscript: 'مشمول',
    militaryExempt: 'معافیت',
    militaryWaived: 'پایان خدمت',
    phone: 'شماره تماس',
    email: 'ایمیل',
    residenceAddress: 'آدرس محل سکونت',
    skills: 'مهارت‌ها',
    education: 'سوابق تحصیلی',
    addEducation: '+ افزودن مقطع تحصیلی',
    work: 'سوابق کاری',
    addWork: '+ افزودن سابقه کاری',
    languages: 'زبان‌های خارجی',
    addLanguage: '+ افزودن زبان',
    resume: 'رزومه (PDF، حداکثر ۳ مگابایت)',
    resumeHint: 'اختیاری',
    submit: 'ثبت درخواست',
    submitting: 'در حال ارسال…',
    sentTitle: 'درخواست شما ثبت شد',
    sentBody: 'کارشناسان جذب و استخدام در صورت نیاز با شما تماس می‌گیرند.',
    remove: 'حذف',
  },
  en: {
    notFound: 'This position was not found or is no longer active.',
    generalReqs: 'General Requirements',
    specialReqs: 'Specialized Requirements',
    formHeading: 'Application Form',
    firstName: 'First Name',
    lastName: 'Last Name',
    nationalId: 'National ID',
    fatherName: "Father's Name",
    birthDate: 'Date of Birth',
    birthDatePlaceholder: '1370/01/01',
    gender: 'Gender',
    genderFemale: 'Female',
    genderMale: 'Male',
    marital: 'Marital Status',
    maritalSingle: 'Single',
    maritalMarried: 'Married',
    military: 'Military Status',
    militaryConscript: 'Conscript',
    militaryExempt: 'Exempt',
    militaryWaived: 'Completed',
    phone: 'Phone Number',
    email: 'Email',
    residenceAddress: 'Home Address',
    skills: 'Skills',
    education: 'Education',
    addEducation: '+ Add Education',
    work: 'Work Experience',
    addWork: '+ Add Work Experience',
    languages: 'Languages',
    addLanguage: '+ Add Language',
    resume: 'Resume (PDF, up to 3MB)',
    resumeHint: 'Optional',
    submit: 'Submit Application',
    submitting: 'Submitting…',
    sentTitle: 'Your application was submitted',
    sentBody: "Our recruiting team will contact you if there's a fit.",
    remove: 'Remove',
  },
  ar: {
    notFound: 'لم يتم العثور على هذه الوظيفة أو لم تعد نشطة.',
    generalReqs: 'الشروط العامة',
    specialReqs: 'الشروط التخصصية',
    formHeading: 'نموذج طلب التوظيف',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    nationalId: 'الرقم الوطني',
    fatherName: 'اسم الأب',
    birthDate: 'تاريخ الميلاد',
    birthDatePlaceholder: '١٣٧٠/٠١/٠١',
    gender: 'الجنس',
    genderFemale: 'أنثى',
    genderMale: 'ذكر',
    marital: 'الحالة الاجتماعية',
    maritalSingle: 'أعزب',
    maritalMarried: 'متزوج',
    military: 'حالة الخدمة العسكرية',
    militaryConscript: 'مكلف',
    militaryExempt: 'معفى',
    militaryWaived: 'أنهى الخدمة',
    phone: 'رقم الهاتف',
    email: 'البريد الإلكتروني',
    residenceAddress: 'عنوان السكن',
    skills: 'المهارات',
    education: 'المؤهلات الدراسية',
    addEducation: '+ إضافة مؤهل',
    work: 'الخبرات العملية',
    addWork: '+ إضافة خبرة عمل',
    languages: 'اللغات',
    addLanguage: '+ إضافة لغة',
    resume: 'السيرة الذاتية (PDF، حتى ٣ ميجابايت)',
    resumeHint: 'اختياري',
    submit: 'إرسال الطلب',
    submitting: 'جارٍ الإرسال…',
    sentTitle: 'تم إرسال طلبك',
    sentBody: 'سيتواصل معك فريق التوظيف لدينا عند الحاجة.',
    remove: 'إزالة',
  },
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 13px',
  border: '1.5px solid #e3e9f1',
  borderRadius: 11,
  fontFamily: 'inherit',
  fontSize: 12.5,
  outline: 'none',
};

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, color: '#5a6678', marginBottom: 6 };

export default function CareersApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];

  const [job, setJob] = useState<JobDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<JobApplicantGender | ''>('');
  const [marital, setMarital] = useState<MaritalStatus | ''>('');
  const [military, setMilitary] = useState<MilitaryStatus | ''>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [residenceAddress, setResidenceAddress] = useState('');
  const [skills, setSkills] = useState('');
  const [eduEntries, setEduEntries] = useState<EducationEntry[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [langEntries, setLangEntries] = useState<LanguageEntry[]>([]);
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    fetchJobDetail(jobId)
      .then(setJob)
      .catch(() => setNotFound(true));
  }, [jobId]);

  function onResumeChange(file: File | null) {
    setResumeError(null);
    if (!file) {
      setResume(null);
      return;
    }
    if (file.type !== 'application/pdf') {
      setResumeError('فقط فایل PDF مجاز است.');
      return;
    }
    if (file.size > RESUME_MAX_BYTES) {
      setResumeError('حداکثر حجم مجاز فایل رزومه ۳ مگابایت است.');
      return;
    }
    setResume(file);
  }

  const canSubmit = firstName.trim() && lastName.trim() && nationalId.trim() && phone.trim() && !resumeError;

  async function onSubmit() {
    if (!jobId || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const isoBirthDate = birthDate.trim() ? parseJalaliDateToIso(birthDate.trim()) : null;
      await applyToJob(jobId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nationalId: nationalId.trim(),
        fatherName: fatherName.trim() || undefined,
        birthDate: isoBirthDate ?? undefined,
        gender: gender || undefined,
        marital: marital || undefined,
        military: military || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        residenceAddress: residenceAddress.trim() || undefined,
        skills: skills.trim() || undefined,
        eduEntries: eduEntries.length ? eduEntries : undefined,
        workEntries: workEntries.length ? workEntries : undefined,
        langEntries: langEntries.length ? langEntries : undefined,
        resume: resume ?? undefined,
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت درخواست.');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <PublicPageShell>
        <div style={{ maxWidth: 640, margin: '60px auto', textAlign: 'center', padding: '0 22px' }}>
          <p style={{ fontSize: 14, color: '#5a6678' }}>{t.notFound}</p>
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <section
        style={{
          background: 'linear-gradient(150deg,#0d2640,#124a86)',
          color: '#fff',
          padding: '35px 22px 30px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, margin: '0 0 8px' }}>{job?.title ?? '…'}</h1>
        {job && (
          <p style={{ fontSize: 12.5, color: '#c9dcf3', margin: 0 }}>
            {job.dept} · {job.city}
          </p>
        )}
      </section>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 22px 55px' }}>
        {job && (job.generalReqs.length > 0 || job.specialReqs.length > 0) && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #eef1f5',
              borderRadius: 16,
              padding: '18px 20px',
              marginBottom: 20,
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 16,
            }}
          >
            {job.generalReqs.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640', marginBottom: 8 }}>{t.generalReqs}</div>
                <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: '#5a6678', lineHeight: 1.9 }}>
                  {job.generalReqs.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {job.specialReqs.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640', marginBottom: 8 }}>{t.specialReqs}</div>
                <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: '#5a6678', lineHeight: 1.9 }}>
                  {job.specialReqs.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: '22px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 900, color: '#0d2640', margin: '0 0 18px' }}>{t.formHeading}</h2>

          {sent ? (
            <div
              data-testid="apply-sent"
              style={{ background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 12, padding: '22px 16px', textAlign: 'center' }}
            >
              <div style={{ fontSize: 22, color: '#1f8a5b', marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0d2640', marginBottom: 4 }}>{t.sentTitle}</div>
              <div style={{ fontSize: 11.5, color: '#5a6678' }}>{t.sentBody}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 11 }}>
                <div>
                  <label style={labelStyle}>{t.firstName}</label>
                  <input data-testid="apply-firstName" style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t.lastName}</label>
                  <input data-testid="apply-lastName" style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t.nationalId}</label>
                  <input
                    data-testid="apply-nationalId"
                    dir="ltr"
                    style={inputStyle}
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.fatherName}</label>
                  <input style={inputStyle} value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t.birthDate}</label>
                  <input
                    dir="ltr"
                    style={inputStyle}
                    placeholder={t.birthDatePlaceholder}
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.phone}</label>
                  <input
                    data-testid="apply-phone"
                    dir="ltr"
                    style={inputStyle}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.email}</label>
                  <input dir="ltr" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t.gender}</label>
                  <select style={inputStyle} value={gender} onChange={(e) => setGender(e.target.value as JobApplicantGender | '')}>
                    <option value="">—</option>
                    <option value="FEMALE">{t.genderFemale}</option>
                    <option value="MALE">{t.genderMale}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t.marital}</label>
                  <select style={inputStyle} value={marital} onChange={(e) => setMarital(e.target.value as MaritalStatus | '')}>
                    <option value="">—</option>
                    <option value="SINGLE">{t.maritalSingle}</option>
                    <option value="MARRIED">{t.maritalMarried}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t.military}</label>
                  <select style={inputStyle} value={military} onChange={(e) => setMilitary(e.target.value as MilitaryStatus | '')}>
                    <option value="">—</option>
                    <option value="CONSCRIPT">{t.militaryConscript}</option>
                    <option value="EXEMPT">{t.militaryExempt}</option>
                    <option value="WAIVED">{t.militaryWaived}</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>{t.residenceAddress}</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical' }}
                  rows={2}
                  value={residenceAddress}
                  onChange={(e) => setResidenceAddress(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>{t.skills}</label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} />
              </div>

              <RepeatableGroup
                title={t.education}
                addLabel={t.addEducation}
                removeLabel={t.remove}
                entries={eduEntries}
                onChange={setEduEntries}
                fields={[
                  { key: 'degree', placeholder: 'مقطع' },
                  { key: 'field', placeholder: 'رشته تحصیلی' },
                  { key: 'institute', placeholder: 'دانشگاه/مؤسسه' },
                ]}
              />

              <RepeatableGroup
                title={t.work}
                addLabel={t.addWork}
                removeLabel={t.remove}
                entries={workEntries}
                onChange={setWorkEntries}
                fields={[
                  { key: 'company', placeholder: 'نام شرکت' },
                  { key: 'role', placeholder: 'سمت' },
                  { key: 'years', placeholder: 'مدت (سال)' },
                ]}
              />

              <RepeatableGroup
                title={t.languages}
                addLabel={t.addLanguage}
                removeLabel={t.remove}
                entries={langEntries}
                onChange={setLangEntries}
                fields={[
                  { key: 'lang', placeholder: 'زبان' },
                  { key: 'level', placeholder: 'سطح تسلط' },
                ]}
              />

              <div>
                <label style={labelStyle}>
                  {t.resume} <span style={{ color: '#8a96a6' }}>({t.resumeHint})</span>
                </label>
                <input
                  data-testid="apply-resume"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => onResumeChange(e.target.files?.[0] ?? null)}
                />
                {resumeError && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#d64545' }}>{resumeError}</p>}
              </div>

              {error && <p style={{ margin: 0, fontSize: 11.5, color: '#d64545' }}>{error}</p>}

              <button
                type="button"
                data-testid="apply-submit"
                disabled={!canSubmit || submitting}
                onClick={() => void onSubmit()}
                style={{
                  alignSelf: 'flex-start',
                  border: 'none',
                  borderRadius: 11,
                  background: canSubmit && !submitting ? '#1668c4' : '#aab8c8',
                  color: '#fff',
                  padding: '11px 26px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {submitting ? t.submitting : t.submit}
              </button>
            </div>
          )}
        </div>
      </div>
    </PublicPageShell>
  );
}

function RepeatableGroup<T extends Record<string, string | undefined>>({
  title,
  addLabel,
  removeLabel,
  entries,
  onChange,
  fields,
}: {
  title: string;
  addLabel: string;
  removeLabel: string;
  entries: T[];
  onChange: (entries: T[]) => void;
  fields: { key: keyof T; placeholder: string }[];
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{title}</label>
        <button
          type="button"
          onClick={() => onChange([...entries, {} as T])}
          style={{ border: 'none', background: 'none', color: '#1668c4', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {addLabel}
        </button>
      </div>
      {entries.map((entry, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {fields.map((f) => (
            <input
              key={String(f.key)}
              style={{ ...inputStyle, flex: 1 }}
              placeholder={f.placeholder}
              value={entry[f.key] ?? ''}
              onChange={(e) => {
                const next = [...entries];
                next[idx] = { ...next[idx], [f.key]: e.target.value };
                onChange(next);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange(entries.filter((_, i) => i !== idx))}
            style={{ border: 'none', background: 'none', color: '#d64545', fontSize: 11, cursor: 'pointer', flex: 'none' }}
          >
            {removeLabel}
          </button>
        </div>
      ))}
    </div>
  );
}
