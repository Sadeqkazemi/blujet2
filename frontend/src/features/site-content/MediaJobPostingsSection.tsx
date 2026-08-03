import { useCallback, useEffect, useState } from 'react';
import {
  createPosting,
  fetchAllPostings,
  fetchCareersSettings,
  updateCareersSettings,
  updatePosting,
} from '../../api/careers';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type {
  CreateJobPostingInput,
  JobPosting,
  JobType,
} from '../../types/careers';

const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: 'تمام‌وقت',
  REMOTE: 'دورکاری',
  PART_TIME: 'پاره‌وقت',
};

const JOB_TYPE_BADGE: Record<JobType, string> = {
  FULL_TIME: 'bg-[rgba(52,211,153,.14)] text-[#34d399]',
  REMOTE: 'bg-[rgba(59,130,246,.16)] text-[#60a5fa]',
  PART_TIME: 'bg-[rgba(245,158,11,.14)] text-[#fbbf24]',
};

const emptyForm: CreateJobPostingInput = {
  title: '',
  dept: '',
  city: '',
  type: 'FULL_TIME',
  generalReqs: [],
  specialReqs: [],
};

const inputClass =
  'h-10 w-full rounded-[11px] border border-[#28344c] bg-[#0f1623] px-3 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]';

/** Job postings block for SITE_ADMIN «مدیریت سایت» (design media tab). */
export default function MediaJobPostingsSection({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const [postings, setPostings] = useState<JobPosting[] | null>(null);
  const [footerEnabled, setFooterEnabled] = useState(true);
  const [editing, setEditing] = useState<JobPosting | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreateJobPostingInput>(emptyForm);
  const [generalReqsText, setGeneralReqsText] = useState('');
  const [specialReqsText, setSpecialReqsText] = useState('');

  const load = useCallback(async () => {
    try {
      const [rows, settings] = await Promise.all([fetchAllPostings(), fetchCareersSettings()]);
      setPostings(rows);
      setFooterEnabled(settings.enabled);
    } catch {
      onError('خطا در دریافت فرصت‌های شغلی.');
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setGeneralReqsText('');
    setSpecialReqsText('');
    setFormOpen(true);
  }

  function openEdit(p: JobPosting) {
    setEditing(p);
    setForm({
      title: p.title,
      dept: p.dept,
      city: p.city,
      type: p.type,
      generalReqs: p.generalReqs,
      specialReqs: p.specialReqs,
    });
    setGeneralReqsText(p.generalReqs.join('\n'));
    setSpecialReqsText(p.specialReqs.join('\n'));
    setFormOpen(true);
  }

  async function onSaveForm() {
    const generalReqs = generalReqsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const specialReqs = specialReqsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = { ...form, generalReqs, specialReqs };
    try {
      if (editing) await updatePosting(editing.id, payload);
      else await createPosting(payload);
      setFormOpen(false);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'خطا در ذخیره فرصت شغلی.');
    }
  }

  async function onToggleActive(p: JobPosting) {
    try {
      await updatePosting(p.id, { active: !p.active });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'خطا در تغییر وضعیت.');
    }
  }

  async function onToggleFooter() {
    try {
      const next = await updateCareersSettings(!footerEnabled);
      setFooterEnabled(next.enabled);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'خطا در تغییر انتشار فرصت‌های شغلی.');
    }
  }

  const rows = postings ?? [];
  const pager = usePagination(rows);

  return (
    <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-[14.5px] font-extrabold text-white">فرصت‌های شغلی</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6b7b94]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${footerEnabled ? 'bg-[#34d399]' : 'bg-[#6b7280]'}`}
            />
            {footerEnabled
              ? 'لینک فرصت‌های شغلی در فوتر سایت منتشر است'
              : 'لینک فرصت‌های شغلی در فوتر غیرفعال است'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onToggleFooter()}
            className="rounded-[9px] border border-[#f87171]/40 bg-[rgba(248,113,113,.12)] px-2.5 py-1.5 text-[11.5px] font-bold text-[#f87171]"
          >
            {footerEnabled ? 'لغو انتشار' : 'انتشار در فوتر'}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-[9px] bg-[#3b82f6] px-3 py-1.5 text-[11.5px] font-bold text-white"
          >
            + ایجاد فرصت شغلی
          </button>
        </div>
      </div>

      {postings === null ? (
        <p className="py-6 text-center text-sm text-[#6b7b94]">در حال بارگذاری…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#6b7b94]">فرصت شغلی‌ای ثبت نشده است.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {pager.pageItems.map((p) => (
              <div
                key={p.id}
                className="overflow-hidden rounded-xl border border-[#28344c] bg-[#18223a]"
              >
                <div className="flex h-[88px] items-center justify-center border-b border-dashed border-[#aebfd6] bg-[#eef3fa]">
                  <span className="text-[10px] text-[#4a5a73]">بدون تصویر</span>
                </div>
                <div className="p-3">
                  <div className="text-[13px] font-bold text-[#e7ecf3]">{p.title}</div>
                  <div className="mt-1 text-[11px] text-[#6b7b94]">
                    {p.dept} · {p.city}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${JOB_TYPE_BADGE[p.type]}`}
                    >
                      {JOB_TYPE_LABELS[p.type]}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="text-[11.5px] font-bold text-[#60a5fa]"
                    >
                      ویرایش
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onToggleActive(p)}
                    className="mt-3 w-full rounded-[9px] border border-[#f87171]/35 py-2 text-[11px] font-bold text-[#f87171] transition hover:bg-[rgba(248,113,113,.08)]"
                  >
                    {p.active ? 'غیرفعال کردن آگهی' : 'فعال کردن آگهی'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={pager.page}
            totalPages={pager.totalPages}
            onChange={pager.setPage}
            variant="dark"
          />
        </>
      )}

      {formOpen && (
        <Modal
          variant="dark"
          title={editing ? 'ویرایش فرصت شغلی' : 'ایجاد فرصت شغلی'}
          onClose={() => setFormOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="عنوان شغل"
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.dept}
                onChange={(e) => setForm({ ...form, dept: e.target.value })}
                placeholder="واحد"
                className={inputClass}
              />
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="شهر"
                className={inputClass}
              />
            </div>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as JobType })}
              className={inputClass}
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
              className="w-full rounded-[11px] border border-[#28344c] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]"
            />
            <textarea
              value={specialReqsText}
              onChange={(e) => setSpecialReqsText(e.target.value)}
              placeholder="شرایط تخصصی (هر مورد در یک خط)"
              rows={3}
              className="w-full rounded-[11px] border border-[#28344c] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]"
            />
            <button
              type="button"
              onClick={() => void onSaveForm()}
              disabled={!form.title.trim() || !form.dept.trim() || !form.city.trim()}
              className="rounded-[10px] bg-[#3b82f6] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              ذخیره
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
