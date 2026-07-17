import { useEffect, useState } from 'react';
import {
  blockAdmin,
  createAdmin,
  fetchAdmins,
  resetAdminPassword,
  unblockAdmin,
} from '../../api/admins';
import { ApiRequestError } from '../../api/envelope';
import Modal from '../../components/Modal';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { AdminCreatableRole, AdminRow } from '../../types/admins';

const CREATABLE_ROLES: { value: AdminCreatableRole; label: string }[] = [
  { value: 'SENIOR_MANAGER', label: 'مدیر ارشد' },
  { value: 'FINANCE_MANAGER', label: 'مدیر مالی' },
  { value: 'COMMERCIAL_MANAGER', label: 'مدیر بازرگانی' },
  { value: 'IT_MANAGER', label: 'مدیر IT' },
  { value: 'SITE_ADMIN', label: 'ادمین سایت' },
];

export default function AdminsPage() {
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [selected, setSelected] = useState<AdminRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    username: '',
    role: 'IT_MANAGER' as AdminCreatableRole,
    password: '',
    delivery: 'sms' as 'sms' | 'email',
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');

  function reload() {
    fetchAdmins()
      .then((data) => {
        setRows(data);
        setSelected((prev) => (prev ? (data.find((r) => r.id === prev.id) ?? null) : null));
      })
      .catch(() => setError('خطا در دریافت فهرست مدیران.'));
  }

  useEffect(reload, []);

  async function onSubmitAdd() {
    const { fullName, email, username, password } = addForm;
    if (!fullName.trim() || !email.trim() || !username.trim() || password.length < 6) {
      setAddError('همهٔ فیلدها الزامی است و رمز باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    setAddError(null);
    try {
      await createAdmin(addForm);
      setAddOpen(false);
      setNotice(
        `مدیر جدید افزوده شد و رمز عبور از طریق ${addForm.delivery === 'sms' ? 'پیامک' : 'ایمیل سازمانی'} ارسال شد ✓`,
      );
      reload();
    } catch (err) {
      setAddError(err instanceof ApiRequestError ? err.message : 'خطا در ایجاد حساب.');
    }
  }

  async function onToggleBlock(row: AdminRow) {
    try {
      if (row.isActive) await blockAdmin(row.id);
      else await unblockAdmin(row.id);
      setNotice(row.isActive ? `ورود «${row.fullName}» مسدود شد.` : `ورود «${row.fullName}» فعال شد.`);
      reload();
    } catch {
      setError('خطا در تغییر وضعیت ورود.');
    }
  }

  async function onResetPassword(row: AdminRow, explicit?: string) {
    try {
      const result = await resetAdminPassword(row.id, explicit ? { password: explicit } : {});
      setTempPassword(result.tempPassword);
      setNewPass('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در بازنشانی رمز.');
    }
  }

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!rows) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  if (selected) {
    return (
      <div className="p-8">
        <button onClick={() => setSelected(null)} className="mb-4 text-xs font-bold text-muted hover:text-ink">
          → بازگشت به فهرست ادمین‌ها
        </button>
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-white p-5">
          <div>
            <div className="text-lg font-black text-ink">{selected.fullName}</div>
            <div className="ltr font-num text-[11.5px] text-muted">{selected.email}</div>
          </div>
          <span className="mr-auto rounded-full bg-accent/10 px-3 py-1 text-[11.5px] font-bold text-accent">
            {selected.roleLabelFa}
          </span>
        </div>

        <div className="max-w-xl rounded-xl border border-border bg-white p-5">
          <div className="mb-1 text-sm font-bold text-ink">امنیت و دسترسی ورود</div>
          <p className="mb-4 text-[11.5px] text-muted">
            رمز عبور این مدیر را تغییر دهید یا ورود او به پنل را مسدود/فعال کنید.
          </p>

          <div className="mb-4 flex items-center justify-between rounded-lg bg-body px-3.5 py-3">
            <div className="text-xs font-bold text-ink">وضعیت ورود به پنل</div>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                selected.isActive ? 'bg-[#10b98124] text-[#059669]' : 'bg-danger/15 text-danger'
              }`}
            >
              {selected.isActive ? 'فعال' : 'مسدود'}
            </span>
          </div>

          <label className="mb-2 block text-[11.5px] font-bold text-ink">تغییر رمز عبور</label>
          <div className="mb-4 flex gap-2">
            <input
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="رمز جدید (حداقل ۶ کاراکتر)"
              className="ltr flex-1 rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              disabled={newPass.length < 6}
              onClick={() => void onResetPassword(selected, newPass)}
              className="rounded-lg bg-accent px-4 py-2.5 text-xs font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              تغییر و ارسال
            </button>
          </div>
          <button
            onClick={() => void onResetPassword(selected)}
            className="mb-4 w-full rounded-lg border border-accent/30 bg-accent/10 py-2.5 text-xs font-extrabold text-accent transition hover:bg-accent/20"
          >
            تولید رمز موقت
          </button>

          {selected.managedByCaller && (
            <button
              onClick={() => void onToggleBlock(selected)}
              className={`w-full rounded-lg py-2.5 text-xs font-extrabold text-white transition hover:brightness-110 ${
                selected.isActive ? 'bg-danger' : 'bg-[#059669]'
              }`}
            >
              {selected.isActive ? 'مسدودسازی ورود به پنل' : 'فعال‌سازی ورود به پنل'}
            </button>
          )}
        </div>

        {tempPassword && (
          <Modal title="بازنشانی رمز عبور" onClose={() => setTempPassword(null)}>
            <p className="mb-3 text-xs text-muted">رمز موقت تولیدشده — فقط همین یک بار نمایش داده می‌شود:</p>
            <div className="ltr font-num mb-4 rounded-lg bg-body p-3 text-center text-base font-black text-[#059669]">
              {tempPassword}
            </div>
            <p className="mb-4 text-[11px] leading-6 text-muted">
              این رمز برای مدیر ارسال می‌شود و در اولین ورود باید تغییر کند.
            </p>
            <button
              onClick={() => setTempPassword(null)}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-bold text-white"
            >
              تأیید و ارسال
            </button>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-xl font-black text-ink">مدیران و ادمین‌ها</h1>
          <p className="text-sm text-muted">حساب‌های مدیریتی واقعی سامانه — وضعیت آنلاین از نشست‌های فعال</p>
        </div>
        <button
          onClick={() => {
            setAddError(null);
            setAddOpen(true);
          }}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
        >
          افزودن مدیر / ادمین
        </button>
      </div>

      {notice && (
        <p className="mb-4 rounded-lg bg-[#10b98118] p-3 text-xs font-bold text-[#059669]">{notice}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted">
              <th className="p-3 font-bold">نام</th>
              <th className="p-3 font-bold">نقش</th>
              <th className="p-3 font-bold">آخرین ورود</th>
              <th className="p-3 font-bold">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="cursor-pointer border-b border-border/60 transition hover:bg-body/60"
              >
                <td className="p-3">
                  <div className="font-bold text-ink">{r.fullName}</div>
                  <div className="ltr font-num text-[10px] text-muted">{r.email}</div>
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                    {r.roleLabelFa}
                  </span>
                </td>
                <td className="font-num p-3 text-muted">
                  {r.lastLoginAt ? formatJalaliDateTime(r.lastLoginAt) : '—'}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                      !r.isActive ? 'text-danger' : r.online ? 'text-[#059669]' : 'text-muted'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        !r.isActive ? 'bg-danger' : r.online ? 'bg-[#059669]' : 'bg-muted'
                      }`}
                    />
                    {!r.isActive ? 'مسدود' : r.online ? 'آنلاین' : 'آفلاین'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <Modal title="افزودن مدیر / ادمین" onClose={() => setAddOpen(false)}>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="na-name" className="mb-1.5 block text-[11.5px] text-muted">
                نام و نام خانوادگی
              </label>
              <input
                id="na-name"
                value={addForm.fullName}
                onChange={(e) => setAddForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="na-email" className="mb-1.5 block text-[11.5px] text-muted">
                ایمیل سازمانی
              </label>
              <input
                id="na-email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                className="ltr w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="na-username" className="mb-1.5 block text-[11.5px] text-muted">
                نام کاربری
              </label>
              <input
                id="na-username"
                value={addForm.username}
                onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                className="ltr w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="na-role" className="mb-1.5 block text-[11.5px] text-muted">
                نقش
              </label>
              <select
                id="na-role"
                value={addForm.role}
                onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as AdminCreatableRole }))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
              >
                {CREATABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="na-pass" className="mb-1.5 block text-[11.5px] text-muted">
                رمز عبور اولیه (حداقل ۶ کاراکتر)
              </label>
              <input
                id="na-pass"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                className="ltr w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              ارسال از طریق:
              {(['sms', 'email'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setAddForm((f) => ({ ...f, delivery: d }))}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${
                    addForm.delivery === d
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted'
                  }`}
                >
                  {d === 'sms' ? 'پیامک' : 'ایمیل سازمانی'}
                </button>
              ))}
            </div>
            {addError && (
              <p role="alert" className="text-xs text-danger">
                {addError}
              </p>
            )}
            <button
              onClick={() => void onSubmitAdd()}
              className="rounded-lg bg-accent py-2.5 text-sm font-bold text-white transition hover:brightness-110"
            >
              ایجاد حساب و ارسال رمز
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
