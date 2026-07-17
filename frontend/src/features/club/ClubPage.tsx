import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  approveCardRequest,
  createClubMember,
  fetchCardRequests,
  fetchClubMembers,
  issueClubCard,
  rejectCardRequest,
  updateClubMemberLevel,
} from '../../api/club';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate, parseJalaliDateToIso } from '../../lib/jalali';
import Modal from '../../components/Modal';
import type { ClubCardRequest, ClubMembersResult, ClubTier } from '../../types/club';

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
  REFERRED: { label: 'در انتظار تأیید شما', className: 'bg-[#a78bfa2e] text-[#6d28d9]' },
  APPROVED: { label: 'کارت صادر شد', className: 'bg-[#10b98124] text-[#059669]' },
  REJECTED: { label: 'رد شده', className: 'bg-danger/15 text-danger' },
};

function faPoints(points: number): string {
  return faDigits(points.toLocaleString('en-US').replace(/,/g, '٬'));
}

export default function ClubPage() {
  const { user } = useAuth();
  const isSenior = user?.role === 'SENIOR_MANAGER';

  const [result, setResult] = useState<ClubMembersResult | null>(null);
  const [requests, setRequests] = useState<ClubCardRequest[]>([]);
  const [levelFilter, setLevelFilter] = useState<ClubTier | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detailRequest, setDetailRequest] = useState<ClubCardRequest | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', birth: '', nationalId: '', level: 'SILVER' as ClubTier });
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [membersData, requestsData] = await Promise.all([
        fetchClubMembers({ level: levelFilter ?? undefined, q: q || undefined }),
        fetchCardRequests(),
      ]);
      setResult(membersData);
      setRequests(requestsData);
    } catch {
      setError('خطا در دریافت اطلاعات باشگاه.');
    } finally {
      setLoading(false);
    }
  }, [levelFilter, q]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

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
  const visibleRequests = isSenior ? requests.filter((r) => r.status === 'REFERRED') : requests;

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">مشتریان VIP</h1>
          <p className="mt-1 text-sm text-muted">
            {isSenior ? 'درخواست‌های ارجاع‌شده و اعضای باشگاه' : 'باشگاه مشتریان، کارت‌ها و درخواست‌ها'}
          </p>
        </div>
        {!isSenior && (
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
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      {!isSenior && kpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">کل اعضای باشگاه</div>
            <div className="font-num mt-1 text-lg font-black text-ink">{faDigits(kpis.totalMembers)}</div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">کارت‌های صادرشده</div>
            <div className="font-num mt-1 text-lg font-black text-[#059669]">{faDigits(kpis.issuedCards)}</div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">درخواست در انتظار</div>
            <div className="font-num mt-1 text-lg font-black text-[#6d28d9]">{faDigits(kpis.pendingRequests)}</div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">توزیع سطوح عضویت</div>
            <div className="mt-1 space-y-0.5 text-[11px]">
              {(['PLATINUM', 'GOLD', 'SILVER'] as ClubTier[]).map((t) => (
                <div key={t} className="flex items-center justify-between">
                  <span>{TIER_LABELS[t]}</span>
                  <span className="font-num font-bold">{faDigits(kpis.tierCounts[t])}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="mb-6 rounded-xl border border-border bg-white p-5">
        <h2 className="mb-1 text-sm font-bold text-ink">
          {isSenior ? 'درخواست‌های صدور کارت (ارجاع‌شده)' : 'درخواست‌های صدور کارت در انتظار تأیید شما'}
        </h2>
        {isSenior && (
          <p className="mb-3 text-[11px] text-muted">
            درخواست‌هایی که ادمین سایت برای تأیید به شما ارجاع داده است؛ با تأیید شما کارت عضویت صادر می‌شود.
          </p>
        )}
        {visibleRequests.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            {isSenior ? 'درخواست ارجاع‌شده‌ای وجود ندارد.' : 'درخواستی در انتظار تأیید نیست.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visibleRequests.map((r) => {
              const st = REQUEST_STATUS[r.status];
              const seniorCanAct = !isSenior || r.assignedTo === 'SENIOR';
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-sm font-black text-accent">
                    {r.member.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">{r.member.fullName}</div>
                    <div className="font-num mt-0.5 text-[11px] text-muted">
                      کارت {TIER_LABELS[r.level]} · {faPoints(r.points)} امتیاز · {formatJalaliDate(r.createdAt)}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                  {isSenior ? (
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
                          className="rounded-lg bg-[#059669] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#047857]"
                        >
                          تأیید و صدور کارت
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted">
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

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">
            {isSenior ? 'مشتریان VIP' : 'اعضای باشگاه'}
            <span className="font-num mr-2 text-[11px] font-normal text-muted">
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
                    levelFilter === t ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
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
            className="mb-4 h-[42px] w-full rounded-xl border border-border bg-white px-4 text-xs outline-none transition focus:border-accent"
          />
        )}

        {loading ? (
          <p className="py-6 text-center text-sm text-muted">در حال بارگذاری…</p>
        ) : members.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">عضوی یافت نشد.</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="py-3">
                <div
                  className={`flex flex-wrap items-center gap-3 ${isSenior ? 'cursor-pointer' : ''}`}
                  onClick={() => isSenior && setExpandedMember(expandedMember === m.id ? null : m.id)}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-sm font-black text-accent">
                    {m.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink">{m.fullName}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${TIER_BADGES[m.level]}`}>
                        {TIER_LABELS[m.level]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      <span className="ltr">{m.email}</span> · امتیاز{' '}
                      <span className="font-num font-bold">{faPoints(m.points)}</span>
                    </div>
                  </div>
                  {m.cardStatus === 'ISSUED' ? (
                    <span className="rounded-full bg-[#10b98124] px-3 py-1 text-[10px] font-bold text-[#059669]">
                      کارت فعال · <span className="ltr font-num">{m.cardNo}</span>
                    </span>
                  ) : (
                    <>
                      <span className="rounded-full bg-surface px-3 py-1 text-[10px] font-bold text-muted">
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
                  <div className="mt-3 rounded-lg bg-surface p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div>
                        <div className="text-[10px] text-muted">تاریخ عضویت</div>
                        <div className="font-num font-bold">{formatJalaliDate(m.joinDate)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted">امتیاز</div>
                        <div className="font-num font-bold">{faPoints(m.points)}</div>
                      </div>
                      {m.birthDate && (
                        <div>
                          <div className="text-[10px] text-muted">تاریخ تولد</div>
                          <div className="font-num font-bold">{formatJalaliDate(m.birthDate)}</div>
                        </div>
                      )}
                      {m.issuedByLabelFa && (
                        <div>
                          <div className="text-[10px] text-muted">صادرشده توسط</div>
                          <div className="font-bold">{m.issuedByLabelFa}</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] text-muted">سطح عضویت:</span>
                      {(['SILVER', 'GOLD', 'PLATINUM'] as ClubTier[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => void onChangeLevel(m.id, t)}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            m.level === t ? 'bg-accent text-white' : 'bg-white text-text-2 hover:bg-surface-2'
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
        <Modal title="بررسی درخواست صدور کارت" onClose={() => setDetailRequest(null)}>
          <div className="mb-3">
            <div className="text-sm font-bold text-ink">{detailRequest.member.fullName}</div>
            <div className="font-num mt-1 text-xs text-muted">
              کارت {TIER_LABELS[detailRequest.level]} · {faPoints(detailRequest.points)} امتیاز
            </div>
          </div>
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-bold text-ink">روند درخواست</h3>
            <ul className="space-y-2">
              {detailRequest.history.map((h, idx) => (
                <li key={idx} className="border-r-2 border-[#059669]/50 pr-3 text-[11px]">
                  <div className="font-bold text-ink">{h.labelFa}</div>
                  <div className="font-num text-muted-2">{faDigits(h.at)}</div>
                </li>
              ))}
            </ul>
          </div>
          {detailRequest.status === 'REFERRED' && (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => void onDecide(detailRequest, 'reject')}
                className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white transition hover:bg-danger/90"
              >
                انصراف
              </button>
              <button
                onClick={() => void onDecide(detailRequest, 'approve')}
                className="rounded-lg bg-[#059669] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#047857]"
              >
                تأیید و صدور کارت
              </button>
            </div>
          )}
        </Modal>
      )}

      {addOpen && (
        <Modal title="تعریف مشتری VIP جدید" onClose={() => setAddOpen(false)}>
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="vip-name">
            نام و نام خانوادگی
          </label>
          <input
            id="vip-name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="vip-email">
            ایمیل
          </label>
          <input
            id="vip-email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink" htmlFor="vip-birth">
                تاریخ تولد
              </label>
              <input
                id="vip-birth"
                value={form.birth}
                onChange={(e) => setForm({ ...form, birth: e.target.value })}
                placeholder="۱۳۷۲/۰۵/۱۴"
                className="font-num w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink" htmlFor="vip-nid">
                شماره ملی
              </label>
              <input
                id="vip-nid"
                dir="ltr"
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                className="font-num w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
              />
            </div>
          </div>
          <div className="mb-1 mt-3 text-xs font-bold text-ink">سطح عضویت</div>
          <div className="flex gap-1.5">
            {(['SILVER', 'GOLD', 'PLATINUM'] as ClubTier[]).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, level: t })}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                  form.level === t ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
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
            <button onClick={() => setAddOpen(false)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
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
