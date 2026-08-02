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
import Modal from '../../components/Modal';
import type { ClubCardRequest, ClubMembersResult, ClubSubmittedCardRequest, ClubTier } from '../../types/club';

const TIER_LABELS: Record<ClubTier, string> = {
  SILVER: 'نقره‌ای',
  GOLD: 'طلایی',
  PLATINUM: 'پلاتین',
};

const TIER_BADGES: Record<ClubTier, string> = {
  SILVER: 'bg-[#94a3b829] text-[#475569]',
  GOLD: 'bg-[#caa53a2e] text-[#92600e]',
  PLATINUM: 'bg-[#3b82f62e] text-[#1d4ed8]',
};

const REQUEST_STATUS: Record<ClubCardRequest['status'], { label: string; className: string }> = {
  SUBMITTED: { label: 'در انتظار ارجاع', className: 'bg-[#fbbf242e] text-[#b45309]' },
  REFERRED: { label: 'در انتظار تأیید شما', className: 'bg-[#a78bfa2e] text-[#6d28d9]' },
  APPROVED: { label: 'کارت صادر شد', className: 'bg-[#34d39924] text-[#34d399]' },
  REJECTED: { label: 'رد شده', className: 'bg-danger/15 text-danger' },
};

function faPoints(points: number): string {
  return faDigits(points.toLocaleString('en-US').replace(/,/g, '٬'));
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

  const [addOpen, setAddOpen] = useState(false);
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
      setAddOpen(false);
      setForm({ fullName: '', email: '', birth: '', nationalId: '', level: 'SILVER' });
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
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-panel-ink">
            {isSiteAdmin ? 'باشگاه مشتریان' : 'مشتریان VIP'}
          </h1>
          <p className="mt-1 text-sm text-panel-muted">
            {isSiteAdmin
              ? 'پروفایل اعضا، صدور کارت و ارجاع درخواست‌ها'
              : isSenior
                ? 'درخواست‌های ارجاع‌شده و اعضای باشگاه'
                : 'باشگاه مشتریان، کارت‌ها و درخواست‌ها'}
          </p>
        </div>
        {!isSenior && !isSiteAdmin && (
          <button
            onClick={() => {
              setAddError(null);
              setAddOpen(true);
            }}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
          >
            تعریف مشتری VIP جدید
          </button>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#34d39915] p-3 text-sm text-[#34d399]">{notice}</p>}

      {!isSenior && kpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
            <div className="text-[11px] text-panel-muted">کل اعضای باشگاه</div>
            <div className="font-num mt-1 text-lg font-black text-panel-ink">{faDigits(kpis.totalMembers)}</div>
          </div>
          <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
            <div className="text-[11px] text-panel-muted">کارت‌های صادرشده</div>
            <div className="font-num mt-1 text-lg font-black text-[#34d399]">{faDigits(kpis.issuedCards)}</div>
          </div>
          <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
            <div className="text-[11px] text-panel-muted">
              {isSiteAdmin ? 'درخواست‌های در انتظار ارجاع' : 'درخواست در انتظار'}
            </div>
            <div className="font-num mt-1 text-lg font-black text-[#6d28d9]">
              {faDigits(isSiteAdmin ? kpis.submittedRequests : kpis.pendingRequests)}
            </div>
          </div>
          {isSiteAdmin ? (
            <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
              <div className="text-[11px] text-panel-muted">ارجاع‌شده به مدیران</div>
              <div className="font-num mt-1 text-lg font-black text-[#a855f7]">{faDigits(kpis.pendingRequests)}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
              <div className="text-[11px] text-panel-muted">توزیع سطوح عضویت</div>
              <div className="mt-1 space-y-0.5 text-[11px]">
                {(['PLATINUM', 'GOLD', 'SILVER'] as ClubTier[]).map((t) => (
                  <div key={t} className="flex items-center justify-between">
                    <span>{TIER_LABELS[t]}</span>
                    <span className="font-num font-bold">{faDigits(kpis.tierCounts[t])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <section className="mb-6 rounded-xl border border-panel-border bg-panel-surface p-5">
        <h2 className="mb-1 text-sm font-bold text-panel-ink">
          {isSiteAdmin
            ? 'درخواست‌های صدور کارت (در انتظار ارجاع)'
            : isSenior
              ? 'درخواست‌های صدور کارت (ارجاع‌شده)'
              : 'درخواست‌های صدور کارت در انتظار تأیید شما'}
        </h2>
        {isSenior && (
          <p className="mb-3 text-[11px] text-panel-muted">
            درخواست‌هایی که ادمین سایت برای تأیید به شما ارجاع داده است؛ با تأیید شما کارت عضویت صادر می‌شود.
          </p>
        )}
        {isSiteAdmin && (
          <p className="mb-3 text-[11px] text-panel-muted">
            درخواست‌های ثبت‌شده توسط اعضا — پس از بررسی، به مدیر ارشد یا رئیس هیئت مدیره ارجاع دهید.
          </p>
        )}
        {visibleRequests.length === 0 ? (
          <p className="py-3 text-center text-xs text-panel-muted">
            {isSiteAdmin
              ? 'درخواستی در انتظار ارجاع نیست.'
              : isSenior
                ? 'درخواست ارجاع‌شده‌ای وجود ندارد.'
                : 'درخواستی در انتظار تأیید نیست.'}
          </p>
        ) : (
          <ul className="divide-y divide-panel-border">
            {visibleRequests.map((r) => {
              const st = REQUEST_STATUS[r.status];
              const seniorCanAct = !isSenior || r.assignedTo === 'SENIOR';
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-surface-2 text-sm font-black text-accent">
                    {r.member.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-panel-ink">{r.member.fullName}</div>
                    <div className="font-num mt-0.5 text-[11px] text-panel-muted">
                      کارت {TIER_LABELS[r.level]} · {faPoints(r.points)} امتیاز · {formatJalaliDate(r.createdAt)}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                  {isSiteAdmin ? (
                    <button
                      onClick={() => {
                        setReferTarget('SENIOR');
                        setDetailRequest(r);
                      }}
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
                    >
                      بررسی و ارجاع
                    </button>
                  ) : isSenior ? (
                    seniorCanAct && r.status === 'REFERRED' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => void onDecide(r, 'reject')}
                          className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-bold text-danger transition hover:bg-danger/20"
                        >
                          انصراف
                        </button>
                        <button
                          onClick={() => void onDecide(r, 'approve')}
                          className="rounded-lg bg-[#34d399] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#2cb87f]"
                        >
                          تأیید و صدور کارت
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-panel-muted">
                        ارجاع‌شده به رئیس هیئت مدیره — در انتظار تأیید
                      </span>
                    )
                  ) : (
                    <button
                      onClick={() => setDetailRequest(r)}
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
                    >
                      بررسی درخواست
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-panel-border bg-panel-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-panel-ink">
            {isSenior ? 'مشتریان VIP' : 'اعضای باشگاه'}
            <span className="font-num mr-2 text-[11px] font-normal text-panel-muted">
              نمایش {faDigits(members.length)} عضو
            </span>
          </h2>
          {!isSenior && (
            <div className="flex gap-1.5">
              {([null, 'PLATINUM', 'GOLD', 'SILVER'] as (ClubTier | null)[]).map((t) => (
                <button
                  key={t ?? 'all'}
                  onClick={() => setLevelFilter(t)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                    levelFilter === t ? 'bg-accent text-white' : 'bg-panel-canvas text-panel-muted hover:bg-panel-surface-2/50'
                  }`}
                >
                  {t ? TIER_LABELS[t] : 'همه سطوح'}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isSenior && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در نام، ایمیل، شماره ملی یا کارت…"
            className="mb-4 h-[42px] w-full rounded-xl border border-panel-border-2 bg-panel-canvas text-panel-ink px-4 text-xs outline-none transition focus:border-accent"
          />
        )}

        {loading ? (
          <p className="py-6 text-center text-sm text-panel-muted">در حال بارگذاری…</p>
        ) : members.length === 0 ? (
          <p className="py-6 text-center text-xs text-panel-muted">عضوی یافت نشد.</p>
        ) : (
          <ul className="divide-y divide-panel-border">
            {members.map((m) => (
              <li key={m.id} className="py-3">
                <div
                  className={`flex flex-wrap items-center gap-3 ${isSenior ? 'cursor-pointer' : ''}`}
                  onClick={() => isSenior && setExpandedMember(expandedMember === m.id ? null : m.id)}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-surface-2 text-sm font-black text-accent">
                    {m.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-panel-ink">{m.fullName}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${TIER_BADGES[m.level]}`}>
                        {TIER_LABELS[m.level]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-panel-muted">
                      <span className="ltr">{m.email}</span> · امتیاز{' '}
                      <span className="font-num font-bold">{faPoints(m.points)}</span>
                    </div>
                  </div>
                  {m.cardStatus === 'ISSUED' ? (
                    <span className="rounded-full bg-[#34d39924] px-3 py-1 text-[10px] font-bold text-[#34d399]">
                      کارت فعال · <span className="ltr font-num">{m.cardNo}</span>
                    </span>
                  ) : (
                    <>
                      <span className="rounded-full bg-panel-canvas px-3 py-1 text-[10px] font-bold text-panel-muted">
                        بدون کارت
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void onIssueCard(m.id, m.fullName);
                        }}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition hover:bg-accent/90"
                      >
                        صدور کارت
                      </button>
                    </>
                  )}
                </div>

                {isSenior && expandedMember === m.id && (
                  <div className="mt-3 rounded-lg bg-panel-canvas p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div>
                        <div className="text-[10px] text-panel-muted">تاریخ عضویت</div>
                        <div className="font-num font-bold">{formatJalaliDate(m.joinDate)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-panel-muted">امتیاز</div>
                        <div className="font-num font-bold">{faPoints(m.points)}</div>
                      </div>
                      {m.birthDate && (
                        <div>
                          <div className="text-[10px] text-panel-muted">تاریخ تولد</div>
                          <div className="font-num font-bold">{formatJalaliDate(m.birthDate)}</div>
                        </div>
                      )}
                      {m.issuedByLabelFa && (
                        <div>
                          <div className="text-[10px] text-panel-muted">صادرشده توسط</div>
                          <div className="font-bold">{m.issuedByLabelFa}</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] text-panel-muted">سطح عضویت:</span>
                      {(['SILVER', 'GOLD', 'PLATINUM'] as ClubTier[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => void onChangeLevel(m.id, t)}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            m.level === t ? 'bg-accent text-white' : 'bg-panel-surface text-panel-muted hover:bg-panel-surface-2/50'
                          }`}
                        >
                          {TIER_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {detailRequest && (
        <Modal title={isSiteAdmin ? 'ارجاع درخواست صدور کارت' : 'بررسی درخواست صدور کارت'} onClose={() => setDetailRequest(null)}>
          <div className="mb-3">
            <div className="text-sm font-bold text-panel-ink">{detailRequest.member.fullName}</div>
            <div className="font-num mt-1 text-xs text-panel-muted">
              کارت {TIER_LABELS[detailRequest.level]} · {faPoints(detailRequest.points)} امتیاز
            </div>
            {isSiteAdmin && 'nationalId' in detailRequest.member && (
              <div className="font-num mt-2 grid grid-cols-2 gap-2 text-[11px] text-panel-muted">
                <div>کد ملی: {faDigits(detailRequest.member.nationalId)}</div>
                <div>ایمیل: {detailRequest.member.email}</div>
              </div>
            )}
          </div>
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-bold text-panel-ink">روند درخواست</h3>
            <ul className="space-y-2">
              {detailRequest.history.map((h, idx) => (
                <li key={idx} className="border-r-2 border-[#34d399]/50 pr-3 text-[11px]">
                  <div className="font-bold text-panel-ink">{h.labelFa}</div>
                  <div className="font-num text-panel-muted-2">{faDigits(h.at)}</div>
                </li>
              ))}
            </ul>
          </div>
          {isSiteAdmin && detailRequest.status === 'SUBMITTED' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-panel-ink">ارجاع به مدیران</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReferTarget('SENIOR')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold ${
                    referTarget === 'SENIOR' ? 'border-accent bg-accent/10 text-accent' : 'border-panel-border text-panel-muted'
                  }`}
                >
                  مدیر ارشد
                </button>
                <button
                  type="button"
                  onClick={() => setReferTarget('CHAIR')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold ${
                    referTarget === 'CHAIR' ? 'border-accent bg-accent/10 text-accent' : 'border-panel-border text-panel-muted'
                  }`}
                >
                  رئیس هیئت مدیره
                </button>
              </div>
              <button
                type="button"
                onClick={() => void onRefer(detailRequest as ClubSubmittedCardRequest)}
                className="w-full rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
              >
                ثبت ارجاع
              </button>
            </div>
          )}
          {!isSiteAdmin && detailRequest.status === 'REFERRED' && (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => void onDecide(detailRequest, 'reject')}
                className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white transition hover:bg-danger/90"
              >
                انصراف
              </button>
              <button
                onClick={() => void onDecide(detailRequest, 'approve')}
                className="rounded-lg bg-[#34d399] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2cb87f]"
              >
                تأیید و صدور کارت
              </button>
            </div>
          )}
        </Modal>
      )}

      {addOpen && (
        <Modal title="تعریف مشتری VIP جدید" onClose={() => setAddOpen(false)}>
          <label className="mb-1 block text-xs font-bold text-panel-ink" htmlFor="vip-name">
            نام و نام خانوادگی
          </label>
          <input
            id="vip-name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full rounded-lg border border-panel-border-2 bg-panel-canvas p-3 text-xs text-panel-ink outline-none transition focus:border-accent"
          />
          <label className="mb-1 mt-3 block text-xs font-bold text-panel-ink" htmlFor="vip-email">
            ایمیل
          </label>
          <input
            id="vip-email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-panel-border-2 bg-panel-canvas p-3 text-xs text-panel-ink outline-none transition focus:border-accent"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-panel-ink" htmlFor="vip-birth">
                تاریخ تولد
              </label>
              <input
                id="vip-birth"
                value={form.birth}
                onChange={(e) => setForm({ ...form, birth: e.target.value })}
                placeholder="۱۳۷۲/۰۵/۱۴"
                className="font-num w-full rounded-lg border border-panel-border-2 bg-panel-canvas p-3 text-xs text-panel-ink outline-none transition focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-panel-ink" htmlFor="vip-nid">
                شماره ملی
              </label>
              <input
                id="vip-nid"
                dir="ltr"
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                className="font-num w-full rounded-lg border border-panel-border-2 bg-panel-canvas p-3 text-xs text-panel-ink outline-none transition focus:border-accent"
              />
            </div>
          </div>
          <div className="mb-1 mt-3 text-xs font-bold text-panel-ink">سطح عضویت</div>
          <div className="flex gap-1.5">
            {(['SILVER', 'GOLD', 'PLATINUM'] as ClubTier[]).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, level: t })}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                  form.level === t ? 'bg-accent text-white' : 'bg-panel-canvas text-panel-muted hover:bg-panel-surface-2/50'
                }`}
              >
                {TIER_LABELS[t]}
              </button>
            ))}
          </div>
          {addError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {addError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="rounded-lg bg-panel-canvas px-4 py-2 text-xs font-bold text-panel-muted">
              انصراف
            </button>
            <button
              onClick={() => void onAddMember()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            >
              افزودن به باشگاه
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
