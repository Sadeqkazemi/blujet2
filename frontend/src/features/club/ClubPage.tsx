import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  approveCardRequest,
  createClubMember,
  fetchCardRequests,
  fetchClubMembers,
  fetchSubmittedCardRequests,
  issueClubCard,
  referCardRequest,
  rejectCardRequest,
  updateClubMemberLevel,
} from '../../api/club';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate, parseJalaliDateToIso } from '../../lib/jalali';
import PanelAlert from '../panel/PanelAlert';
import PanelCard from '../panel/PanelCard';
import PanelModal from '../panel/PanelModal';
import PanelStatCard from '../panel/PanelStatCard';
import {
  panelBtnPrimary,
  panelCard,
  panelElevated,
  panelInput,
  panelMuted,
  panelMuted2,
  panelSegmentBtn,
  panelSegmented,
  panelTitle,
  panelValue,
} from '../panel/panel-theme';
import type { ClubCardRequest, ClubMembersResult, ClubSubmittedCardRequest, ClubTier } from '../../types/club';

const TIER_LABELS: Record<ClubTier, string> = {
  SILVER: 'نقره‌ای',
  GOLD: 'طلایی',
  PLATINUM: 'پلاتین',
};

const TIER_BADGES: Record<ClubTier, string> = {
  SILVER: 'bg-[rgba(100,116,139,.2)] text-[#cbd5e1]',
  GOLD: 'bg-[rgba(176,136,24,.2)] text-[#fcd34d]',
  PLATINUM: 'bg-[rgba(37,99,235,.2)] text-[#93c5fd]',
};

const TIER_DOT: Record<ClubTier, string> = {
  PLATINUM: 'bg-[#2563eb]',
  GOLD: 'bg-[#b08818]',
  SILVER: 'bg-[#64748b]',
};

const REQUEST_STATUS: Record<ClubCardRequest['status'], { label: string; className: string }> = {
  SUBMITTED: { label: 'در انتظار ارجاع', className: 'bg-[rgba(245,158,11,.16)] text-[#fbbf24]' },
  REFERRED: { label: 'در انتظار تأیید شما', className: 'bg-[rgba(167,139,250,.16)] text-[#a78bfa]' },
  APPROVED: { label: 'کارت صادر شد', className: 'bg-[rgba(52,211,153,.16)] text-[#34d399]' },
  REJECTED: { label: 'رد شده', className: 'bg-[rgba(248,113,113,.16)] text-[#f87171]' },
};

function faPoints(points: number): string {
  return faDigits(points.toLocaleString('en-US').replace(/,/g, '٬'));
}

function memberInitials(name: string): string {
  return name.slice(0, 1);
}

export default function ClubPage() {
  const { user } = useAuth();
  const isSenior = user?.role === 'SENIOR_MANAGER';
  const isSiteAdmin = user?.role === 'SITE_ADMIN';

  const [result, setResult] = useState<ClubMembersResult | null>(null);
  const [requests, setRequests] = useState<ClubCardRequest[]>([]);
  const [submittedRequests, setSubmittedRequests] = useState<ClubSubmittedCardRequest[]>([]);
  const [levelFilter, setLevelFilter] = useState<ClubTier | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detailRequest, setDetailRequest] = useState<ClubCardRequest | ClubSubmittedCardRequest | null>(null);
  const [referTarget, setReferTarget] = useState<'SENIOR' | 'CHAIR'>('SENIOR');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const [newVipOpen, setNewVipOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', birth: '', nationalId: '', level: 'SILVER' as ClubTier });
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const membersData = await fetchClubMembers({ level: levelFilter ?? undefined, q: q || undefined });
      setResult(membersData);
      if (isSiteAdmin) {
        setSubmittedRequests(await fetchSubmittedCardRequests());
        setRequests([]);
      } else {
        setRequests(await fetchCardRequests());
        setSubmittedRequests([]);
      }
    } catch {
      setError('خطا در دریافت اطلاعات باشگاه.');
    } finally {
      setLoading(false);
    }
  }, [levelFilter, q, isSiteAdmin]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function onRefer(req: ClubSubmittedCardRequest) {
    try {
      await referCardRequest(req.id, referTarget);
      setNotice(`درخواست «${req.member.fullName}» ارجاع شد ✓`);
      setDetailRequest(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ارجاع درخواست.');
    }
  }

  async function onDecide(req: ClubCardRequest, decision: 'approve' | 'reject') {
    try {
      if (decision === 'approve') {
        await approveCardRequest(req.id);
        setNotice(`کارت ${TIER_LABELS[req.level]} برای «${req.member.fullName}» صادر شد ✓`);
      } else {
        await rejectCardRequest(req.id);
        setNotice('درخواست رد شد');
      }
      setDetailRequest(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت تصمیم.');
    }
  }

  async function onIssueCard(memberId: string, fullName: string) {
    try {
      await issueClubCard(memberId);
      setNotice(`کارت عضویت برای «${fullName}» صادر شد ✓`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در صدور کارت.');
    }
  }

  async function onChangeLevel(memberId: string, level: ClubTier) {
    try {
      await updateClubMemberLevel(memberId, level);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در تغییر سطح.');
    }
  }

  async function onAddMember() {
    if (!form.fullName.trim() || !form.email.trim() || !form.nationalId.trim()) {
      setAddError('نام، ایمیل و شماره ملی الزامی است.');
      return;
    }
    let birthDate: string | undefined;
    if (form.birth.trim()) {
      const iso = parseJalaliDateToIso(form.birth);
      if (!iso) {
        setAddError('تاریخ تولد را به شکل ۱۳۷۲/۰۵/۱۴ وارد کنید.');
        return;
      }
      birthDate = iso;
    }
    try {
      await createClubMember({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        nationalId: form.nationalId.trim(),
        level: form.level,
        birthDate,
      });
      setNotice(`«${form.fullName.trim()}» به باشگاه افزوده شد ✓`);
      setForm({ fullName: '', email: '', birth: '', nationalId: '', level: 'SILVER' });
      setNewVipOpen(false);
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'خطا در افزودن عضو.');
    }
  }

  const kpis = result?.kpis;
  const members = result?.members ?? [];
  const visibleRequests = isSiteAdmin
    ? submittedRequests
    : isSenior
      ? requests.filter((r) => r.status === 'REFERRED')
      : requests;

  return (
    <div className="flex flex-col gap-[15px]">
      {error && <PanelAlert>{error}</PanelAlert>}
      {notice && <PanelAlert tone="success">{notice}</PanelAlert>}

      {!isSenior && kpis && (
        <div className="grid grid-cols-2 gap-[13px] md:grid-cols-4">
          <PanelStatCard
            label="کل اعضای باشگاه"
            value={faDigits(kpis.totalMembers)}
            valueClass={panelValue}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            iconClass="bg-[rgba(59,130,246,.16)] text-[#60a5fa]"
          />
          <PanelStatCard
            label="کارت‌های صادرشده"
            value={faDigits(kpis.issuedCards)}
            valueClass="font-num text-[22.5px] font-black text-[#34d399]"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            }
            iconClass="bg-[rgba(16,185,129,.14)] text-[#34d399]"
          />
          <PanelStatCard
            label={isSiteAdmin ? 'درخواست‌های در انتظار ارجاع' : 'درخواست در انتظار'}
            value={faDigits(isSiteAdmin ? kpis.submittedRequests : kpis.pendingRequests)}
            valueClass="font-num text-[22.5px] font-black text-[#a78bfa]"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            }
            iconClass="bg-[rgba(124,58,237,.16)] text-[#a78bfa]"
          />
          {isSiteAdmin ? (
            <PanelStatCard
              label="ارجاع‌شده به مدیران"
              value={faDigits(kpis.pendingRequests)}
              valueClass="font-num text-[22.5px] font-black text-[#a78bfa]"
            />
          ) : (
            <div className={`${panelCard} flex flex-col justify-center gap-2 p-4`}>
              <div className={`text-[11px] ${panelMuted}`}>توزیع سطوح عضویت</div>
              {(['PLATINUM', 'GOLD', 'SILVER'] as ClubTier[]).map((t) => (
                <div key={t} className="flex items-center justify-between text-[11.5px]">
                  <span className={`flex items-center gap-1.5 ${TIER_BADGES[t].split(' ').pop()}`}>
                    <span className={`h-2 w-2 rounded-full ${TIER_DOT[t]}`} />
                    {TIER_LABELS[t]}
                  </span>
                  <span className="font-num font-extrabold text-white">{faDigits(kpis.tierCounts[t])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PanelCard
        className={visibleRequests.length > 0 && !isSiteAdmin ? 'border-[#2c2350]' : ''}
        title={
          <span className="flex items-center gap-2">
            {visibleRequests.length > 0 && !isSiteAdmin && (
              <span className="h-2 w-2 rounded-full bg-[#a78bfa]" aria-hidden />
            )}
            {isSiteAdmin
              ? 'درخواست‌های صدور کارت (در انتظار ارجاع)'
              : isSenior
                ? 'درخواست‌های صدور کارت (ارجاع‌شده)'
                : 'درخواست‌های صدور کارت در انتظار تأیید شما'}
          </span>
        }
        subtitle={
          isSenior
            ? 'درخواست‌هایی که ادمین سایت برای تأیید به شما ارجاع داده است؛ با تأیید شما کارت عضویت صادر می‌شود.'
            : isSiteAdmin
              ? 'درخواست‌های ثبت‌شده توسط اعضا — پس از بررسی، به مدیر ارشد یا رئیس هیئت مدیره ارجاع دهید.'
              : undefined
        }
      >
        {visibleRequests.length === 0 ? (
          <p className={`py-3 text-center text-xs ${panelMuted}`}>
            {isSiteAdmin
              ? 'درخواستی در انتظار ارجاع نیست.'
              : isSenior
                ? 'درخواست ارجاع‌شده‌ای وجود ندارد.'
                : 'درخواستی در انتظار تأیید نیست.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleRequests.map((r) => {
              const st = REQUEST_STATUS[r.status];
              const seniorCanAct = !isSenior || r.assignedTo === 'SENIOR';
              return (
                <li
                  key={r.id}
                  className={`flex flex-wrap items-center gap-3 ${panelElevated} p-3`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-panel-accent text-sm font-extrabold text-white">
                    {memberInitials(r.member.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold text-white">{r.member.fullName}</div>
                    <div className={`font-num mt-0.5 text-[11px] ${panelMuted}`}>
                      کارت {TIER_LABELS[r.level]} · {faPoints(r.points)} امتیاز · {formatJalaliDate(r.createdAt)}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10.5px] font-bold ${st.className}`}>
                    {st.label}
                  </span>
                  {isSiteAdmin ? (
                    <button type="button" onClick={() => { setReferTarget('SENIOR'); setDetailRequest(r); }} className={panelBtnPrimary}>
                      بررسی و ارجاع
                    </button>
                  ) : isSenior ? (
                    seniorCanAct && r.status === 'REFERRED' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void onDecide(r, 'reject')}
                          className="rounded-lg bg-[rgba(248,113,113,.16)] px-3 py-2 text-xs font-bold text-[#f87171] transition hover:bg-[rgba(248,113,113,.24)]"
                        >
                          انصراف
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDecide(r, 'approve')}
                          className="rounded-lg bg-[#059669] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#047857]"
                        >
                          تأیید و صدور کارت
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[11px] ${panelMuted}`}>
                        ارجاع‌شده به رئیس هیئت مدیره — در انتظار تأیید
                      </span>
                    )
                  ) : (
                    <button type="button" onClick={() => setDetailRequest(r)} className={panelBtnPrimary}>
                      بررسی درخواست
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title={isSenior ? 'مشتریان VIP' : 'اعضای باشگاه'}
        actions={
          !isSenior ? (
            <div className={panelSegmented}>
              {([null, 'PLATINUM', 'GOLD', 'SILVER'] as (ClubTier | null)[]).map((t) => (
                <button
                  key={t ?? 'all'}
                  type="button"
                  onClick={() => setLevelFilter(t)}
                  className={panelSegmentBtn(levelFilter === t)}
                >
                  {t ? TIER_LABELS[t] : 'همه سطوح'}
                </button>
              ))}
            </div>
          ) : undefined
        }
      >
        {!isSenior && (
          <div className="relative mb-3">
            <span className={`pointer-events-none absolute inset-y-0 start-3 flex items-center ${panelMuted}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو در نام، ایمیل، شماره ملی یا کارت…"
              className={`${panelInput} h-[42px] w-full ps-9 pe-9`}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="پاک کردن جستجو"
                className={`absolute inset-y-0 end-3 flex items-center text-lg leading-none ${panelMuted} transition hover:text-white`}
              >
                ×
              </button>
            )}
          </div>
        )}

        <p className={`mb-3 text-[11.5px] ${panelMuted}`}>
          نمایش <span className="font-num font-extrabold text-[#cdd9ec]">{faDigits(members.length)}</span> عضو
        </p>

        {loading ? (
          <p className={`py-6 text-center text-sm ${panelMuted}`}>در حال بارگذاری…</p>
        ) : members.length === 0 ? (
          <p className={`py-6 text-center text-xs ${panelMuted}`}>عضوی یافت نشد.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.id}>
                <div
                  className={`flex flex-wrap items-center gap-3 ${panelElevated} p-3 ${
                    isSenior ? 'cursor-pointer transition hover:border-panel-accent/40' : ''
                  }`}
                  onClick={() => isSenior && setExpandedMember(expandedMember === m.id ? null : m.id)}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-panel-accent text-sm font-extrabold text-white">
                    {memberInitials(m.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-extrabold text-white">{m.fullName}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[9.5px] font-extrabold ${TIER_BADGES[m.level]}`}>
                        {TIER_LABELS[m.level]}
                      </span>
                    </div>
                    <div className={`mt-0.5 truncate text-[10.5px] ${panelMuted}`}>
                      <span className="ltr">{m.email}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-center">
                    <div className={`text-[9.5px] ${panelMuted}`}>امتیاز</div>
                    <div className="font-num text-[12.5px] font-extrabold text-panel-text">{faPoints(m.points)}</div>
                  </div>
                  {m.cardStatus === 'ISSUED' ? (
                    <span className="shrink-0 rounded-full bg-[rgba(52,211,153,.16)] px-3 py-1 text-[10.5px] font-bold text-[#34d399]">
                      کارت فعال · <span className="ltr font-num">{m.cardNo}</span>
                    </span>
                  ) : (
                    <>
                      <span className={`shrink-0 rounded-full ${panelElevated} px-3 py-1 text-[10.5px] font-bold ${panelMuted2}`}>
                        بدون کارت
                      </span>
                      {!isSenior && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onIssueCard(m.id, m.fullName);
                          }}
                          className={panelBtnPrimary}
                        >
                          صدور کارت
                        </button>
                      )}
                    </>
                  )}
                </div>

                {isSenior && expandedMember === m.id && (
                  <div className={`mt-2 rounded-lg ${panelElevated} p-3 text-xs`}>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div>
                        <div className={`text-[10px] ${panelMuted}`}>تاریخ عضویت</div>
                        <div className="font-num font-bold text-white">{formatJalaliDate(m.joinDate)}</div>
                      </div>
                      <div>
                        <div className={`text-[10px] ${panelMuted}`}>امتیاز</div>
                        <div className="font-num font-bold text-white">{faPoints(m.points)}</div>
                      </div>
                      {m.birthDate && (
                        <div>
                          <div className={`text-[10px] ${panelMuted}`}>تاریخ تولد</div>
                          <div className="font-num font-bold text-white">{formatJalaliDate(m.birthDate)}</div>
                        </div>
                      )}
                      {m.issuedByLabelFa && (
                        <div>
                          <div className={`text-[10px] ${panelMuted}`}>صادرشده توسط</div>
                          <div className="font-bold text-white">{m.issuedByLabelFa}</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`text-[10px] ${panelMuted}`}>سطح عضویت:</span>
                      <div className={panelSegmented}>
                        {(['SILVER', 'GOLD', 'PLATINUM'] as ClubTier[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => void onChangeLevel(m.id, t)}
                            className={panelSegmentBtn(m.level === t)}
                          >
                            {TIER_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {!isSenior && !isSiteAdmin && (
        <section className={`${panelCard} p-4`}>
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setNewVipOpen((o) => !o);
            }}
            className="flex w-full items-center justify-between gap-3 text-right"
            aria-expanded={newVipOpen}
          >
            <div>
              <div className={panelTitle}>تعریف مشتری VIP جدید</div>
              <p className={`mt-1 text-[11.5px] ${panelMuted}`}>
                اطلاعات مشتری را دستی وارد کنید تا به‌عنوان عضو باشگاه ثبت شود.
              </p>
            </div>
            <span
              className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-panel-border-2 bg-panel-elevated text-panel-muted-2 transition ${newVipOpen ? 'rotate-180' : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>

          {newVipOpen && (
            <div className="mt-4">
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={`mb-1.5 block text-[11px] ${panelMuted2}`} htmlFor="vip-name">
                    نام و نام خانوادگی
                  </label>
                  <input
                    id="vip-name"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="مثلاً نگار رضایی"
                    className={`${panelInput} h-[42px] w-full`}
                  />
                </div>
                <div>
                  <label className={`mb-1.5 block text-[11px] ${panelMuted2}`} htmlFor="vip-email">
                    ایمیل
                  </label>
                  <input
                    id="vip-email"
                    dir="ltr"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    className={`${panelInput} h-[42px] w-full text-right`}
                  />
                </div>
                <div>
                  <label className={`mb-1.5 block text-[11px] ${panelMuted2}`} htmlFor="vip-birth">
                    تاریخ تولد
                  </label>
                  <input
                    id="vip-birth"
                    value={form.birth}
                    onChange={(e) => setForm({ ...form, birth: e.target.value })}
                    placeholder="۱۳۷۰/۰۱/۰۱"
                    className={`font-num ${panelInput} h-[42px] w-full`}
                  />
                </div>
                <div>
                  <label className={`mb-1.5 block text-[11px] ${panelMuted2}`} htmlFor="vip-nid">
                    شماره ملی
                  </label>
                  <input
                    id="vip-nid"
                    dir="ltr"
                    value={form.nationalId}
                    onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                    placeholder="۰۰۱۲۳۴۵۶۷۸"
                    className={`font-num ${panelInput} h-[42px] w-full text-right`}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-[11px] ${panelMuted2}`}>سطح کاربر</span>
                <div className={panelSegmented}>
                  {(['SILVER', 'GOLD', 'PLATINUM'] as ClubTier[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, level: t })}
                      className={panelSegmentBtn(form.level === t)}
                    >
                      {TIER_LABELS[t]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void onAddMember()}
                  className={`${panelBtnPrimary} ms-auto`}
                >
                  افزودن به باشگاه
                </button>
              </div>
              {addError && (
                <p role="alert" className="mt-2 text-xs text-[#f87171]">
                  {addError}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {detailRequest && (
        <PanelModal
          title={isSiteAdmin ? 'ارجاع درخواست صدور کارت' : 'بررسی درخواست صدور کارت'}
          onClose={() => setDetailRequest(null)}
          wide
          footer={
            isSiteAdmin && detailRequest.status === 'SUBMITTED' ? (
              <button
                type="button"
                onClick={() => void onRefer(detailRequest as ClubSubmittedCardRequest)}
                className={`${panelBtnPrimary} w-full`}
              >
                ثبت ارجاع
              </button>
            ) : !isSiteAdmin && detailRequest.status === 'REFERRED' ? (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void onDecide(detailRequest, 'reject')}
                  className="rounded-lg bg-[rgba(248,113,113,.16)] px-4 py-2 text-xs font-bold text-[#f87171] transition hover:bg-[rgba(248,113,113,.24)]"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => void onDecide(detailRequest, 'approve')}
                  className="rounded-lg bg-[#059669] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#047857]"
                >
                  تأیید و صدور کارت
                </button>
              </div>
            ) : undefined
          }
        >
          <div className="mb-3">
            <div className="text-sm font-bold text-white">{detailRequest.member.fullName}</div>
            <div className={`font-num mt-1 text-xs ${panelMuted}`}>
              کارت {TIER_LABELS[detailRequest.level]} · {faPoints(detailRequest.points)} امتیاز
            </div>
            {isSiteAdmin && 'nationalId' in detailRequest.member && (
              <div className={`font-num mt-2 grid grid-cols-2 gap-2 text-[11px] ${panelMuted}`}>
                <div>کد ملی: {faDigits(detailRequest.member.nationalId)}</div>
                <div>ایمیل: {detailRequest.member.email}</div>
              </div>
            )}
          </div>
          <div className="mb-4">
            <h3 className={`mb-2 text-xs font-bold text-white`}>روند درخواست</h3>
            <ul className="space-y-2">
              {detailRequest.history.map((h, idx) => (
                <li key={idx} className="border-r-2 border-[#34d399]/50 pr-3 text-[11px]">
                  <div className="font-bold text-white">{h.labelFa}</div>
                  <div className={`font-num ${panelMuted}`}>{faDigits(h.at)}</div>
                </li>
              ))}
            </ul>
          </div>
          {isSiteAdmin && detailRequest.status === 'SUBMITTED' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-white">ارجاع به مدیران</div>
              <div className={panelSegmented}>
                <button
                  type="button"
                  onClick={() => setReferTarget('SENIOR')}
                  className={`flex-1 ${panelSegmentBtn(referTarget === 'SENIOR')}`}
                >
                  مدیر ارشد
                </button>
                <button
                  type="button"
                  onClick={() => setReferTarget('CHAIR')}
                  className={`flex-1 ${panelSegmentBtn(referTarget === 'CHAIR')}`}
                >
                  رئیس هیئت مدیره
                </button>
              </div>
            </div>
          )}
        </PanelModal>
      )}
    </div>
  );
}
