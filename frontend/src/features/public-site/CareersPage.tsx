import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { fetchActiveJobs } from '../../api/careers';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { JobSummary, JobType } from '../../types/careers';

const JOB_TYPE_META: Record<JobType, { label: string; color: string; bg: string }> = {
  FULL_TIME: { label: 'تمام‌وقت', color: '#1668c4', bg: '#eef4fb' },
  REMOTE: { label: 'دورکاری', color: '#1f8a5b', bg: '#eef9f1' },
  PART_TIME: { label: 'پاره‌وقت', color: '#c47d1a', bg: '#fbf6ea' },
};

const STR: Record<
  StoredLocale,
  { heroTitle: string; heroDesc: string; applyLabel: string; emptyState: string; loading: string; error: string }
> = {
  fa: {
    heroTitle: 'فرصت‌های شغلی',
    heroDesc: 'به تیم blujet بپیوندید و در رشد صنعت هوانوردی سهیم باشید.',
    applyLabel: 'مشاهده و ارسال درخواست',
    emptyState: 'در حال حاضر فرصت شغلی فعالی وجود ندارد.',
    loading: 'در حال بارگذاری…',
    error: 'خطا در دریافت فرصت‌های شغلی.',
  },
  en: {
    heroTitle: 'Careers',
    heroDesc: 'Join the blujet team and be part of the aviation industry’s growth.',
    applyLabel: 'View & Apply',
    emptyState: 'There are no open positions right now.',
    loading: 'Loading…',
    error: 'Error loading job postings.',
  },
  ar: {
    heroTitle: 'الوظائف',
    heroDesc: 'انضم إلى فريق blujet وكن جزءًا من نمو صناعة الطيران.',
    applyLabel: 'عرض وتقديم الطلب',
    emptyState: 'لا توجد وظائف شاغرة حالياً.',
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
          background: 'linear-gradient(150deg,#0d2640,#124a86)',
          color: '#fff',
          padding: '41px 22px 35px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.5px' }}>
          {t.heroTitle}
        </h1>
        <p style={{ fontSize: 13, color: '#c9dcf3', margin: 0 }}>{t.heroDesc}</p>
      </section>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '31px 22px 55px' }}>
        {error ? (
          <p style={{ textAlign: 'center', color: '#d64545', fontSize: 13 }}>{t.error}</p>
        ) : jobs === null ? (
          <p style={{ textAlign: 'center', color: '#8a96a6', fontSize: 13 }}>{t.loading}</p>
        ) : jobs.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#8a96a6', fontSize: 13 }} data-testid="careers-empty">
            {t.emptyState}
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
              gap: 16,
            }}
          >
            {jobs.map((j) => {
              const meta = JOB_TYPE_META[j.type];
              return (
                <div
                  key={j.id}
                  data-testid="job-card"
                  style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 18px 16px' }}
                >
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0d2640' }}>{j.title}</div>
                  <div style={{ fontSize: 12, color: '#5a6678', marginTop: 6 }}>
                    {j.dept} · {j.city}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: meta.color,
                        background: meta.bg,
                        padding: '4px 12px',
                        borderRadius: 18,
                      }}
                    >
                      {meta.label}
                    </span>
                    <Link
                      to={`/careers/${j.id}/apply`}
                      style={{ fontSize: 12, fontWeight: 700, color: '#1668c4', textDecoration: 'none' }}
                    >
                      {t.applyLabel} ←
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PublicPageShell>
  );
}
