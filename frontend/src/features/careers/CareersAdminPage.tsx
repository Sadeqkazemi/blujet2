import { useCallback, useEffect, useState } from 'react';
import {
  createPosting,
  fetchAllPostings,
  fetchApplicationDetail,
  fetchApplicationResume,
  fetchApplications,
  hireApplication,
  referApplication,
  rejectApplication,
  updatePosting,
} from '../../api/careers';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type {
  CreateJobPostingInput,
  JobApplicationDetail,
  JobApplicationRow,
  JobApplicationStatus,
  JobPosting,
  JobType,
} from '../../types/careers';

const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: 'تمام‌وقت',
  REMOTE: 'دورکاری',
  PART_TIME: 'پاره‌وقت',
};

const STATUS_META: Record<JobApplicationStatus, { label: string; className: string }> = {
  SUBMITTED: { label: 'در انتظار بررسی', className: 'bg-[#f59e0b24] text-[#b45309]' },
  REFERRED: { label: 'ارجاع‌شده', className: 'bg-[#a855f72e] text-[#7c3aed]' },
  HIRED: { label: 'استخدام شد', className: 'bg-[#10b98124] text-[#059669]' },
  REJECTED: { label: 'رد شد', className: 'bg-[#ef444424] text-[#b91c1c]' },
};

const emptyForm: CreateJobPostingInput = {
  title: '',
  dept: '',
  city: '',
  type: 'FULL_TIME',
  generalReqs: [],
  specialReqs: [],
};

export default function CareersAdminPage() {
  const [tab, setTab] = useState<'postings' | 'applications'>('postings');

  const [postings, setPostings] = useState<JobPosting[] | null>(null);
  const [editing, setEditing] = useState<JobPosting | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreateJobPostingInput>(emptyForm);
  const [generalReqsText, setGeneralReqsText] = useState('');
  const [specialReqsText, setSpecialReqsText] = useState('');

  const [applications, setApplications] = useState<JobApplicationRow[] | null>(null);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<JobApplicationDetail | null>(null);
  const [assigneePick, setAssigneePick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPostings = useCallback(async () => {
    try {
      setPostings(await fetchAllPostings());
    } catch {
      setError('خطا در دریافت فرصت‌های شغلی.');
    }
  }, []);

  const loadApplications = useCallback(async (query?: string) => {
    try {
      setApplications(await fetchApplications(query ? { q: query } : undefined));
    } catch {
      setError('خطا در دریافت درخواست‌های استخدام.');
    }
  }, []);

  useEffect(() => {
    void loadPostings();
    void loadApplications();
  }, [loadPostings, loadApplications]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setGeneralReqsText('');
    setSpecialReqsText('');
    setFormOpen(true);
  }

  function openEdit(p: JobPosting) {
    setEditing(p);
    setForm({ title: p.title, dept: p.dept, city: p.city, type: p.type, generalReqs: p.generalReqs, specialReqs: p.specialReqs });
    setGeneralReqsText(p.generalReqs.join('\n'));
    setSpecialReqsText(p.specialReqs.join('\n'));
    setFormOpen(true);
  }

  async function onSaveForm() {
    const generalReqs = generalReqsText.split('\n').map((s) => s.trim()).filter(Boolean);
    const specialReqs = specialReqsText.split('\n').map((s) => s.trim()).filter(Boolean);
    const payload = { ...form, generalReqs, specialReqs };
    try {
      if (editing) {
        await updatePosting(editing.id, payload);
      } else {
        await createPosting(payload);
      }
      setFormOpen(false);
      await loadPostings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ذخیره فرصت شغلی.');
    }
  }

  async function onToggleActive(p: JobPosting) {
    try {
      await updatePosting(p.id, { active: !p.active });
      await loadPostings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در تغییر وضعیت.');
    }
  }

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
      await loadApplications(q || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت ارجاع.');
    }
  }

  async function onHire() {
    if (!detail) return;
    try {
      await hireApplication(detail.id);
      setDetail(await fetchApplicationDetail(detail.id));
      await loadApplications(q || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت استخدام.');
    }
  }

  async function onReject() {
    if (!detail) return;
    try {
      await rejectApplication(detail.id);
      setDetail(await fetchApplicationDetail(detail.id));
      await loadApplications(q || undefined);
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

  const postingRows = postings ?? [];
  const applicationRows = applications ?? [];
  const postingRowsPager = usePagination(postingRows);
  const applicationRowsPager = usePagination(applicationRows);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-ink">فرصت‌های شغلی</h1>
          <p className="mt-1 text-sm text-muted">آگهی‌های استخدام صفحه «همکاری با ما» و بررسی درخواست‌های ارسالی</p>
        </div>
        <div className="flex gap-2 rounded-xl border border-border bg-white p-1 text-xs font-bold">
          <button
            onClick={() => setTab('postings')}
            className={`rounded-lg px-3 py-2 transition ${tab === 'postings' ? 'bg-accent text-white' : 'text-muted'}`}
          >
            آگهی‌ها
          </button>
          <button
            onClick={() => setTab('applications')}
            className={`rounded-lg px-3 py-2 transition ${tab === 'applications' ? 'bg-accent text-white' : 'text-muted'}`}
          >
            درخواست‌های استخدام
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      {tab === 'postings' && (
        <section className="rounded-xl border border-border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">آگهی‌های استخدام</h2>
            <button onClick={openCreate} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white">
              + ایجاد فرصت شغلی
            </button>
          </div>

          {postings === null ? (
            <p className="py-6 text-center text-sm text-muted">در حال بارگذاری…</p>
          ) : postingRows.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">فرصت شغلی‌ای ثبت نشده است.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {postingRowsPager.pageItems.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-sm font-bold text-ink">{p.title}</div>
                  <div className="mt-1 text-[11px] text-muted">
                    {p.dept} · {p.city}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold text-accent">
                      {JOB_TYPE_LABELS[p.type]}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void onToggleActive(p)} className="text-[11px] font-bold text-muted">
                        {p.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                      </button>
                      <button onClick={() => openEdit(p)} className="text-[11px] font-bold text-accent">
                        ویرایش
                      </button>
                    </div>
                  </div>
                  {!p.active && <div className="mt-2 text-[10px] font-bold text-danger">غیرفعال</div>}
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={postingRowsPager.page}
            totalPages={postingRowsPager.totalPages}
            onChange={postingRowsPager.setPage}
            variant="light"
          />
        </section>
      )}

      {tab === 'applications' && (
        <section className="rounded-xl border border-border bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-ink">درخواست‌های استخدام</h2>
            <div className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void loadApplications(q || undefined)}
                placeholder="جستجو نام، کد ملی، تلفن…"
                className="h-9 rounded-lg border border-border px-2 text-xs outline-none"
              />
              <button
                onClick={() => void loadApplications(q || undefined)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-ink"
              >
                جستجو
              </button>
            </div>
          </div>

          {applications === null ? (
            <p className="py-6 text-center text-sm text-muted">در حال بارگذاری…</p>
          ) : applicationRows.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">درخواستی ثبت نشده است.</p>
          ) : (
            <ul className="divide-y divide-border">
              {applicationRowsPager.pageItems.map((a) => {
                const st = STATUS_META[a.status];
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    <button onClick={() => void openDetail(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-right">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-sm font-black text-accent">
                        {a.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink">{a.name}</span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {a.jobTitle}
                          {a.assigneeLabelFa ? ` · ارجاع به: ${a.assigneeLabelFa}` : ''}
                        </span>
                      </span>
                    </button>
                    <div className="text-left">
                      <div className="text-[10px] text-muted">تاریخ ثبت</div>
                      <div className="font-num text-xs font-bold text-ink">{formatJalaliDateTime(a.at)}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination
            page={applicationRowsPager.page}
            totalPages={applicationRowsPager.totalPages}
            onChange={applicationRowsPager.setPage}
            variant="light"
          />
        </section>
      )}

      {formOpen && (
        <Modal title={editing ? 'ویرایش فرصت شغلی' : 'ایجاد فرصت شغلی'} onClose={() => setFormOpen(false)}>
          <div className="flex flex-col gap-3">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="عنوان شغل"
              className="h-10 rounded-lg border border-border px-3 text-xs outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.dept}
                onChange={(e) => setForm({ ...form, dept: e.target.value })}
                placeholder="واحد"
                className="h-10 rounded-lg border border-border px-3 text-xs outline-none"
              />
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="شهر"
                className="h-10 rounded-lg border border-border px-3 text-xs outline-none"
              />
            </div>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as JobType })}
              className="h-10 rounded-lg border border-border px-3 text-xs outline-none"
            >
              <option value="FULL_TIME">تمام‌وقت</option>
              <option value="REMOTE">دورکاری</option>
              <option value="PART_TIME">پاره‌وقت</option>
            </select>
            <textarea
              value={generalReqsText}
              onChange={(e) => setGeneralReqsText(e.target.value)}
              placeholder="شرایط عمومی (هر مورد در یک خط)"
              rows={3}
              className="rounded-lg border border-border p-3 text-xs outline-none"
            />
            <textarea
              value={specialReqsText}
              onChange={(e) => setSpecialReqsText(e.target.value)}
              placeholder="شرایط تخصصی (هر مورد در یک خط)"
              rows={3}
              className="rounded-lg border border-border p-3 text-xs outline-none"
            />
            <button
              onClick={() => void onSaveForm()}
              disabled={!form.title.trim() || !form.dept.trim() || !form.city.trim()}
              className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              ذخیره
            </button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={`درخواست استخدام · ${detail.name}`} onClose={() => setDetail(null)}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] text-muted">وضعیت</span>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${STATUS_META[detail.status].className}`}>
              {STATUS_META[detail.status].label}
            </span>
          </div>

          <div className="mb-3 rounded-lg bg-surface p-3">
            <h3 className="mb-2 text-xs font-bold text-ink">اطلاعات متقاضی</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <div>
                <dt className="text-muted">شغل مورد نظر</dt>
                <dd className="font-bold text-ink">{detail.jobTitle}</dd>
              </div>
              <div>
                <dt className="text-muted">کد ملی</dt>
                <dd className="ltr font-num font-bold text-ink">{faDigits(detail.nationalId)}</dd>
              </div>
              <div>
                <dt className="text-muted">تلفن</dt>
                <dd className="ltr font-num font-bold text-ink">{faDigits(detail.phone)}</dd>
              </div>
              <div>
                <dt className="text-muted">ایمیل</dt>
                <dd className="ltr font-bold text-ink">{detail.email ?? '—'}</dd>
              </div>
              {detail.skills && (
                <div className="col-span-2">
                  <dt className="text-muted">مهارت‌ها</dt>
                  <dd className="text-ink">{detail.skills}</dd>
                </div>
              )}
            </dl>
            {detail.hasResume ? (
              <button
                onClick={() => void onDownloadResume(detail.id, detail.resumeFileName)}
                className="mt-3 text-[11px] font-bold text-accent"
              >
                دانلود رزومه ({detail.resumeFileName})
              </button>
            ) : (
              <div className="mt-3 text-[11px] text-muted">رزومه‌ای ثبت نشده است.</div>
            )}
          </div>

          {detail.canAct && (
            <div className="mb-3 rounded-lg border border-border p-3">
              <h3 className="mb-2 text-xs font-bold text-ink">ارجاع به مدیران</h3>
              <div className="flex gap-2">
                <select
                  aria-label="گیرنده ارجاع"
                  value={assigneePick}
                  onChange={(e) => setAssigneePick(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-border bg-white px-2 text-xs outline-none"
                >
                  <option value="">— انتخاب مدیر —</option>
                  {detail.referralTargets.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.labelFa}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void onRefer()}
                  disabled={!assigneePick}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  ثبت ارجاع
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={() => void onHire()} className="flex-1 rounded-lg bg-[#10b98124] px-3 py-2 text-xs font-bold text-[#059669]">
                  استخدام
                </button>
                <button onClick={() => void onReject()} className="flex-1 rounded-lg bg-[#ef444424] px-3 py-2 text-xs font-bold text-[#b91c1c]">
                  رد درخواست
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-xs font-bold text-ink">روند بررسی</h3>
            <ul className="flex flex-col gap-2 text-[11px] text-muted">
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
