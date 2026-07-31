import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitClubCardRequest } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faDigits } from '../../lib/fa-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { ClubMembershipView } from '../../types/club-membership';

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const TIER_LABEL: Record<string, Tr> = {
  SILVER: { fa: 'نقره‌ای', en: 'Silver', ar: 'فضية' },
  GOLD: { fa: 'طلایی', en: 'Gold', ar: 'ذهبية' },
  PLATINUM: { fa: 'پلاتین', en: 'Platinum', ar: 'بلاتينية' },
};

const TIER_STYLE = {
  SILVER: {
    bannerBg: 'linear-gradient(135deg,#aab4c0,#717d8c)',
    main: '#8a96a6',
    border: '#dde2e8',
    soft: '#f4f6f8',
    text: '#4a5568',
    subtext: '#6b7787',
  },
  GOLD: {
    bannerBg: 'linear-gradient(135deg,#caa53a,#9a7d22)',
    main: '#caa53a',
    border: '#f0dfa8',
    soft: '#fdf8ea',
    text: '#8a6d1f',
    subtext: '#a1801f',
  },
  PLATINUM: {
    bannerBg: 'linear-gradient(135deg,#7c5cd6,#4f3596)',
    main: '#7c5cd6',
    border: '#dcd2f5',
    soft: '#f4f1fc',
    text: '#4f3596',
    subtext: '#6b52ad',
  },
} as const;

const CLUB_STR: Record<StoredLocale, {
  notMemberText: string;
  joinFreeBtn: string;
  lblYourTier: string;
  lblCurrentPoints: string;
  membershipShort: (tier: string) => string;
  tierProgress: (from: string, to: string, next: string) => { from: string; to: string; next: string };
  hdrClubCard: string;
  subClubCard: string;
  lblYourPoints: string;
  lblRequiredThreshold: string;
  cardIssuedLabel: string;
  btnDownloadCard: string;
  btnRequestCard: string;
  eligibleTitle: (tier: string) => string;
  eligibleSub: (points: string) => string;
  lockedTitle: (tier: string) => string;
  lockedSub: (needed: string) => string;
  cardStatus: Record<string, string>;
  stepLabels: Record<string, string>;
  hdrTierBenefits: string;
  benefits: { title: string; desc: string }[];
  btnFullClubIntro: string;
  requestSuccess: string;
  requestErrorFallback: string;
  requestingBtn: string;
}> = {
  fa: {
    notMemberText: 'هنوز عضو باشگاه مشتریان نیستید.',
    joinFreeBtn: 'عضویت رایگان',
    lblYourTier: 'سطح عضویت شما',
    lblCurrentPoints: 'امتیاز فعلی',
    membershipShort: (tier) => `عضو ${tier}`,
    tierProgress: (from, to, next) => ({ from, to, next }),
    hdrClubCard: 'کارت عضویت باشگاه',
    subClubCard: 'با رسیدن به ۵٬۰۰۰ امتیاز واجد شرایط دریافت کارت می‌شوید؛ درخواست برای ادمین ارسال و پس از تأیید مدیران کارت صادر می‌شود.',
    lblYourPoints: 'امتیاز شما',
    lblRequiredThreshold: 'حد نصاب',
    cardIssuedLabel: 'کارت عضویت صادر شد',
    btnDownloadCard: 'دانلود کارت',
    btnRequestCard: 'درخواست صدور کارت عضویت',
    eligibleTitle: (tier) => `کارت ${tier} را دارید!`,
    eligibleSub: (points) => `با ${points} امتیاز، واجد شرایط دریافت کارت عضویت هستید.`,
    lockedTitle: (tier) => `کارت ${tier} — هنوز واجد شرایط نیستید`,
    lockedSub: (needed) => `${needed} امتیاز دیگر تا حد نصاب دریافت کارت.`,
    cardStatus: {
      NONE: 'درخواستی ثبت نشده',
      REVIEW: 'در حال بررسی',
      ISSUED: 'کارت صادر شده',
    },
    stepLabels: {
      submitted: 'ثبت درخواست صدور کارت',
      referred: 'ارجاع برای تأیید مدیران',
      approved: 'تأیید و صدور کارت',
      rejected: 'رد درخواست',
    },
    hdrTierBenefits: 'مزایای سطح عضویت',
    benefits: [
      { title: 'ارتقای رایگان به بیزینس', desc: 'در پروازهای منتخب' },
      { title: 'تا ۵٪ کش‌بک بیشتر', desc: 'روی هر خرید بلیط' },
      { title: 'پذیرش اختصاصی فرودگاه', desc: 'بدون صف، سریع‌تر' },
      { title: '۲ برابر امتیاز', desc: 'در فصل‌های پرسفر' },
    ],
    btnFullClubIntro: 'معرفی کامل باشگاه مشتریان',
    requestSuccess: 'درخواست صدور کارت عضویت ثبت و برای ادمین ارسال شد ✓',
    requestErrorFallback: 'خطا در ثبت درخواست کارت.',
    requestingBtn: 'در حال ثبت…',
  },
  en: {
    notMemberText: "You're not a loyalty club member yet.",
    joinFreeBtn: 'Join Free',
    lblYourTier: 'Your Tier',
    lblCurrentPoints: 'Current Points',
    membershipShort: (tier) => `${tier} Member`,
    tierProgress: (from, to, next) => ({ from, to, next }),
    hdrClubCard: 'Loyalty Club Card',
    subClubCard: 'You qualify for a card at 5,000 points; your request is sent to the admin and issued once approved.',
    lblYourPoints: 'Your points',
    lblRequiredThreshold: 'Required threshold',
    cardIssuedLabel: 'Membership card issued',
    btnDownloadCard: 'Download Card',
    btnRequestCard: 'Request Membership Card',
    eligibleTitle: (tier) => `You're eligible for the ${tier} card!`,
    eligibleSub: (points) => `With ${points} points, you qualify for a membership card.`,
    lockedTitle: (tier) => `${tier} card — not yet eligible`,
    lockedSub: (needed) => `${needed} more points until the card threshold.`,
    cardStatus: {
      NONE: 'No request submitted',
      REVIEW: 'Under Review',
      ISSUED: 'Card Issued',
    },
    stepLabels: {
      submitted: 'Card request submitted',
      referred: 'Referred for manager approval',
      approved: 'Approved & card issued',
      rejected: 'Request rejected',
    },
    hdrTierBenefits: 'Tier Benefits',
    benefits: [
      { title: 'Free upgrade to Business', desc: 'On select flights' },
      { title: 'Up to 5% extra cashback', desc: 'On every ticket purchase' },
      { title: 'Priority airport check-in', desc: 'No lines, faster service' },
      { title: '2x points', desc: 'During peak travel seasons' },
    ],
    btnFullClubIntro: 'Full Club Introduction',
    requestSuccess: 'Your membership card request was submitted ✓',
    requestErrorFallback: 'Error submitting card request.',
    requestingBtn: 'Submitting…',
  },
  ar: {
    notMemberText: 'لست عضواً في نادي الولاء بعد.',
    joinFreeBtn: 'انضم مجاناً',
    lblYourTier: 'مستوى عضويتك',
    lblCurrentPoints: 'النقاط الحالية',
    membershipShort: (tier) => `عضو ${tier}`,
    tierProgress: (from, to, next) => ({ from, to, next }),
    hdrClubCard: 'بطاقة عضوية النادي',
    subClubCard: 'عند الوصول إلى 5000 نقطة تصبح مؤهلاً للبطاقة؛ يُرسل الطلب للإدارة ويُصدر بعد الموافقة.',
    lblYourPoints: 'نقاطك',
    lblRequiredThreshold: 'الحد الأدنى',
    cardIssuedLabel: 'تم إصدار بطاقة العضوية',
    btnDownloadCard: 'تنزيل البطاقة',
    btnRequestCard: 'طلب بطاقة العضوية',
    eligibleTitle: (tier) => `أنت مؤهل لبطاقة ${tier}!`,
    eligibleSub: (points) => `بـ ${points} نقطة، أنت مؤهل لبطاقة العضوية.`,
    lockedTitle: (tier) => `بطاقة ${tier} — غير مؤهل بعد`,
    lockedSub: (needed) => `${needed} نقطة أخرى حتى حد البطاقة.`,
    cardStatus: {
      NONE: 'لم يُقدَّم طلب',
      REVIEW: 'قيد المراجعة',
      ISSUED: 'تم إصدار البطاقة',
    },
    stepLabels: {
      submitted: 'تقديم طلب البطاقة',
      referred: 'إحالة للموافقة الإدارية',
      approved: 'تمت الموافقة وإصدار البطاقة',
      rejected: 'رفض الطلب',
    },
    hdrTierBenefits: 'مزايا المستوى',
    benefits: [
      { title: 'ترقية مجانية إلى درجة الأعمال', desc: 'في رحلات مختارة' },
      { title: 'حتى 5٪ استرداد إضافي', desc: 'على كل شراء تذكرة' },
      { title: 'تسجيل وصول أولوية', desc: 'بدون طوابير' },
      { title: 'نقاط مضاعفة', desc: 'في مواسم السفر' },
    ],
    btnFullClubIntro: 'مقدمة كاملة عن النادي',
    requestSuccess: 'تم تقديم طلب بطاقة العضوية ✓',
    requestErrorFallback: 'خطأ في تقديم طلب البطاقة.',
    requestingBtn: 'جارٍ التقديم…',
  },
};

function tierProgressInfo(membership: ClubMembershipView, locale: StoredLocale) {
  const { level, balance, tierRules } = membership;
  const tierName = TIER_LABEL[level ?? 'SILVER']?.[locale] ?? level ?? '';
  const gMin = tierRules.goldMinPoints;
  const pMin = tierRules.platinumMinPoints;

  if (level === 'PLATINUM') {
    return {
      membershipShort: CLUB_STR[locale].membershipShort(tierName),
      from: TIER_LABEL.PLATINUM[locale],
      to: TIER_LABEL.PLATINUM[locale],
      next: locale === 'en' ? 'Highest club tier' : locale === 'ar' ? 'أعلى مستوى في النادي' : 'بالاترین سطح باشگاه',
      progressPct: 100,
      style: TIER_STYLE.PLATINUM,
    };
  }
  if (level === 'GOLD') {
    const remaining = Math.max(pMin - balance, 0);
    return {
      membershipShort: CLUB_STR[locale].membershipShort(tierName),
      from: TIER_LABEL.GOLD[locale],
      to: TIER_LABEL.PLATINUM[locale],
      next: locale === 'en'
        ? `To Platinum: ${faDigits(remaining)} more points`
        : locale === 'ar'
          ? `حتى البلاتين: ${faDigits(remaining)} نقطة أخرى`
          : `تا پلاتین: ${faDigits(remaining)} امتیاز دیگر`,
      progressPct: Math.min(100, Math.round((balance / pMin) * 100)),
      style: TIER_STYLE.GOLD,
    };
  }
  const remaining = Math.max(gMin - balance, 0);
  return {
    membershipShort: CLUB_STR[locale].membershipShort(tierName),
    from: TIER_LABEL.SILVER[locale],
    to: TIER_LABEL.GOLD[locale],
    next: locale === 'en'
      ? `To Gold: ${faDigits(remaining)} more points`
      : locale === 'ar'
        ? `حتى الذهبية: ${faDigits(remaining)} نقطة أخرى`
        : `تا طلایی: ${faDigits(remaining)} امتیاز دیگر`,
    progressPct: Math.min(100, Math.round((balance / gMin) * 100)),
    style: level === 'GOLD' ? TIER_STYLE.GOLD : TIER_STYLE.SILVER,
  };
}

function cardStatusStyle(status: string | null) {
  if (status === 'ISSUED') return { color: '#1f8a5b', bg: 'rgba(31,138,91,.1)' };
  if (status === 'REVIEW') return { color: '#b5790f', bg: 'rgba(181,121,15,.1)' };
  return { color: '#5a6678', bg: '#f2f4f7' };
}

interface Props {
  membership: ClubMembershipView | null;
  onMembershipChange: (m: ClubMembershipView) => void;
}

export default function AccountClubTab({ membership, onMembershipChange }: Props) {
  const { locale } = useLocale();
  const t = CLUB_STR[locale];
  const [requestBusy, setRequestBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  if (!membership?.isMember) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 18, padding: '40px 26px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#6b7787', marginBottom: 14 }}>{t.notMemberText}</p>
        <Link to="/club" style={{ background: '#1668c4', color: '#fff', padding: '10px 24px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, textDecoration: 'none' }}>
          {t.joinFreeBtn}
        </Link>
      </div>
    );
  }

  const tierInfo = tierProgressInfo(membership, locale);
  const tierStyle = tierInfo.style;
  const cardProgress = Math.min(
    100,
    Math.round((membership.balance / membership.tierRules.cardRequestMinPoints) * 100),
  );
  const cardIssued = membership.cardStatus === 'ISSUED';
  const showTracker = !!membership.cardRequest;
  const cardSt = cardStatusStyle(membership.cardStatus);
  const eligibleTier = TIER_LABEL[membership.level ?? 'GOLD']?.[locale] ?? membership.level ?? '';

  async function onRequestCard() {
    setRequestBusy(true);
    setRequestError(null);
    setNotice(null);
    try {
      const req = await submitClubCardRequest();
      onMembershipChange({
        ...membership,
        cardStatus: 'REVIEW',
        cardRequest: req,
        canRequestCard: false,
      });
      setNotice(t.requestSuccess);
    } catch (err) {
      setRequestError(err instanceof ApiRequestError ? err.message : t.requestErrorFallback);
    } finally {
      setRequestBusy(false);
    }
  }

  const historySteps = (membership.cardRequest?.history ?? []).map((step, i, arr) => ({
    ...step,
    label: t.stepLabels[step.step] ?? step.labelFa,
    done: i < arr.length,
    dotBg: '#1f8a5b',
    lineBg: i < arr.length - 1 ? '#bfe6cf' : 'transparent',
    textColor: '#0d2640',
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: tierInfo.style.bannerBg, color: '#fff', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 13 }}>
          <div>
            <div style={{ fontSize: 11.5, opacity: 0.9 }}>{t.lblYourTier}</div>
            <div style={{ fontSize: 23.5, fontWeight: 900, marginTop: 4 }}>{tierInfo.membershipShort}</div>
          </div>
          <div style={{ textAlign: locale === 'en' ? 'right' : 'left' }}>
            <div style={{ fontSize: 11.5, opacity: 0.9 }}>{t.lblCurrentPoints}</div>
            <div style={{ fontSize: 23.5, fontWeight: 900, marginTop: 4 }}>{faDigits(membership.balance)}</div>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, opacity: 0.95, marginBottom: 8 }}>
            <span>{tierInfo.from}</span>
            <span>{tierInfo.next}</span>
            <span>{tierInfo.to}</span>
          </div>
          <div style={{ height: 10, background: '#ffffff33', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ width: `${tierInfo.progressPct}%`, height: '100%', background: '#fff', borderRadius: 18 }} />
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          <h3 style={{ fontSize: 15.5, fontWeight: 800, margin: 0 }}>{t.hdrClubCard}</h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: cardSt.color, background: cardSt.bg, padding: '5px 11px', borderRadius: 18 }}>
            {t.cardStatus[membership.cardStatus ?? 'NONE'] ?? membership.cardStatus}
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: '#8a96a6', margin: '0 0 18px' }}>{t.subClubCard}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#5a6678', marginBottom: 8 }}>
          <span>{t.lblYourPoints}: <b style={{ color: '#0d2640' }}>{faDigits(membership.balance)}</b></span>
          <span>{t.lblRequiredThreshold}: {faDigits(membership.tierRules.cardRequestMinPoints)}</span>
        </div>
        <div style={{ height: 10, background: '#eef1f5', borderRadius: 18, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ width: `${cardProgress}%`, height: '100%', background: tierStyle.main, borderRadius: 18 }} />
        </div>

        {cardIssued && membership.cardNo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'linear-gradient(135deg,#caa53a,#9a7d22)', color: '#fff', borderRadius: 14, padding: '15px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 27 }}>💳</div>
            <div style={{ lineHeight: 1.5 }}>
              <div style={{ fontSize: 11.5, opacity: 0.9 }}>{eligibleTier} — {t.cardIssuedLabel}</div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 1 }} dir="ltr">{membership.cardNo}</div>
            </div>
          </div>
        )}

        {showTracker && historySteps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 18 }} data-testid="club-card-tracker">
            {historySteps.map((st, i) => (
              <div key={`${st.step}-${i}`} style={{ display: 'flex', gap: 11 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: st.dotBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>✓</span>
                  {i < historySteps.length - 1 && (
                    <span style={{ width: 2, flex: 1, minHeight: 16, background: st.lineBg }} />
                  )}
                </div>
                <div style={{ paddingBottom: 13 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: st.textColor }}>{st.label}</div>
                  <div style={{ fontSize: 10, color: '#9aa4b2', marginTop: 2 }}>{st.at}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {membership.canRequestCard && (
          <div style={{ border: `1.5px solid ${tierStyle.border}`, background: tierStyle.soft, borderRadius: 14, padding: '15px 15px 13px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: tierStyle.text, marginBottom: 6 }}>
              {t.eligibleTitle(eligibleTier)}
            </div>
            <div style={{ fontSize: 11.5, color: tierStyle.subtext, marginBottom: 16 }}>
              {t.eligibleSub(faDigits(membership.balance))}
            </div>
            {requestError && <p role="alert" style={{ fontSize: 12, color: '#e5484d', marginBottom: 10 }}>{requestError}</p>}
            {notice && <p style={{ fontSize: 12, color: '#1f8a5b', marginBottom: 10 }}>{notice}</p>}
            <button
              type="button"
              data-testid="club-request-card-btn"
              disabled={requestBusy}
              onClick={() => void onRequestCard()}
              style={{ width: '100%', height: 50, borderRadius: 12, background: tierStyle.main, color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {requestBusy ? t.requestingBtn : t.btnRequestCard}
            </button>
          </div>
        )}

        {!membership.canRequestCard && !cardIssued && !showTracker && (
          <div style={{ border: `1.5px solid ${tierStyle.border}`, background: tierStyle.soft, borderRadius: 14, padding: '15px 15px 13px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: tierStyle.text }}>{t.lockedTitle(eligibleTier)}</div>
            <div style={{ fontSize: 11.5, color: tierStyle.subtext, marginTop: 3 }}>
              {t.lockedSub(faDigits(membership.pointsNeededForCard))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 800, margin: '0 0 18px' }}>{t.hdrTierBenefits}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 11 }}>
          {t.benefits.map((b) => (
            <div key={b.title} style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid #eef1f5', borderRadius: 13, padding: 11 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff7e6', color: '#caa53a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>★</div>
              <div style={{ lineHeight: 1.5 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{b.title}</div>
                <div style={{ fontSize: 11.5, color: '#9aa4b2' }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <Link
          to="/club"
          style={{ textDecoration: 'none', display: 'flex', marginTop: 20, height: 50, borderRadius: 12, background: '#1668c4', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 800 }}
        >
          {t.btnFullClubIntro}
        </Link>
      </div>
    </div>
  );
}
