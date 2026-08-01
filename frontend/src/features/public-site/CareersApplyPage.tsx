import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

const PROVINCES_FA = [
  'آذربایجان شرقی', 'آذربایجان غربی', 'اردبیل', 'اصفهان', 'البرز', 'ایلام', 'بوشهر', 'تهران',
  'چهارمحال و بختیاری', 'خراسان جنوبی', 'خراسان رضوی', 'خراسان شمالی', 'خوزستان', 'زنجان', 'سمنان',
  'سیستان و بلوچستان', 'فارس', 'قزوین', 'قم', 'کردستان', 'کرمان', 'کرمانشاه', 'کهگیلویه و بویراحمد',
  'گلستان', 'گیلان', 'لرستان', 'مازندران', 'مرکزی', 'هرمزگان', 'همدان', 'یزد',
];

const LANG_OPTIONS_FA = ['انگلیسی', 'عربی', 'فرانسوی', 'آلمانی', 'ترکی استانبولی', 'اسپانیایی', 'روسی', 'چینی'];
const LEVEL_OPTIONS_FA = ['مبتدی', 'متوسط', 'پیشرفته', 'زبان مادری'];

const STR: Record<
  StoredLocale,
  {
    notFound: string;
    backToCareers: string;
    hiring: string;
    generalReqs: string;
    specialReqs: string;
    personalInfoBar: string;
    personalHeading: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    fatherName: string;
    birthDate: string;
    birthDatePlaceholder: string;
    birthProvince: string;
    birthCity: string;
    gender: string;
    genderFemale: string;
    genderMale: string;
    marital: string;
    maritalSingle: string;
    maritalMarried: string;
    military: string;
    militaryConscript: string;
    militaryWaived: string;
    militaryExempt: string;
    exemptionType: string;
    phone: string;
    email: string;
    residenceProvince: string;
    residenceAddress: string;
    recordsBar: string;
    educationHeading: string;
    addEducation: string;
    workHeading: string;
    addWork: string;
    skillsBar: string;
    skills: string;
    languagesHeading: string;
    addLanguage: string;
    otherLangs: string;
    selectLang: string;
    selectLevel: string;
    resumePick: string;
    resumeHint: string;
    resumeChoose: string;
    submit: string;
    submitting: string;
    sentTitle: string;
    sentBody: string;
    backAfterSent: string;
    remove: string;
    eduMajor: string;
    eduDegree: string;
    eduCourses: string;
    eduOtherCourses: string;
    workCompany: string;
    workRole: string;
    workFrom: string;
    workTo: string;
    workReason: string;
  }
> = {
  fa: {
    notFound: 'این فرصت شغلی یافت نشد یا دیگر فعال نیست.',
    backToCareers: 'بازگشت به فرصت‌های شغلی',
    hiring: 'استخدام',
    generalReqs: 'شرایط احراز عمومی:',
    specialReqs: 'شرایط احراز تخصصی:',
    personalInfoBar: 'اطلاعات شخصی',
    personalHeading: 'اطلاعات فردی',
    firstName: 'نام',
    lastName: 'نام خانوادگی',
    nationalId: 'کد ملی',
    fatherName: 'نام پدر',
    birthDate: 'تاریخ تولد (مثال: ۱۳۷۸/۰۵/۲۱)',
    birthDatePlaceholder: '۱۳۷۰/۰۱/۰۱',
    birthProvince: 'استان محل تولد',
    birthCity: 'شهر محل تولد',
    gender: 'جنسیت:',
    genderFemale: 'خانم',
    genderMale: 'آقا',
    marital: 'وضعیت تاهل:',
    maritalSingle: 'مجرد',
    maritalMarried: 'متاهل',
    military: 'خدمت سربازی:',
    militaryConscript: 'مشمول',
    militaryWaived: 'دارای کارت پایان خدمت',
    militaryExempt: 'معافیت',
    exemptionType: 'نوع معافیت',
    phone: 'شماره تماس',
    email: 'آدرس ایمیل',
    residenceProvince: 'استان محل سکونت',
    residenceAddress: 'آدرس محل سکونت',
    recordsBar: 'سوابق',
    educationHeading: 'سوابق تحصیلی/دوره های آموزشی',
    addEducation: 'افزودن سابقه تحصیلی',
    workHeading: 'تجربه کاری / سوابق',
    addWork: 'افزودن سابقه',
    skillsBar: 'نرم‌افزارها / مهارت‌های تکمیلی',
    skills: 'مهارت های تکمیلی',
    languagesHeading: 'آشنایی با زبان های خارجه',
    addLanguage: 'افزودن زبان',
    otherLangs: 'دیگر زبان ها',
    selectLang: 'انتخاب زبان',
    selectLevel: 'سطح',
    resumePick: 'انتخاب فایل',
    resumeHint: 'لطفاً فایل با پسوند PDF و حجم حداکثر ۳ مگابایت بارگذاری کنید',
    resumeChoose: 'فایلی انتخاب نشده',
    submit: 'ارسال درخواست',
    submitting: 'در حال ارسال…',
    sentTitle: 'درخواست شما با موفقیت ثبت شد',
    sentBody: 'پس از بررسی رزومه توسط واحد منابع انسانی، در صورت تأیید صلاحیت، از طریق شماره تماس یا ایمیل با شما تماس گرفته می‌شود.',
    backAfterSent: 'بازگشت به فرصت‌های شغلی',
    remove: 'حذف',
    eduMajor: 'رشته تحصیلی',
    eduDegree: 'مقطع تحصیلی',
    eduCourses: 'دوره ها و گواهی‌نامه ها',
    eduOtherCourses: 'دوره های آموزشی غیر مرتبط',
    workCompany: 'نام شرکت',
    workRole: 'سمت سازمانی',
    workFrom: 'از سال',
    workTo: 'تا سال',
    workReason: 'علت قطع همکاری',
  },
  en: {
    notFound: 'This position was not found or is no longer active.',
    backToCareers: 'Back to Careers',
    hiring: 'Hiring',
    generalReqs: 'General Requirements:',
    specialReqs: 'Specialized Requirements:',
    personalInfoBar: 'Personal Information',
    personalHeading: 'Personal Details',
    firstName: 'First Name',
    lastName: 'Last Name',
    nationalId: 'National ID',
    fatherName: "Father's Name",
    birthDate: 'Date of Birth (e.g. 1378/05/21)',
    birthDatePlaceholder: '1370/01/01',
    birthProvince: 'Birth Province',
    birthCity: 'Birth City',
    gender: 'Gender:',
    genderFemale: 'Female',
    genderMale: 'Male',
    marital: 'Marital Status:',
    maritalSingle: 'Single',
    maritalMarried: 'Married',
    military: 'Military Service:',
    militaryConscript: 'Conscript',
    militaryWaived: 'Completed Service',
    militaryExempt: 'Exempt',
    exemptionType: 'Exemption Type',
    phone: 'Phone Number',
    email: 'Email Address',
    residenceProvince: 'Residence Province',
    residenceAddress: 'Home Address',
    recordsBar: 'Background',
    educationHeading: 'Education & Training',
    addEducation: 'Add Education',
    workHeading: 'Work Experience',
    addWork: 'Add Experience',
    skillsBar: 'Software & Additional Skills',
    skills: 'Additional Skills',
    languagesHeading: 'Foreign Languages',
    addLanguage: 'Add Language',
    otherLangs: 'Other Languages',
    selectLang: 'Select Language',
    selectLevel: 'Level',
    resumePick: 'Choose File',
    resumeHint: 'Please upload a PDF file up to 3MB',
    resumeChoose: 'No file selected',
    submit: 'Submit Application',
    submitting: 'Submitting…',
    sentTitle: 'Your application was submitted successfully',
    sentBody: 'After HR reviews your resume, we will contact you by phone or email if you are shortlisted.',
    backAfterSent: 'Back to Careers',
    remove: 'Remove',
    eduMajor: 'Field of Study',
    eduDegree: 'Degree',
    eduCourses: 'Courses & Certificates',
    eduOtherCourses: 'Other Training',
    workCompany: 'Company Name',
    workRole: 'Position',
    workFrom: 'From Year',
    workTo: 'To Year',
    workReason: 'Reason for Leaving',
  },
  ar: {
    notFound: 'لم يتم العثور على هذه الوظيفة أو لم تعد نشطة.',
    backToCareers: 'العودة إلى الوظائف',
    hiring: 'التوظيف',
    generalReqs: 'الشروط العامة:',
    specialReqs: 'الشروط التخصصية:',
    personalInfoBar: 'المعلومات الشخصية',
    personalHeading: 'البيانات الشخصية',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    nationalId: 'الرقم الوطني',
    fatherName: 'اسم الأب',
    birthDate: 'تاريخ الميلاد (مثال: ١٣٧٨/٠٥/٢١)',
    birthDatePlaceholder: '١٣٧٠/٠١/٠١',
    birthProvince: 'محافظة الميلاد',
    birthCity: 'مدينة الميلاد',
    gender: 'الجنس:',
    genderFemale: 'أنثى',
    genderMale: 'ذكر',
    marital: 'الحالة الاجتماعية:',
    maritalSingle: 'أعزب',
    maritalMarried: 'متزوج',
    military: 'الخدمة العسكرية:',
    militaryConscript: 'مكلف',
    militaryWaived: 'أنهى الخدمة',
    militaryExempt: 'معفى',
    exemptionType: 'نوع الإعفاء',
    phone: 'رقم الهاتف',
    email: 'البريد الإلكتروني',
    residenceProvince: 'محافظة السكن',
    residenceAddress: 'عنوان السكن',
    recordsBar: 'السجل',
    educationHeading: 'المؤهلات والدورات',
    addEducation: 'إضافة مؤهل',
    workHeading: 'الخبرة العملية',
    addWork: 'إضافة خبرة',
    skillsBar: 'البرمجيات والمهارات',
    skills: 'مهارات إضافية',
    languagesHeading: 'اللغات الأجنبية',
    addLanguage: 'إضافة لغة',
    otherLangs: 'لغات أخرى',
    selectLang: 'اختر اللغة',
    selectLevel: 'المستوى',
    resumePick: 'اختر ملفًا',
    resumeHint: 'يُرجى رفع ملف PDF بحجم أقصى ٣ ميجابايت',
    resumeChoose: 'لم يُختر ملف',
    submit: 'إرسال الطلب',
    submitting: 'جارٍ الإرسال…',
    sentTitle: 'تم إرسال طلبك بنجاح',
    sentBody: 'بعد مراجعة السيرة الذاتية، سنتواصل معك عبر الهاتف أو البريد إذا تم قبولك للمرحلة التالية.',
    backAfterSent: 'العودة إلى الوظائف',
    remove: 'إزالة',
    eduMajor: 'التخصص',
    eduDegree: 'الدرجة',
    eduCourses: 'الدورات والشهادات',
    eduOtherCourses: 'دورات أخرى',
    workCompany: 'اسم الشركة',
    workRole: 'المنصب',
    workFrom: 'من سنة',
    workTo: 'إلى سنة',
    workReason: 'سبب المغادرة',
  },
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 46,
  border: '1.5px solid #e2e7ee',
  borderRadius: 11,
  background: '#fafbfd',
  padding: '0 12px',
  fontFamily: 'inherit',
  fontSize: '12.5px',
  outline: 'none',
  color: '#16202e',
};

function sectionBar(label: string) {
  return (
    <div style={{ background: '#eef1f5', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, color: '#5a6678', marginBottom: 22 }}>
      {label}
    </div>
  );
}

function addButton(label: string, onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-block',
        border: 'none',
        fontSize: '12.5px',
        fontWeight: 700,
        color: '#fff',
        background: '#1668c4',
        padding: '10px 16px',
        borderRadius: 9,
        cursor: 'pointer',
        fontFamily: 'inherit',
        marginBottom: 30,
      }}
    >
      {label}
    </button>
  );
}

export default function CareersApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const fileRef = useRef<HTMLInputElement>(null);

  const [job, setJob] = useState<JobDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthProvince, setBirthProvince] = useState('');
  const [birthCity, setBirthCity] = useState('');
  const [gender, setGender] = useState<JobApplicantGender | ''>('');
  const [marital, setMarital] = useState<MaritalStatus | ''>('');
  const [military, setMilitary] = useState<MilitaryStatus | ''>('');
  const [exemptionType, setExemptionType] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [residenceProvince, setResidenceProvince] = useState('');
  const [residenceAddress, setResidenceAddress] = useState('');
  const [skills, setSkills] = useState('');
  const [otherLangs, setOtherLangs] = useState('');
  const [eduEntries, setEduEntries] = useState<EducationEntry[]>([{ field: '', degree: '', courses: '', otherCourses: '' }]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([{ company: '', role: '', fromYear: '', toYear: '', reason: '' }]);
  const [langEntries, setLangEntries] = useState<LanguageEntry[]>([{ lang: '', level: '' }]);
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cols4 = isMobile ? '1fr' : 'repeat(4,1fr)';
  const cols3 = isMobile ? '1fr' : 'repeat(3,1fr)';
  const cols2 = isMobile ? '1fr' : '1fr 1fr';

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
      const cleanEdu = eduEntries.filter((e) => Object.values(e).some((v) => v?.trim()));
      const cleanWork = workEntries.filter((e) => Object.values(e).some((v) => v?.trim()));
      const cleanLang = langEntries.filter((e) => e.lang?.trim() || e.level?.trim());
      await applyToJob(jobId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nationalId: nationalId.trim(),
        fatherName: fatherName.trim() || undefined,
        birthDate: isoBirthDate ?? undefined,
        birthProvince: birthProvince || undefined,
        birthCity: birthCity.trim() || undefined,
        gender: gender || undefined,
        marital: marital || undefined,
        military: military || undefined,
        exemptionType: military === 'EXEMPT' ? exemptionType.trim() || undefined : undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        residenceProvince: residenceProvince || undefined,
        residenceAddress: residenceAddress.trim() || undefined,
        skills: skills.trim() || undefined,
        otherLangs: otherLangs.trim() || undefined,
        eduEntries: cleanEdu.length ? cleanEdu : undefined,
        workEntries: cleanWork.length ? cleanWork : undefined,
        langEntries: cleanLang.length ? cleanLang : undefined,
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
          <Link to="/careers" style={{ display: 'inline-block', marginTop: 16, color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
            {t.backToCareers}
          </Link>
        </div>
      </PublicPageShell>
    );
  }

  if (sent) {
    return (
      <PublicPageShell>
        <div style={{ background: '#eef3fa', borderBottom: '1px solid #e6eaf0' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 26px' }}>
            <Link to="/careers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12.5px', fontWeight: 700, color: '#1668c4', textDecoration: 'none' }}>
              ← {t.backToCareers}
            </Link>
          </div>
        </div>
        <section style={{ maxWidth: 640, margin: '70px auto', padding: '0 26px', textAlign: 'center' }}>
          <div data-testid="apply-sent" style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: '44px 30px' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', background: '#eef9f1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#1f8a5b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✓</span>
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 8px' }}>{t.sentTitle}</h2>
            <p style={{ fontSize: '13.5px', color: '#7a8794', margin: 0 }}>{t.sentBody}</p>
            <Link
              to="/careers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 22,
                fontSize: '13.5px',
                fontWeight: 800,
                color: '#fff',
                background: 'linear-gradient(135deg,#1668c4,#0d3b66)',
                padding: '13px 26px',
                borderRadius: 12,
                textDecoration: 'none',
                boxShadow: '0 14px 28px -12px rgba(22,104,196,.55)',
              }}
            >
              ← {t.backAfterSent}
            </Link>
          </div>
        </section>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <div style={{ background: '#eef3fa', borderBottom: '1px solid #e6eaf0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 26px' }}>
          <Link to="/careers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12.5px', fontWeight: 700, color: '#1668c4', textDecoration: 'none' }}>
            ← {t.backToCareers}
          </Link>
        </div>
      </div>

      <section style={{ background: '#fff', borderBottom: '1px solid #eef1f5', padding: '26px 22px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 78, height: 78, borderRadius: 14, background: '#eef3fa', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            💼
          </div>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#9aa4b2' }}>{t.hiring}</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: '4px 0 0' }}>{job?.title ?? '…'}</h1>
            {job && (
              <div style={{ fontSize: '12.5px', color: '#7a8794', marginTop: 4 }}>
                {job.dept} · {job.city}
              </div>
            )}
          </div>
        </div>
      </section>

      {job && (job.generalReqs.length > 0 || job.specialReqs.length > 0) && (
        <section style={{ maxWidth: 900, margin: '30px auto 0', padding: '0 26px', display: 'grid', gridTemplateColumns: cols2, gap: 26 }}>
          {job.generalReqs.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, margin: '0 0 12px' }}>{t.generalReqs}</h3>
              <ul style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13, color: '#3b4554', lineHeight: 1.7 }}>
                {job.generalReqs.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {job.specialReqs.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, margin: '0 0 12px' }}>{t.specialReqs}</h3>
              <ul style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13, color: '#3b4554', lineHeight: 1.7 }}>
                {job.specialReqs.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section style={{ maxWidth: 900, margin: '34px auto 70px', padding: '0 26px' }}>
        {sectionBar(t.personalInfoBar)}
        <h3 style={{ fontSize: '15.5px', fontWeight: 800, margin: '0 0 16px' }}>{t.personalHeading}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: cols4, gap: 11, marginBottom: 14 }}>
          <input data-testid="apply-firstName" style={inputStyle} placeholder={t.firstName} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input data-testid="apply-lastName" style={inputStyle} placeholder={t.lastName} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input data-testid="apply-nationalId" dir="ltr" style={inputStyle} placeholder={t.nationalId} value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          <input style={inputStyle} placeholder={t.fatherName} value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: 11, marginBottom: 18 }}>
          <input dir="ltr" style={inputStyle} placeholder={t.birthDate} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <select style={inputStyle} value={birthProvince} onChange={(e) => setBirthProvince(e.target.value)}>
            <option value="">{t.birthProvince}</option>
            {PROVINCES_FA.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input style={inputStyle} placeholder={t.birthCity} value={birthCity} onChange={(e) => setBirthCity(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: 22, marginBottom: 20 }}>
          <RadioGroup label={t.gender} value={gender} onChange={(v) => setGender(v as JobApplicantGender)} options={[
            { value: 'FEMALE', label: t.genderFemale },
            { value: 'MALE', label: t.genderMale },
          ]} />
          <RadioGroup label={t.marital} value={marital} onChange={(v) => setMarital(v as MaritalStatus)} options={[
            { value: 'SINGLE', label: t.maritalSingle },
            { value: 'MARRIED', label: t.maritalMarried },
          ]} />
          <div>
            <RadioGroup label={t.military} value={military} onChange={(v) => setMilitary(v as MilitaryStatus)} options={[
              { value: 'CONSCRIPT', label: t.militaryConscript },
              { value: 'WAIVED', label: t.militaryWaived },
              { value: 'EXEMPT', label: t.militaryExempt },
            ]} wrap />
            {military === 'EXEMPT' && (
              <input style={{ ...inputStyle, marginTop: 9, height: 40 }} placeholder={t.exemptionType} value={exemptionType} onChange={(e) => setExemptionType(e.target.value)} />
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: 11, marginBottom: 11 }}>
          <input data-testid="apply-phone" dir="ltr" style={inputStyle} placeholder={t.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input dir="ltr" style={inputStyle} placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
          <select style={inputStyle} value={residenceProvince} onChange={(e) => setResidenceProvince(e.target.value)}>
            <option value="">{t.residenceProvince}</option>
            {PROVINCES_FA.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <input style={{ ...inputStyle, marginBottom: 26 }} placeholder={t.residenceAddress} value={residenceAddress} onChange={(e) => setResidenceAddress(e.target.value)} />

        {sectionBar(t.recordsBar)}

        <h3 style={{ fontSize: '14.5px', fontWeight: 800, margin: '0 0 14px' }}>{t.educationHeading}</h3>
        {eduEntries.map((entry, idx) => (
          <div key={idx} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px dashed #e2e7ee' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 11, marginBottom: 11 }}>
              <input style={inputStyle} placeholder={t.eduMajor} value={entry.field ?? ''} onChange={(e) => patchEntry(setEduEntries, eduEntries, idx, 'field', e.target.value)} />
              <input style={inputStyle} placeholder={t.eduDegree} value={entry.degree ?? ''} onChange={(e) => patchEntry(setEduEntries, eduEntries, idx, 'degree', e.target.value)} />
            </div>
            <input style={{ ...inputStyle, marginBottom: 11 }} placeholder={t.eduCourses} value={entry.courses ?? ''} onChange={(e) => patchEntry(setEduEntries, eduEntries, idx, 'courses', e.target.value)} />
            <input style={inputStyle} placeholder={t.eduOtherCourses} value={entry.otherCourses ?? ''} onChange={(e) => patchEntry(setEduEntries, eduEntries, idx, 'otherCourses', e.target.value)} />
          </div>
        ))}
        {addButton(t.addEducation, () => setEduEntries([...eduEntries, { field: '', degree: '', courses: '', otherCourses: '' }]))}

        <h3 style={{ fontSize: '14.5px', fontWeight: 800, margin: '0 0 14px' }}>{t.workHeading}</h3>
        {workEntries.map((entry, idx) => (
          <div key={idx} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px dashed #e2e7ee' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap: 11, marginBottom: 11 }}>
              <input style={inputStyle} placeholder={t.workCompany} value={entry.company ?? ''} onChange={(e) => patchEntry(setWorkEntries, workEntries, idx, 'company', e.target.value)} />
              <input style={inputStyle} placeholder={t.workRole} value={entry.role ?? ''} onChange={(e) => patchEntry(setWorkEntries, workEntries, idx, 'role', e.target.value)} />
              <input style={inputStyle} placeholder={t.workFrom} value={entry.fromYear ?? ''} onChange={(e) => patchEntry(setWorkEntries, workEntries, idx, 'fromYear', e.target.value)} />
              <input style={inputStyle} placeholder={t.workTo} value={entry.toYear ?? ''} onChange={(e) => patchEntry(setWorkEntries, workEntries, idx, 'toYear', e.target.value)} />
            </div>
            <input style={inputStyle} placeholder={t.workReason} value={entry.reason ?? ''} onChange={(e) => patchEntry(setWorkEntries, workEntries, idx, 'reason', e.target.value)} />
          </div>
        ))}
        {addButton(t.addWork, () => setWorkEntries([...workEntries, { company: '', role: '', fromYear: '', toYear: '', reason: '' }]))}

        <div style={{ margin: '26px 0 22px' }}>{sectionBar(t.skillsBar)}</div>
        <input style={{ ...inputStyle, marginBottom: 30 }} placeholder={t.skills} value={skills} onChange={(e) => setSkills(e.target.value)} />

        <h3 style={{ fontSize: '15.5px', fontWeight: 800, margin: '0 0 16px' }}>{t.languagesHeading}</h3>
        {langEntries.map((entry, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: cols2, gap: 11, marginBottom: 11 }}>
            <select style={inputStyle} value={entry.lang ?? ''} onChange={(e) => patchEntry(setLangEntries, langEntries, idx, 'lang', e.target.value)}>
              <option value="">{t.selectLang}</option>
              {LANG_OPTIONS_FA.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select style={inputStyle} value={entry.level ?? ''} onChange={(e) => patchEntry(setLangEntries, langEntries, idx, 'level', e.target.value)}>
              <option value="">{t.selectLevel}</option>
              {LEVEL_OPTIONS_FA.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        ))}
        {addButton(t.addLanguage, () => setLangEntries([...langEntries, { lang: '', level: '' }]))}
        <input style={{ ...inputStyle, marginBottom: 26 }} placeholder={t.otherLangs} value={otherLangs} onChange={(e) => setOtherLangs(e.target.value)} />

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
          style={{ border: '1.5px dashed #c7d0dc', borderRadius: 13, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 26 }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>⤒</div>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: resume ? '#1668c4' : '#3b4554' }}>
            {resume?.name ?? t.resumeChoose}
          </div>
          <div style={{ fontSize: '11.5px', color: '#9aa4b2', marginTop: 6 }}>{t.resumeHint}</div>
          <span style={{ display: 'inline-block', marginTop: 12, fontSize: 12, fontWeight: 700, border: '1px solid #d7dee7', borderRadius: 9, padding: '8px 16px', color: '#3b4554' }}>
            {t.resumePick}
          </span>
          <input
            ref={fileRef}
            data-testid="apply-resume"
            type="file"
            accept="application/pdf"
            onChange={(e) => onResumeChange(e.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
        </div>
        {resumeError && <p style={{ margin: '-18px 0 16px', fontSize: '11.5px', color: '#d64545' }}>{resumeError}</p>}

        {error && <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: '#d64545' }}>{error}</p>}

        <button
          type="button"
          data-testid="apply-submit"
          disabled={!canSubmit || submitting}
          onClick={() => void onSubmit()}
          style={{
            width: '100%',
            height: 52,
            border: 'none',
            borderRadius: 12,
            background: canSubmit && !submitting ? '#1668c4' : '#aab8c8',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </section>
    </PublicPageShell>
  );
}

function patchEntry<T extends Record<string, string | undefined>>(
  setter: (entries: T[]) => void,
  entries: T[],
  idx: number,
  key: keyof T,
  value: string,
) {
  const next = [...entries];
  next[idx] = { ...next[idx], [key]: value };
  setter(next);
}

function RadioGroup({
  label,
  value,
  onChange,
  options,
  wrap,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  wrap?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: 9 }}>{label}</div>
      <div style={{ display: 'flex', gap: 16, fontSize: '12.5px', flexWrap: wrap ? 'wrap' : undefined }}>
        {options.map((opt) => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="radio" name={label} checked={value === opt.value} onChange={() => onChange(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
