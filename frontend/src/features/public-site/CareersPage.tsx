import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { fetchActiveJobs } from '../../api/careers';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { JobSummary, JobType } from '../../types/careers';

const JOB_TYPE_META: Record<JobType, Record<StoredLocale, { label: string; color: string; bg: string }>> = {
  FULL_TIME: {
    fa: { label: 'تمام‌وقت', color: '#1668c4', bg: '#eef4fb' },
    en: { label: 'Full-time', color: '#1668c4', bg: '#eef4fb' },
    ar: { label: 'دوام كامل', color: '#1668c4', bg: '#eef4fb' },
  },
  REMOTE: {
    fa: { label: 'دورکاری', color: '#1f8a5b', bg: '#eef9f1' },
    en: { label: 'Remote', color: '#1f8a5b', bg: '#eef9f1' },
    ar: { label: 'عن بُعد', color: '#1f8a5b', bg: '#eef9f1' },
  },
  PART_TIME: {
    fa: { label: 'پاره‌وقت', color: '#c47d1a', bg: '#fbf6ea' },
    en: { label: 'Part-time', color: '#c47d1a', bg: '#fbf6ea' },
    ar: { label: 'دوام جزئي', color: '#c47d1a', bg: '#fbf6ea' },
  },
};

const STR: Record<
  StoredLocale,
  {
    heroBadge: string;
    heroTitle: string;
    heroDesc: string;
    activeJobsHeading: string;
    jobCountSuffix: string;
    applyLabel: string;
    emptyTitle: string;
    emptySub: string;
    loading: string;
    error: string;
  }
> = {
  fa: {
    heroBadge: 'به تیم ما بپیوندید',
    heroTitle: 'فرصت‌های شغلی blujet',
    heroDesc: 'در کنار تیمی حرفه‌ای در صنعت هوانوردی رشد کنید. آگهی‌های استخدام فعال را ببینید و رزومهٔ خود را ارسال کنید.',
    activeJobsHeading: 'آگهی‌های استخدام فعال',
    jobCountSuffix: 'فرصت شغلی',
    applyLabel: 'مشاهده و ارسال رزومه',
    emptyTitle: 'در حال حاضر فرصت شغلی فعالی وجود ندارد',
    emptySub: 'به‌زودی آگهی‌های استخدام جدید در همین صفحه منتشر می‌شود.',
    loading: 'در حال بارگذاری…',
    error: 'خطا در دریافت فرصت‌های شغلی.',
  },
  en: {
    heroBadge: 'Join our team',
    heroTitle: 'blujet Careers',
    heroDesc: 'Grow with a professional team in the aviation industry. Browse active openings and submit your résumé.',
    activeJobsHeading: 'Active job openings',
    jobCountSuffix: 'open roles',
    applyLabel: 'View & Apply',
    emptyTitle: 'There are no open positions right now',
    emptySub: 'New job postings will appear on this page soon.',
    loading: 'Loading…',
    error: 'Error loading job postings.',
  },
  ar: {
    heroBadge: 'انضم إلى فريقنا',
    heroTitle: 'وظائف blujet',
    heroDesc: 'انمُ مع فريق محترف في صناعة الطيران. تصفّح الوظائف الشاغرة وقدّم سيرتك الذاتية.',
    activeJobsHeading: 'الوظائف الشاغرة',
    jobCountSuffix: 'فرصة وظيفية',
    applyLabel: 'عرض وتقديم الطلب',
    emptyTitle: 'لا توجد وظائف شاغرة حالياً',
    emptySub: 'ستُنشر إعلانات وظائف جديدة على هذه الصفحة قريباً.',
    loading: 'جارٍ التحميل…',
    error: 'خطأ في جلب الفرص الوظيفية.',
  },
};

export default function CareersPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchActiveJobs()
      .then(setJobs)
      .catch(() => setError(true));
  }, []);

  return (
    <PublicPageShell>
      <section
        style={{
          background: 'linear-gradient(135deg,#0d2640,#16406e)',
          color: '#fff',
          padding: '54px 22px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle at 20% 30%, #fff 0, transparent 45%), radial-gradient(circle at 80% 70%, #fff 0, transparent 40%)' }} />
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, background: '#ffffff1a', border: '1px solid #ffffff2a', padding: '6px 14px', borderRadius: 20, marginBottom: 16, color: '#cfe0f5' }}>
            {t.heroBadge}
          </span>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, margin: '0 0 12px' }}>{t.heroTitle}</h1>
          <p style={{ fontSize: '14.5px', color: '#aac4e2', margin: 0, lineHeight: 1.8 }}>{t.heroDesc}</p>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '44px 26px 80px' }}>
        {error ? (
          <p style={{ textAlign: 'center', color: '#d64545', fontSize: 13 }}>{t.error}</p>
        ) : jobs === null ? (
          <p style={{ textAlign: 'center', color: '#8a96a6', fontSize: 13 }}>{t.loading}</p>
        ) : jobs.length === 0 ? (
          <div data-testid="careers-empty" style={{ textAlign: 'center', padding: '90px 20px', color: '#9aa4b2', background: '#fff', border: '1px solid #eef1f5', borderRadius: 18 }}>
            <div style={{ fontSize: 34, marginBottom: 14 }}>🗂</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#5a6678' }}>{t.emptyTitle}</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{t.emptySub}</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0d2640' }}>{t.activeJobsHeading}</h2>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#7a8794' }}>
                {jobs.length} {t.jobCountSuffix}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(310px,1fr))', gap: 20 }}>
              {jobs.map((j) => {
                const meta = JOB_TYPE_META[j.type][locale];
                return (
                  <Link
                    key={j.id}
                    to={`/careers/${j.id}/apply`}
                    data-testid="job-card"
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit',
                      border: '1px solid #eef1f5',
                      borderRadius: 18,
                      overflow: 'hidden',
                      background: '#fff',
                      boxShadow: '0 14px 34px -22px rgba(13,38,64,.35)',
                    }}
                  >
                    <div style={{ height: 160, borderBottom: '1px solid #eef1f5', background: 'linear-gradient(135deg,#eef3fa,#dbe7f6)', position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          top: 11,
                          right: 11,
                          fontSize: 11,
                          fontWeight: 700,
                          color: meta.color,
                          background: meta.bg,
                          padding: '5px 11px',
                          borderRadius: 18,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div style={{ padding: 18 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#16202e' }}>{j.title}</div>
                      <div style={{ fontSize: '12.5px', color: '#7a8794', marginTop: 8 }}>
                        {j.dept} · {j.city}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #f2f4f7' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1668c4' }}>{t.applyLabel}</span>
                        <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#eef4fb', color: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>←</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </PublicPageShell>
  );
}
