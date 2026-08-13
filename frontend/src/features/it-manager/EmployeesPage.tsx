import { useCallback, useEffect, useState } from 'react';
import {
  createEmployee,
  fetchEmployee,
  fetchEmployees,
  fetchPermissionCatalog,
  resetEmployeePassword,
  setEmployeePermission,
  setEmployeeStatus,
} from '../../api/it-manager';
import { faDigits, isValidIranMobile, normalizeIranMobile } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { EmployeeDetail, EmployeeListRow, PermissionCatalog } from '../../types/it-manager';

const DEPT_OPTIONS = [
  { value: 'commercial', label: 'واحد بازرگانی' },
  { value: 'sales', label: 'واحد فروش' },
  { value: 'finance', label: 'واحد مالی' },
  { value: 'it', label: 'واحد IT' },
];

const DEPT_LABELS: Record<string, string> = {
  commercial: 'واحد بازرگانی',
  sales: 'واحد فروش',
  finance: 'واحد مالی',
  it: 'واحد IT',
};

const RANK_OPTIONS = ['کارآموز', 'کارشناس', 'کارشناس ارشد', 'سرپرست واحد', 'معاون'];

function deptRoleLabel(
  dept: string | null,
  rank: string | null,
  customLabels: Record<string, string>,
) {
  let d = '—';
  if (dept) {
    d = DEPT_LABELS[dept] ?? customLabels[dept] ?? (dept.startsWith('custom_') ? 'واحد سفارشی' : dept);
  }
  return `${rank ?? 'کارشناس'} · ${d}`;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    phone: '',
    password: '',
    dept: 'commercial',
    rank: 'کارشناس',
    referralScope: 'MANAGERS_ONLY' as 'MANAGERS_ONLY' | 'ALL_STAFF',
  });
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [customDeptLabels, setCustomDeptLabels] = useState<Record<string, string>>({});
  const [customDepts, setCustomDepts] = useState<{ id: string; label: string }[]>([]);
  const [addingDept, setAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [statusConfirm, setStatusConfirm] = useState<EmployeeListRow | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    fullName: string;
    username: string;
    phone: string;
    password: string;
  } | null>(null);

  const employeesPager = usePagination(employees);

  const load = useCallback(async () => {
    try {
      setEmployees(await fetchEmployees());
    } catch {
      setError('خطا در دریافت فهرست کارمندان.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    fetchPermissionCatalog()
      .then(setCatalog)
      .catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setTempPassword(null);
      return;
    }
    fetchEmployee(detailId)
      .then(setDetail)
      .catch(() => setError('خطا در دریافت جزئیات کارمند.'));
  }, [detailId]);

  async function onCreate() {
    if (!form.fullName.trim() || !form.username.trim()) {
      setAddError('نام و نام کاربری الزامی است.');
      return;
    }
    const phone = normalizeIranMobile(form.phone);
    if (!isValidIranMobile(phone)) {
      setAddError('شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۱۲۳۴۵۶۷).');
      return;
    }
    if (form.password.length < 6) {
      setAddError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    try {
      const submitted = {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        phone,
        password: form.password,
      };
      await createEmployee({
        fullName: submitted.fullName,
        username: submitted.username,
        phone: submitted.phone,
        password: submitted.password,
        dept: form.dept,
        rank: form.rank,
        referralScope: form.referralScope,
        permissionKeys: Array.from(selectedPerms),
      });
      setNotice(`کارمند «${submitted.fullName}» ایجاد شد ✓`);
      setAddOpen(false);
      setCreatedCredentials(submitted);
      setForm({
        fullName: '',
        username: '',
        phone: '',
        password: '',
        dept: 'commercial',
        rank: 'کارشناس',
        referralScope: 'MANAGERS_ONLY',
      });
      setSelectedPerms(new Set());
      setAddingDept(false);
      setNewDeptName('');
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'خطا در ایجاد کارمند.');
    }
  }

  function requestStatusChange(row: EmployeeListRow) {
    if (row.isActive) {
      setStatusConfirm(row);
      return;
    }
    void onToggleStatus(row);
  }

  async function onToggleStatus(row: EmployeeListRow) {
    try {
      await setEmployeeStatus(row.id, !row.isActive);
      await load();
    } catch {
      setError('خطا در تغییر وضعیت حساب.');
    }
  }

  async function onQuickReset(row: EmployeeListRow) {
    try {
      const { tempPassword: pw } = await resetEmployeePassword(row.id);
      setNotice(`رمز موقت «${row.fullName}»: ${pw}`);
    } catch {
      setError('خطا در بازنشانی رمز عبور.');
    }
  }

  async function onGrant(key: string, grant: boolean) {
    if (!detailId) return;
    try {
      const updated = await setEmployeePermission(detailId, key, grant);
      setDetail(updated);
    } catch {
      setError('خطا در تغییر دسترسی.');
    }
  }

  async function onResetPassword() {
    if (!detailId) return;
    try {
      const { tempPassword: pw } = await resetEmployeePassword(detailId);
      setTempPassword(pw);
    } catch {
      setError('خطا در بازنشانی رمز عبور.');
    }
  }

  async function confirmSuspend() {
    if (!statusConfirm) return;
    await onToggleStatus(statusConfirm);
    setStatusConfirm(null);
  }

  function submitNewDept() {
    const name = newDeptName.trim();
    if (!name) return;
    const id = `custom_${Date.now()}`;
    setCustomDepts((prev) => [...prev, { id, label: name }]);
    setCustomDeptLabels((prev) => ({ ...prev, [id]: name }));
    setForm((f) => ({ ...f, dept: id }));
    setAddingDept(false);
    setNewDeptName('');
    setNotice(`واحد سازمانی «${name}» ایجاد شد ✓`);
  }

  const catalogDeptKey = form.dept.startsWith('custom_')
    ? null
    : form.dept === 'sales'
      ? 'commercial'
      : form.dept;
  const catalogGroups = catalogDeptKey ? (catalog?.[catalogDeptKey] ?? []) : [];

  return (
    <div className="flex flex-col px-[21px] pb-[34px] pt-[18px]">
      <div className="order-1 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20.5px] font-black text-white">کاربران و دسترسی‌ها</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">
            حساب‌ها، نقش‌ها، رمز عبور و سطح دسترسی کارمندان واحدها — یکپارچه
          </p>
        </div>
        <button
          onClick={() => {
            setAddError(null);
            setAddOpen(true);
          }}
          className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
        >
          افزودن کاربر
        </button>
      </div>

      {error && <p className="order-2 mb-4 rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-sm text-[#f87171]">{error}</p>}
      {notice && <p className="order-2 mb-4 rounded-lg bg-[rgba(16,185,129,.12)] p-3 text-sm text-[#34d399]">{notice}</p>}

      <section className="order-4 mb-8 overflow-hidden rounded-xl border border-[#1f2a3d] bg-[#141d2e]">
        <div className="grid grid-cols-[1.6fr_1.3fr_1.4fr_1fr_0.9fr_1.4fr] gap-2 border-b border-[#1f2a3d] bg-[#18223a] px-4 py-2.5 text-[10.5px] font-bold text-[#6b7b94]">
          <span>کاربر</span>
          <span>نقش</span>
          <span>نام کاربری</span>
          <span>آخرین ورود</span>
          <span>وضعیت</span>
          <span>اقدامات</span>
        </div>
        {loading ? (
          <p className="py-6 text-center text-[11.5px] text-[#6b7b94]">در حال بارگذاری…</p>
        ) : employees.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#6b7b94]">کارمندی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-[#1f2a3d]">
            {employeesPager.pageItems.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[1.6fr_1.3fr_1.4fr_1fr_0.9fr_1.4fr] items-center gap-2 px-4 py-3 text-xs"
              >
                <button
                  onClick={() => setDetailId(e.id)}
                  className="text-right font-bold text-[#e7ecf3] underline decoration-dashed underline-offset-4"
                >
                  {e.fullName}
                </button>
                <span className="text-[#cdd6e3]">{deptRoleLabel(e.dept, e.rank, customDeptLabels)}</span>
                <span className="font-num ltr text-[#6b7b94]">{e.username}</span>
                <span className="font-num text-[#6b7b94]">
                  {e.lastLoginAt ? formatJalaliDateTime(e.lastLoginAt) : 'هنوز وارد نشده'}
                </span>
                <span
                  className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    e.isActive ? 'bg-[rgba(16,185,129,.14)] text-[#34d399]' : 'bg-[rgba(248,113,113,.14)] text-[#f87171]'
                  }`}
                >
                  {e.isActive ? 'فعال' : 'مسدود'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setDetailId(e.id)}
                    className="rounded-lg border border-[#1f2a3d] bg-[#18223a] px-2 py-1 text-[10px] font-bold text-[#cdd6e3]"
                  >
                    جزئیات
                  </button>
                  <button
                    onClick={() => void onQuickReset(e)}
                    className="rounded-lg border border-[#1f2a3d] px-2 py-1 text-[10px] font-bold text-[#3b82f6]"
                  >
                    ریست رمز
                  </button>
                  <button
                    onClick={() => requestStatusChange(e)}
                    className={`rounded-lg border border-[#1f2a3d] px-2 py-1 text-[10px] font-bold ${
                      e.isActive ? 'text-[#f87171]' : 'text-[#34d399]'
                    }`}
                  >
                    {e.isActive ? 'تعلیق' : 'فعال‌سازی'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          page={employeesPager.page}
          totalPages={employeesPager.totalPages}
          onChange={employeesPager.setPage}
          variant="dark"
        />
      </section>

      <section className="order-5 rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-5">
          <h3 className="mb-1 text-[14.5px] font-extrabold text-white">مدیریت رمز عبور کارمندان</h3>
          <p className="mb-3 text-[10.5px] text-[#6b7b94]">
            فقط رمز عبور کارمندان واحدها قابل بازنشانی است.
          </p>
          <div className="flex flex-col gap-2">
            {employees.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#28344c] p-5 text-center text-xs text-[#6b7b94]">
                کارمندی ثبت نشده است.
              </div>
            )}
            {employees.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-[#1f2a3d] p-2.5 text-xs">
                <span className="flex-1 font-bold text-[#e7ecf3]">
                  {e.fullName}{' '}
                  <span className="font-normal text-[#6b7b94]">· {DEPT_LABELS[e.dept ?? ''] ?? e.dept}</span>
                </span>
                <button
                  onClick={() => void onQuickReset(e)}
                  className="rounded-lg border border-[#1f2a3d] px-2.5 py-1 text-[10px] font-bold text-[#3b82f6]"
                >
                  بازنشانی رمز
                </button>
              </div>
            ))}
          </div>
      </section>

      {addOpen && (
        <section
          data-testid="inline-create-employee"
          className="order-3 mb-8 rounded-xl border border-dashed border-[#31405d] bg-[#141d2e] p-5"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-black text-white">ایجاد کارمند جدید</h2>
              <p className="mt-1 text-[10.5px] text-[#6b7b94]">اطلاعات حساب، واحد سازمانی و سطح دسترسی را یکجا ثبت کنید.</p>
            </div>
            <button type="button" onClick={() => setAddOpen(false)} className="text-[11px] font-bold text-[#9fb0c7]">بستن</button>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div>
          <label className="mb-1 block text-xs font-bold text-[#e7ecf3]" htmlFor="emp-name">
            نام و نام خانوادگی
          </label>
          <input
            id="emp-name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full rounded-lg border border-[#1f2a3d] p-3 text-xs outline-none transition focus:border-[#3b82f6]"
          />
          </div>
          <div>
          <label className="mb-1 block text-xs font-bold text-[#e7ecf3]" htmlFor="emp-username">
            نام کاربری
          </label>
          <input
            id="emp-username"
            dir="ltr"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="font-num w-full rounded-lg border border-[#1f2a3d] p-3 text-xs outline-none transition focus:border-[#3b82f6]"
          />
          </div>
          <div>
          <label className="mb-1 block text-xs font-bold text-[#e7ecf3]" htmlFor="emp-phone">
            شماره موبایل
          </label>
          <input
            id="emp-phone"
            dir="ltr"
            inputMode="numeric"
            autoComplete="tel"
            value={faDigits(form.phone)}
            onChange={(e) => setForm({ ...form, phone: normalizeIranMobile(e.target.value) })}
            placeholder="۰۹۱۲۱۲۳۴۵۶۷"
            className="font-num w-full rounded-lg border border-[#1f2a3d] p-3 text-xs outline-none transition focus:border-[#3b82f6]"
          />
          </div>
          <div>
          <label className="mb-1 block text-xs font-bold text-[#e7ecf3]" htmlFor="emp-password">
            رمز عبور اولیه
          </label>
          <input
            id="emp-password"
            dir="ltr"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-lg border border-[#1f2a3d] p-3 text-xs outline-none transition focus:border-[#3b82f6]"
          />
          </div>
          </div>

          <div className="mb-1 mt-3 text-xs font-bold text-[#e7ecf3]">رتبه سازمانی</div>
          <div className="flex flex-wrap gap-1.5">
            {RANK_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, rank: r })}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                  form.rank === r ? 'bg-[#3b82f6] text-white' : 'bg-[#18223a] text-[#cdd6e3]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="mb-1 mt-3 text-xs font-bold text-[#e7ecf3]">دسترسی ارجاعات</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setForm({ ...form, referralScope: 'MANAGERS_ONLY' })}
              className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                form.referralScope === 'MANAGERS_ONLY' ? 'bg-[#3b82f6] text-white' : 'bg-[#18223a] text-[#cdd6e3]'
              }`}
            >
              فقط مدیران بخش‌ها
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, referralScope: 'ALL_STAFF' })}
              className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                form.referralScope === 'ALL_STAFF' ? 'bg-[#3b82f6] text-white' : 'bg-[#18223a] text-[#cdd6e3]'
              }`}
            >
              همه کارمندان
            </button>
          </div>

          <div className="mb-1 mt-3 text-xs font-bold text-[#e7ecf3]">واحد سازمانی</div>
          <div className="flex flex-wrap gap-1.5">
            {DEPT_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setForm({ ...form, dept: d.value })}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                  form.dept === d.value ? 'bg-[#3b82f6] text-white' : 'bg-[#18223a] text-[#cdd6e3]'
                }`}
              >
                {d.label}
              </button>
            ))}
            {customDepts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setForm({ ...form, dept: d.id })}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                  form.dept === d.id ? 'bg-[#f59e0b] text-white' : 'bg-[#18223a] text-[#cdd6e3]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {addingDept ? (
            <div className="mt-2 flex gap-2">
              <input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="نام واحد جدید (مثلاً بازاریابی)"
                className="flex-1 rounded-lg border border-[#1f2a3d] p-2.5 text-xs outline-none focus:border-[#3b82f6]"
              />
              <button
                type="button"
                onClick={submitNewDept}
                className="rounded-lg bg-[#3b82f6] px-3 py-2 text-[11px] font-bold text-white"
              >
                افزودن
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingDept(false);
                  setNewDeptName('');
                }}
                className="rounded-lg border border-[#1f2a3d] px-3 py-2 text-[11px] font-bold text-[#cdd6e3]"
              >
                انصراف
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingDept(true)}
              className="mt-2 text-[11px] font-bold text-[#3b82f6]"
            >
              + ایجاد واحد سازمانی جدید
            </button>
          )}

          {form.dept.startsWith('custom_') && catalogGroups.length === 0 && (
            <p className="mt-2 text-[10.5px] text-[#6b7b94]">
              برای واحد سفارشی، کاتالوگ دسترسی از پیش تعریف نشده — پس از ایجاد حساب می‌توانید دسترسی‌ها
              را در جزئیات اضافه کنید.
            </p>
          )}

          {catalogGroups.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-[10.5px] text-[#6b7b94]">دسترسی‌های واحد</div>
              <div className="flex flex-col gap-2">
                {catalogGroups.map((g) => (
                  <div key={g.sectionKey}>
                    <div className="mb-1 text-[11px] font-bold text-[#cdd6e3]">{g.sectionLabelFa}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {g.perms.map((p) => {
                        const checked = selectedPerms.has(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() =>
                              setSelectedPerms((prev) => {
                                const next = new Set(prev);
                                if (checked) next.delete(p.key);
                                else next.add(p.key);
                                return next;
                              })
                            }
                            className={`rounded-lg border px-2.5 py-1.5 text-right text-[11px] transition ${
                              checked ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#1f2a3d] text-[#cdd6e3]'
                            }`}
                          >
                            {p.labelFa}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {addError && (
            <p role="alert" className="mt-2 text-xs text-[#f87171]">
              {addError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">
              انصراف
            </button>
            <button
              onClick={() => void onCreate()}
              className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
            >
              ایجاد حساب و اعلان به مدیر
            </button>
          </div>
        </section>
      )}

      {statusConfirm && (
        <Modal variant="dark" title="تعلیق حساب کارمند" onClose={() => setStatusConfirm(null)}>
          <p className="mb-4 text-xs text-[#6b7b94]">
            آیا حساب «{statusConfirm.fullName}» معلق شود؟ کارمند تا زمان فعال‌سازی مجدد نمی‌تواند وارد
            سامانه شود.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStatusConfirm(null)}
              className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]"
            >
              انصراف
            </button>
            <button
              onClick={() => void confirmSuspend()}
              className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white"
            >
              تعلیق حساب
            </button>
          </div>
        </Modal>
      )}

      {createdCredentials && (
        <Modal
          variant="dark"
          title="اطلاعات ورود کارمند"
          onClose={() => setCreatedCredentials(null)}
        >
          <p className="mb-4 text-xs leading-6 text-[#9fb0c7]">
            حساب «{createdCredentials.fullName}» فعال شد. این اطلاعات را فقط از مسیر امن در اختیار
            کارمند قرار دهید؛ رمز اولیه پس از بستن این پنجره دوباره نمایش داده نمی‌شود.
          </p>
          <dl className="space-y-3 rounded-xl border border-[#1f2a3d] bg-[#101827] p-4 text-xs">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#9fb0c7]">نام کاربری</dt>
              <dd className="font-num ltr select-all font-bold text-white">
                {createdCredentials.username}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#9fb0c7]">شماره موبایل دریافت کد</dt>
              <dd className="font-num ltr select-all font-bold text-white">
                {faDigits(createdCredentials.phone)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#9fb0c7]">رمز عبور اولیه</dt>
              <dd className="font-num ltr select-all font-bold text-white">
                {createdCredentials.password}
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl border border-[#27416c] bg-[#152848] p-3 text-[11px] leading-6 text-[#cdd6e3]">
            کارمند از صفحه ورود مدیران و کارمندان، ابتدا نام کاربری و همین رمز را وارد می‌کند؛ کد
            ورود دومرحله‌ای به شماره موبایل ثبت‌شده ارسال می‌شود.
          </p>
          <button
            type="button"
            onClick={() => setCreatedCredentials(null)}
            className="mt-4 w-full rounded-lg bg-[#3b82f6] px-4 py-2.5 text-xs font-bold text-white"
          >
            متوجه شدم
          </button>
        </Modal>
      )}

      {detailId && detail && (
        <Modal variant="dark" title={detail.fullName} onClose={() => setDetailId(null)}>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-[#18223a] p-2.5">
              <div className="text-[10px] text-[#6b7b94]">آخرین ورود</div>
              <div className="font-num font-bold text-[#e7ecf3]">
                {detail.lastLoginAt ? formatJalaliDateTime(detail.lastLoginAt) : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-[#18223a] p-2.5">
              <div className="text-[10px] text-[#6b7b94]">نام کاربری</div>
              <div className="font-num ltr font-bold text-[#e7ecf3]">{detail.username}</div>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold text-[#e7ecf3]">
              دسترسی‌های فعال{' '}
              <span className="text-[10.5px] font-normal text-[#6b7b94]">
                ({faDigits(detail.permissions.length)})
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {detail.permissions.map((p) => (
              <div key={p.key} className="flex items-center gap-2 rounded-lg border border-[#10b98140] bg-[#10b98108] p-2">
                <span className="flex-1 text-[11px] text-[#cdd6e3]">{p.labelFa}</span>
                <button onClick={() => void onGrant(p.key, false)} className="text-[10px] font-bold text-[#f87171]">
                  حذف
                </button>
              </div>
            ))}
          </div>

          {detail.available.length > 0 && (
            <div className="mt-3 border-t border-[#1f2a3d] pt-3">
              <div className="mb-2 text-xs font-bold text-[#e7ecf3]">افزودن دسترسی</div>
              <div className="grid grid-cols-2 gap-1.5">
                {detail.available.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => void onGrant(p.key, true)}
                    className="rounded-lg border border-dashed border-[#1f2a3d] p-2 text-right text-[11px] text-[#cdd6e3]"
                  >
                    + {p.labelFa}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tempPassword && (
            <div className="mt-4 rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/10 p-3">
              <div className="text-[10px] text-[#6b7b94]">رمز موقت تولیدشده</div>
              <div className="font-num ltr mt-1 text-sm font-black text-[#3b82f6]">{tempPassword}</div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => void onResetPassword()}
              className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
            >
              بازنشانی رمز عبور
            </button>
            <button onClick={() => setDetailId(null)} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">
              بستن
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
