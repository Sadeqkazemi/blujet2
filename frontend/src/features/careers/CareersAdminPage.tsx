import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAllPostings,
  fetchApplicationDetail,
  fetchApplicationResume,
  fetchApplications,
  hireApplication,
  referApplication,
  rejectApplication,
} from '../../api/careers';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type {
  JobApplicationDetail,
  JobApplicationRow,
  JobApplicationStatus,
  JobPosting,
} from '../../types/careers';

const STATUS_META: Record<JobApplicationStatus, { label: string; className: string }> = {
  SUBMITTED: { label: 'در انتظار بررسی', className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' },
  REFERRED: { label: 'ارجاع‌شده', className: 'bg-[rgba(168,85,247,.16)] text-[#c084fc]' },
  HIRED: { label: 'استخدام شد', className: 'bg-[rgba(52,211,153,.14)] text-[#34d399]' },
  REJECTED: { label: 'رد شد', className: 'bg-[rgba(248,113,113,.14)] text-[#f87171]' },
};

/**
 * SITE_ADMIN «درخواست‌های استخدام» — applications queue only.
 * Job posting CRUD lives on مدیریت سایت (MediaAdminPage).
 */
export default function CareersAdminPage() {
  const [postings, setPostings] = useState<JobPosting[] | null>(null);
  const [applications, setApplications] = useState<JobApplicationRow[] | null>(null);
  const [q, setQ] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [detail, setDetail] = useState<JobApplicationDetail | null>(null);
  const [assigneePick, setAssigneePick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadApplications = useCallback(async (query?: string, jobTitle?: string) => {
    try {
      setApplications(
        await fetchApplications({
          ...(query ? { q: query } : {}),
          ...(jobTitle ? { jobTitle } : {}),
        }),
      );
    } catch {
      setError('خطا در دریافت درخواست‌های استخدام.');
    }
  }, []);

  useEffect(() => {
    void loadApplications();
    fetchAllPostings()
      .then(setPostings)
      .catch(() => setPostings([]));
  }, [loadApplications]);

  async function openDetail(id: string) {
    setError(null);
    setAssigneePick('');
    try {
      setDetail(await fetchApplicationDetail(id));
    } catch {
      setError('خطا در دریافت جزئیات درخواست.');
    }
  }

  async function onRefer() {
    if (!detail || !assigneePick) return;
    try {
      await referApplication(detail.id, assigneePick);
      const target = detail.referralTargets.find((r) => r.id === assigneePick);
      setNotice(`درخواست به ${target?.labelFa ?? ''} ارجاع شد ✓`);
      setDetail(await fetchApplicationDetail(detail.id));
      await loadApplications(q || undefined, jobFilter || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت ارجاع.');
    }
  }

  async function onHire() {
    if (!detail) return;
    try {
      await hireApplication(detail.id);
      setDetail(await fetchApplicationDetail(detail.id));
      await loadApplications(q || undefined, jobFilter || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت استخدام.');
    }
  }

  async function onReject() {
    if (!detail) return;
    try {
      await rejectApplication(detail.id);
      setDetail(await fetchApplicationDetail(detail.id));
      await loadApplications(q || undefined, jobFilter || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت رد درخواست.');
    }
  }

  async function onDownloadResume(id: string, fileName: string | null) {
    try {
      const blob = await fetchApplicationResume(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName ?? 'resume.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت رزومه.');
    }
  }

  function runSearch() {
    void loadApplications(q.trim() || undefined, jobFilter || undefined);
  }

  const rows = applications ?? [];
  const pager = usePagination(rows);

  useEffect(() => {
    pager.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on filter only
  }, [q, jobFilter, applications]);

  const jobOptions = useMemo(() => {
    const titles = new Set<string>();
    for (const p of postings ?? []) titles.add(p.title);
    for (const a of rows) titles.add(a.jobTitle);
    return Array.from(titles).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [postings, rows]);

  return (
    <div className="flex flex-col gap-[15px] px-[21px] pb-[34px] pt-[18px]">
      <div>
        <h1 className="m-0 text-[20.5px] font-black text-white">درخواست‌های استخدام</h1>
        <p className="mt-1 text-[11.5px] text-[#6b7b94]">
          فرم‌های استخدام و فایل‌های ارسالی متقاضیان – ارجاع به واحدهای مرتبط
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-sm text-[#f87171]">{error}</p>
      )}
      {notice && (
        <p className="rounded-lg bg-[rgba(52,211,153,.12)] p-3 text-sm text-[#34d399]">{notice}</p>
      )}

      <section className="overflow-hidden rounded-[14px] border border-[#1f2a3d] bg-[#141d2e]">
        <div className="border-b border-[#1f2a3d] px-[15px] py-[14px]">
          <h2 className="m-0 text-[14.5px] font-extrabold text-white">فرم‌های ثبت‌شده در صفحات استخدام</h2>
          <p className="mt-1 text-[11px] text-[#6b7b94]">
            رزومه و مشخصات متقاضیان را ببینید و در صورت نیاز به واحد مرتبط ارجاع دهید
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="جستجو در نام، کد ملی، تلفن یا ایمیل…"
              className="h-10 min-w-[220px] flex-1 rounded-[10px] border border-[#28344c] bg-[#18223a] px-3 text-[11.5px] text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]"
            />
            <select
              aria-label="فیلتر آگهی"
              value={jobFilter}
              onChange={(e) => {
                setJobFilter(e.target.value);
                void loadApplications(q.trim() || undefined, e.target.value || undefined);
              }}
              className="h-10 rounded-[10px] border border-[#28344c] bg-[#18223a] px-3 text-[11.5px] text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
            >
              <option value="">همۀ آگهی‌ها</option>
              {jobOptions.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runSearch}
              className="rounded-[10px] bg-[#3b82f6] px-3 py-2 text-[11.5px] font-bold text-white transition hover:bg-[#2563eb]"
            >
              جستجو
            </button>
          </div>
        </div>

        {applications === null ? (
          <p className="py-10 text-center text-sm text-[#6b7b94]">در حال بارگذاری…</p>
        ) : rows.length === 0 ? (
          <p className="py-[40px] text-center text-xs text-[#6b7b94]">
            هنوز فرمی از صفحات استخدام ثبت نشده است.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-[#1a2436]">
              {pager.pageItems.map((a) => {
                const st = STATUS_META[a.status];
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => void openDetail(a.id)}
                      className="flex w-full flex-wrap items-center gap-3 px-[15px] py-3.5 text-start transition hover:bg-[rgba(59,130,246,.06)]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(59,130,246,.16)] text-sm font-black text-[#60a5fa]">
                        {a.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-bold text-[#e7ecf3]">{a.name}</span>
                        <span className="mt-0.5 block text-[11px] text-[#6b7b94]">
                          {a.jobTitle}
                          {a.assigneeLabelFa ? ` · ارجاع به: ${a.assigneeLabelFa}` : ''}
                        </span>
                      </span>
                      <div className="text-left">
                        <div className="text-[10px] text-[#6b7b94]">تاریخ ثبت</div>
                        <div className="font-num text-xs font-bold text-[#e7ecf3]">
                          {formatJalaliDateTime(a.at)}
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${st.className}`}>
                        {st.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="px-[15px] pb-4 pt-2">
              <Pagination
                page={pager.page}
                totalPages={pager.totalPages}
                onChange={pager.setPage}
                variant="dark"
              />
            </div>
          </>
        )}
      </section>

      {detail && (
        <Modal
          variant="dark"
          title={`درخواست استخدام · ${detail.name}`}
          onClose={() => setDetail(null)}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] text-[#6b7b94]">وضعیت</span>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold ${STATUS_META[detail.status].className}`}
            >
              {STATUS_META[detail.status].label}
            </span>
          </div>

          <div className="mb-3 rounded-xl border border-[#22304a] bg-[#0f1726] p-3">
            <h3 className="mb-2 text-xs font-extrabold text-[#8fa1bb]">اطلاعات متقاضی</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <div>
                <dt className="text-[#6b7b94]">شغل مورد نظر</dt>
                <dd className="font-bold text-[#e7ecf3]">{detail.jobTitle}</dd>
              </div>
              <div>
                <dt className="text-[#6b7b94]">کد ملی</dt>
                <dd className="ltr font-num font-bold text-[#e7ecf3]">{faDigits(detail.nationalId)}</dd>
              </div>
              <div>
                <dt className="text-[#6b7b94]">تلفن</dt>
                <dd className="ltr font-num font-bold text-[#e7ecf3]">{faDigits(detail.phone)}</dd>
              </div>
              <div>
                <dt className="text-[#6b7b94]">ایمیل</dt>
                <dd className="ltr font-bold text-[#e7ecf3]">{detail.email ?? '—'}</dd>
              </div>
              {detail.skills && (
                <div className="col-span-2">
                  <dt className="text-[#6b7b94]">مهارت‌ها</dt>
                  <dd className="text-[#e7ecf3]">{detail.skills}</dd>
                </div>
              )}
            </dl>
            {detail.hasResume ? (
              <button
                type="button"
                onClick={() => void onDownloadResume(detail.id, detail.resumeFileName)}
                className="mt-3 text-[11px] font-bold text-[#60a5fa]"
              >
                دانلود رزومه ({detail.resumeFileName})
              </button>
            ) : (
              <div className="mt-3 text-[11px] text-[#6b7b94]">رزومه‌ای ثبت نشده است.</div>
            )}
          </div>

          {detail.canAct && (
            <div className="mb-3 rounded-xl border border-[#22304a] bg-[#0f1726] p-3">
              <h3 className="mb-2 text-xs font-extrabold text-[#8fa1bb]">ارجاع به مدیران</h3>
              <div className="flex gap-2">
                <select
                  aria-label="گیرنده ارجاع"
                  value={assigneePick}
                  onChange={(e) => setAssigneePick(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-[#28344c] bg-[#18223a] px-2 text-xs text-[#e7ecf3] outline-none"
                >
                  <option value="">— انتخاب مدیر —</option>
                  {detail.referralTargets.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.labelFa}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void onRefer()}
                  disabled={!assigneePick}
                  className="rounded-lg bg-[#3b82f6] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  ثبت ارجاع
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void onHire()}
                  className="flex-1 rounded-lg bg-[rgba(52,211,153,.14)] px-3 py-2 text-xs font-bold text-[#34d399]"
                >
                  استخدام
                </button>
                <button
                  type="button"
                  onClick={() => void onReject()}
                  className="flex-1 rounded-lg bg-[rgba(248,113,113,.14)] px-3 py-2 text-xs font-bold text-[#f87171]"
                >
                  رد درخواست
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[#22304a] bg-[#0f1726] p-3">
            <h3 className="mb-2 text-xs font-extrabold text-[#8fa1bb]">روند بررسی</h3>
            <ul className="flex flex-col gap-2 text-[11px] text-[#6b7b94]">
              {detail.history.map((h, i) => (
                <li key={i}>
                  {h.label} — <span className="font-num">{formatJalaliDateTime(h.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  );
}
