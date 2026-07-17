import { useEffect, useState, type FormEvent } from 'react';
import {
  changeOwnPassword,
  fetchAdmins,
  resetAdminPassword,
  blockAdmin,
  unblockAdmin,
} from '../../api/admins';
import { ApiRequestError } from '../../api/envelope';
import Modal from '../../components/Modal';
import type { AdminRow } from '../../types/admins';

/** CEO/Senior «امنیت و رمز عبور» — own password + managed managers' resets.
 * IT_MANAGER has its own Phase 8 page (رمزها و امنیت); see SecurityRouter. */
export default function OwnSecurityPage() {
  const [pwCur, setPwCur] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [managed, setManaged] = useState<AdminRow[]>([]);
  const [tempPassword, setTempPassword] = useState<{ name: string; value: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reload() {
    fetchAdmins()
      .then((rows) => setManaged(rows.filter((r) => r.managedByCaller)))
      .catch(() => setManaged([]));
  }

  useEffect(reload, []);

  async function onSubmitOwn(e: FormEvent) {
    e.preventDefault();
    setPwOk(null);
    if (pwNew.length < 6) {
      setPwError('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('تکرار رمز عبور جدید مطابقت ندارد.');
      return;
    }
    setPwError(null);
    try {
      await changeOwnPassword(pwCur, pwNew);
      setPwOk('رمز عبور با موفقیت تغییر کرد ✓');
      setPwCur('');
      setPwNew('');
      setPwConfirm('');
    } catch (err) {
      setPwError(err instanceof ApiRequestError ? err.message : 'خطا در تغییر رمز عبور.');
    }
  }

  async function onReset(row: AdminRow) {
    try {
      const result = await resetAdminPassword(row.id, {});
      setTempPassword({ name: row.fullName, value: result.tempPassword });
    } catch {
      setNotice('خطا در بازنشانی رمز.');
    }
  }

  async function onToggleSuspend(row: AdminRow) {
    try {
      if (row.isActive) await blockAdmin(row.id);
      else await unblockAdmin(row.id);
      reload();
    } catch {
      setNotice('خطا در تغییر وضعیت.');
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">امنیت و رمز عبور</h1>
      <p className="mb-6 text-sm text-muted">مدیریت رمز حساب خود و رمز مدیران زیرمجموعه</p>

      {notice && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-xs text-danger">{notice}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-1 text-sm font-bold text-ink">تغییر رمز عبور من</div>
          <p className="mb-4 text-[11.5px] text-muted">رمز عبور حساب مدیریتی خود را به‌روزرسانی کنید.</p>
          <form onSubmit={onSubmitOwn} className="flex flex-col gap-3" noValidate>
            <div>
              <label htmlFor="pw-cur" className="mb-1.5 block text-[11px] text-muted">
                رمز عبور فعلی
              </label>
              <input
                id="pw-cur"
                type="password"
                value={pwCur}
                onChange={(e) => setPwCur(e.target.value)}
                className="ltr w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="pw-new" className="mb-1.5 block text-[11px] text-muted">
                رمز عبور جدید
              </label>
              <input
                id="pw-new"
                type="password"
                placeholder="حداقل ۶ کاراکتر"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                className="ltr w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="pw-confirm" className="mb-1.5 block text-[11px] text-muted">
                تکرار رمز عبور جدید
              </label>
              <input
                id="pw-confirm"
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                className="ltr w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            {pwError && (
              <p role="alert" className="rounded-lg bg-danger/10 p-2.5 text-[11px] text-danger">
                {pwError}
              </p>
            )}
            {pwOk && (
              <p className="rounded-lg bg-[#10b98118] p-2.5 text-[11px] font-bold text-[#059669]">{pwOk}</p>
            )}
            <button
              type="submit"
              className="rounded-lg bg-accent py-2.5 text-sm font-bold text-white transition hover:brightness-110"
            >
              ثبت رمز عبور جدید
            </button>
          </form>
        </div>

        {managed.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="mb-1 text-sm font-bold text-ink">مدیریت رمز سایر مدیران</div>
            <p className="mb-4 text-[11.5px] text-muted">
              بازنشانی رمز عبور مدیران زیرمجموعه و تولید رمز موقت.
            </p>
            <div className="flex flex-col gap-2.5">
              {managed.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-body/50 px-3.5 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
                      {m.fullName}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                          m.isActive ? 'bg-[#10b98124] text-[#059669]' : 'bg-danger/15 text-danger'
                        }`}
                      >
                        {m.isActive ? 'فعال' : 'مسدود'}
                      </span>
                    </div>
                    <div className="ltr font-num text-[10px] text-muted">{m.username}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void onReset(m)}
                      className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent transition hover:bg-accent/20"
                    >
                      تغییر رمز
                    </button>
                    <button
                      onClick={() => void onToggleSuspend(m)}
                      className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted transition hover:text-ink"
                    >
                      {m.isActive ? 'تعلیق' : 'رفع تعلیق'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {tempPassword && (
        <Modal title="بازنشانی رمز عبور" onClose={() => setTempPassword(null)}>
          <p className="mb-2 text-xs text-muted">{tempPassword.name}</p>
          <p className="mb-3 text-[11px] text-muted">رمز موقت تولیدشده — فقط همین یک بار نمایش داده می‌شود:</p>
          <div className="ltr font-num mb-4 rounded-lg bg-body p-3 text-center text-base font-black text-[#059669]">
            {tempPassword.value}
          </div>
          <p className="mb-4 text-[11px] leading-6 text-muted">
            این رمز موقت برای مدیر ارسال می‌شود و در اولین ورود باید تغییر کند.
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
