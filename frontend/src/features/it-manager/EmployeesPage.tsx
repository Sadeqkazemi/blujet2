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
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import type { EmployeeDetail, EmployeeListRow, PermissionCatalog } from '../../types/it-manager';

const DEPT_OPTIONS = [
  { value: 'commercial', label: 'واحد بازرگانی' },
  { value: 'sales', label: 'واحد فروش' },
  { value: 'finance', label: 'واحد مالی' },
  { value: 'it', label: 'واحد IT' },
];

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
    password: '',
    dept: 'commercial',
    rank: 'کارشناس',
  });
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

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
    if (form.password.length < 6) {
      setAddError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    try {
      await createEmployee({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        password: form.password,
        dept: form.dept,
        rank: form.rank,
        permissionKeys: Array.from(selectedPerms),
      });
      setNotice(`کارمند «${form.fullName.trim()}» ایجاد شد ✓`);
      setAddOpen(false);
      setForm({ fullName: '', username: '', password: '', dept: 'commercial', rank: 'کارشناس' });
      setSelectedPerms(new Set());
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'خطا در ایجاد کارمند.');
    }
  }

  async function onToggleStatus(row: EmployeeListRow) {
    try {
      await setEmployeeStatus(row.id, !row.isActive);
      await load();
    } catch {
      setError('خطا در تغییر وضعیت حساب.');
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

  const catalogGroups = catalog?.[form.dept === 'sales' ? 'commercial' : form.dept] ?? [];

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">کاربران و دسترسی‌ها</h1>
          <p className="mt-1 text-sm text-muted">
            مدیریت یوزرها، نقش‌ها و بازنشانی رمز عبور — همه حساب‌ها زیر نظر واحد IT
          </p>
        </div>
        <button
          onClick={() => {
            setAddError(null);
            setAddOpen(true);
          }}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
        >
          افزودن کاربر
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      <section className="rounded-xl border border-border bg-white p-5">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted">در حال بارگذاری…</p>
        ) : employees.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">کارمندی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-border">
            {employees.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-xs font-black text-accent">
                  {e.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => setDetailId(e.id)}
                    className="text-sm font-bold text-ink underline decoration-dashed underline-offset-4"
                  >
                    {e.fullName}
                  </button>
                  <div className="font-num mt-0.5 text-[11px] text-muted">
                    <span className="ltr">{e.username}</span> · {e.dept ?? '—'}
                  </div>
                </div>
                <span className="text-[11px] text-muted">
                  {e.lastLoginAt ? formatJalaliDateTime(e.lastLoginAt) : 'هنوز وارد نشده'}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    e.isActive ? 'bg-[#10b98124] text-[#059669]' : 'bg-danger/15 text-danger'
                  }`}
                >
                  {e.isActive ? 'فعال' : 'مسدود'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDetailId(e.id)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-2"
                  >
                    جزئیات
                  </button>
                  <button
                    onClick={() => void onToggleStatus(e)}
                    className={`rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold ${
                      e.isActive ? 'text-danger' : 'text-[#059669]'
                    }`}
                  >
                    {e.isActive ? 'مسدود کردن' : 'فعال‌سازی'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {addOpen && (
        <Modal title="ایجاد کارمند جدید" onClose={() => setAddOpen(false)}>
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="emp-name">
            نام و نام خانوادگی
          </label>
          <input
            id="emp-name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="emp-username">
            نام کاربری
          </label>
          <input
            id="emp-username"
            dir="ltr"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="font-num w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="emp-password">
            رمز عبور اولیه
          </label>
          <input
            id="emp-password"
            dir="ltr"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          <div className="mb-1 mt-3 text-xs font-bold text-ink">واحد سازمانی</div>
          <div className="flex flex-wrap gap-1.5">
            {DEPT_OPTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setForm({ ...form, dept: d.value })}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                  form.dept === d.value ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {catalogGroups.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-[10.5px] text-muted">دسترسی‌های واحد</div>
              <div className="flex flex-col gap-2">
                {catalogGroups.map((g) => (
                  <div key={g.sectionKey}>
                    <div className="mb-1 text-[11px] font-bold text-text-2">{g.sectionLabelFa}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {g.perms.map((p) => {
                        const checked = selectedPerms.has(p.key);
                        return (
                          <button
                            key={p.key}
                            onClick={() =>
                              setSelectedPerms((prev) => {
                                const next = new Set(prev);
                                if (checked) next.delete(p.key);
                                else next.add(p.key);
                                return next;
                              })
                            }
                            className={`rounded-lg border px-2.5 py-1.5 text-right text-[11px] transition ${
                              checked ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-2'
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
            <p role="alert" className="mt-2 text-xs text-danger">
              {addError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
              انصراف
            </button>
            <button
              onClick={() => void onCreate()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            >
              ایجاد حساب و اعلان به مدیر
            </button>
          </div>
        </Modal>
      )}

      {detailId && detail && (
        <Modal title={detail.fullName} onClose={() => setDetailId(null)}>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-surface p-2.5">
              <div className="text-[10px] text-muted">آخرین ورود</div>
              <div className="font-num font-bold text-ink">
                {detail.lastLoginAt ? formatJalaliDateTime(detail.lastLoginAt) : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-surface p-2.5">
              <div className="text-[10px] text-muted">نام کاربری</div>
              <div className="font-num ltr font-bold text-ink">{detail.username}</div>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold text-ink">
              دسترسی‌های فعال <span className="text-[10.5px] font-normal text-muted">({faDigits(detail.permissions.length)})</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {detail.permissions.map((p) => (
              <div key={p.key} className="flex items-center gap-2 rounded-lg border border-[#10b98140] bg-[#10b98108] p-2">
                <span className="flex-1 text-[11px] text-text-2">{p.labelFa}</span>
                <button onClick={() => void onGrant(p.key, false)} className="text-[10px] font-bold text-danger">
                  حذف
                </button>
              </div>
            ))}
          </div>

          {detail.available.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-2 text-xs font-bold text-ink">افزودن دسترسی</div>
              <div className="grid grid-cols-2 gap-1.5">
                {detail.available.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => void onGrant(p.key, true)}
                    className="rounded-lg border border-dashed border-border p-2 text-right text-[11px] text-text-2"
                  >
                    + {p.labelFa}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tempPassword && (
            <div className="mt-4 rounded-lg border border-accent/40 bg-accent/10 p-3">
              <div className="text-[10px] text-muted">رمز موقت تولیدشده</div>
              <div className="font-num ltr mt-1 text-sm font-black text-accent">{tempPassword}</div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => void onResetPassword()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            >
              بازنشانی رمز عبور
            </button>
            <button onClick={() => setDetailId(null)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
              بستن
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
