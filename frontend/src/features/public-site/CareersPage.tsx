import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { fetchActiveJobs } from '../../api/careers';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { faDigits } from '../../lib/fa-format';
import type { JobSummary, JobType } from '../../types/careers';
import { jobPostingImageUrl } from './site-content-shared';

const JOB_TYPE_META: Record<JobType, { label: string; color: string; bg: string }> = {
  FULL_TIME: { label: 'تمام‌وقت', color: '#34d399', bg: 'rgba(16,185,129,.14)' },
  REMOTE: { label: 'دورکاری', color: '#60a5fa', bg: 'rgba(59,130,246,.14)' },
  PART_TIME: { label: 'پاره‌وقت', color: '#f59e0b', bg: 'rgba(245,158,11,.14)' },
};

const STR: Record<
  StoredLocale,
  {
    badge: string;
    heroTitle: string;
    heroDesc: string;
    listHeading: string;
    jobCountSuffix: string;
    applyLabel: string;
    emptyTitle: string;
    emptyBody: string;
    loading: string;
    error: string;
  }
> = {
  fa: {
    badge: 'به تیم ما بپیوندید',
    heroTitle: 'فرصت‌های شغلی blujet',
    heroDesc:
      'در کنار تیمی حرفه‌ای در صنعت هوانوردی رشد کنید. آگهی‌های استخدام فعال را ببینید و رزومهٔ خود را ارسال کنید.',
    listHeading: 'آگهی‌های استخدام فعال',
    jobCountSuffix: 'فرصت شغلی',
    applyLabel: 'مشاهده و ارسال رزومه',
    emptyTitle: 'در حال حاضر فرصت شغلی فعالی وجود ندارد',
    emptyBody: 'به‌زودی آگهی‌های استخدام جدید در همین صفحه منتشر می‌شود.',
    loading: 'در حال بارگذاری…',
    error: 'خطا در دریافت فرصت‌های شغلی.',
  },
  en: {
    badge: 'Join our team',
    heroTitle: 'blujet Careers',
    heroDesc: 'Grow with a professional aviation team. Browse open roles and submit your resume.',
    listHeading: 'Open positions',
    jobCountSuffix: 'open roles',
    applyLabel: 'View & apply',
    emptyTitle: 'There are no open positions right now',
    emptyBody: 'New job postings will appear here soon.',
    loading: 'Loading…',
    error: 'Error loading job postings.',
  },
  ar: {
    badge: 'انضم إلى فريقنا',
    heroTitle: 'الوظائف في blujet',
    heroDesc: 'انمُ مع فريق محترف في قطاع الطيران. تصفّح الوظائف وأرسل سيرتك الذاتية.',
    listHeading: 'الوظائف المتاحة',
    jobCountSuffix: 'فرصة وظيفية',
    applyLabel: 'عرض وإرسال السيرة',
    emptyTitle: 'لا توجد وظائف شاغرة حالياً',
    emptyBody: 'ستُنشر إعلانات التوظيف الجديدة هنا قريباً.',
    loading: 'جارٍ التحميل…',
    error: 'خطأ في جلب الفرص الوظيفية.',
  },
};

function formatCount(n: number, locale: StoredLocale): string {
  return locale === 'en' ? String(n) : faDigits(n);
}

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
          padding: isMobile ? '40px 18px' : '54px 22px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              'radial-gradient(circle at 20% 30%, #fff 0, transparent 45%), radial-gradient(circle at 80% 70%, #fff 0, transparent 40%)',
          }}
        />
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 12,
              fontWeight: 700,
              background: '#ffffff1a',
              border: '1px solid #ffffff2a',
              padding: '6px 14px',
              borderRadius: 20,
              marginBottom: 16,
              color: '#cfe0f5',
            }}
          >
            {t.badge}
          </span>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, margin: '0 0 12px' }}>{t.heroTitle}</h1>
          <p style={{ fontSize: 14.5, color: '#aac4e2', margin: 0, lineHeight: 1.8 }}>{t.heroDesc}</p>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '28px 16px 64px' : '44px 26px 80px' }}>
        {error ? (
          <p style={{ textAlign: 'center', color: '#d64545', fontSize: 13 }}>{t.error}</p>
        ) : jobs === null ? (
          <p style={{ textAlign: 'center', color: '#8a96a6', fontSize: 13 }}>{t.loading}</p>
        ) : jobs.length === 0 ? (
          <div
            data-testid="careers-empty"
            style={{
              textAlign: 'center',
              padding: '90px 20px',
              color: '#9aa4b2',
              background: '#fff',
              border: '1px solid #eef1f5',
              borderRadius: 18,
            }}
          >
            <div style={{ fontSize: 34, marginBottom: 14 }}>🗂</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#5a6678' }}>{t.emptyTitle}</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{t.emptyBody}</div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 22,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#16202e' }}>{t.listHeading}</h2>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7a8794' }}>
                {formatCount(jobs.length, locale)} {t.jobCountSuffix}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(310px,1fr))',
                gap: 20,
              }}
            >
              {jobs.map((j) => {
                const meta = JOB_TYPE_META[j.type];
                const img = jobPostingImageUrl(j.imageUrl, j.imageFileId);
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
                    <div
                      style={{
                        height: 160,
                        borderBottom: '1px solid #eef1f5',
                        background: '#eef3fa',
                        position: 'relative',
                      }}
                    >
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : null}
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
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          color: '#7a8794',
                          marginTop: 8,
                        }}
                      >
                        {j.dept} · {j.city}
                      </div>
                      {j.description ? (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: '#5a6678',
                            marginTop: 10,
                            lineHeight: 1.7,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {j.description}
                        </div>
                      ) : null}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 16,
                          paddingTop: 14,
                          borderTop: '1px solid #f2f4f7',
                        }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1668c4' }}>{t.applyLabel}</span>
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            background: '#eef4fb',
                            color: '#1668c4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          ←
                        </span>
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
