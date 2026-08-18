import { useEffect, useState } from 'react';
import {
  changeBoardChairPasswordMock,
  createBoardChairAccountMock,
  fetchBoardChairAccountMock,
} from '../../api/it-board-chair-mock';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import type { BoardChairAccountMock } from '../../types/it-board-chair';

/**
 * ⚠️ Preview UI only — see api/it-board-chair-mock.ts. Not wired to any
 * real backend capability; backend/src/modules/admins/admins.service.ts
 * currently keeps CEO/BOARD_CHAIR accounts unmanageable by IT_MANAGER on
 * purpose (separation of duties). Flagged in the PR as a known limitation
 * pending an explicit product/security decision before real wiring.
 */
export default function BoardChairAccountSection() {
  const [account, setAccount] = useState<BoardChairAccountMock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', username: '', password: '' });
  const [createError, setCreateError] = useState<string | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetchBoardChairAccountMock()
      .then(setAccount)
      .catch(() => setError('خطا در دریافت وضعیت حساب رئیس هیئت مدیره.'));
  }, []);

  async function submitCreate() {
    try {
      const updated = await createBoardChairAccountMock(createForm);
      setAccount(updated);
      setCreateOpen(false);
      setCreateForm({ fullName: '', username: '', password: '' });
      setNotice(`حساب «${updated.fullName}» ایجاد شد ✓ (پیش‌نمایش — بدون اتصال به بک‌اند واقعی)`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'خطا در ایجاد حساب.');
    }
  }

  async function submitPasswordChange() {
    try {
      const updated = await changeBoardChairPasswordMock(newPassword);
      setAccount(updated);
      setPasswordOpen(false);
      setNewPassword('');
      setNotice('رمز عبور حساب رئیس هیئت مدیره تغییر کرد ✓ (پیش‌نمایش — بدون اتصال به بک‌اند واقعی)');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'خطا در تغییر رمز عبور.');
    }
  }

  return (
    <section className="rounded-xl border border-dashed border-[#f59e0b]/50 bg-[#141d2e] p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#f59e0b]/15 text-sm text-[#f59e0b]">⚑</span>
        <div>
          <h3 className="text-[13.5px] font-extrabold text-white">حساب رئیس هیئت مدیره</h3>
          <p className="mt-1 text-[10.5px] leading-6 text-[#9fb0c7]">
            پیش‌نمایش رابط کاربری — هنوز به بک‌اند واقعی متصل نیست. سیاست فعلی سامانه، مدیریت حساب رئیس
            هیئت مدیره را فقط در اختیار <b className="text-white">مدیر عامل</b>، <b className="text-white">رئیس هیئت مدیره</b> و{' '}
            <b className="text-white">مدیر ارشد</b> قرار می‌دهد؛ فعال‌سازی واقعی این بخش برای واحد IT نیازمند تصمیم محصول/امنیت است.
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-xs text-[#f87171]">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-[rgba(16,185,129,.12)] p-3 text-xs text-[#34d399]">{notice}</p>}

      {account === null ? (
        <p className="text-xs text-[#6b7b94]">در حال بارگذاری…</p>
      ) : !account.exists ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1f2a3d] p-3">
          <span className="text-xs text-[#9fb0c7]">حسابی برای رئیس هیئت مدیره ثبت نشده است.</span>
          <button onClick={() => { setCreateError(null); setCreateOpen(true); }} className="rounded-lg bg-[#f59e0b] px-3 py-1.5 text-[11px] font-bold text-[#1a1204]">
            ایجاد حساب
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1f2a3d] p-3">
          <div>
            <div className="text-xs font-bold text-[#e7ecf3]">{account.fullName}</div>
            <div className="font-num mt-0.5 text-[10.5px] text-[#6b7b94]" dir="ltr">{account.username}</div>
            <div className="mt-1 text-[10px] text-[#6b7b94]">
              آخرین تغییر رمز: {account.lastPasswordChangeAt ? formatJalaliDateTime(account.lastPasswordChangeAt) : '—'}
            </div>
          </div>
          <button onClick={() => { setPasswordError(null); setNewPassword(''); setPasswordOpen(true); }} className="rounded-lg border border-[#28344c] px-3 py-1.5 text-[11px] font-bold text-[#f59e0b]">
            تغییر رمز عبور
          </button>
        </div>
      )}

      {createOpen && (
        <Modal variant="dark" title="ایجاد حساب رئیس هیئت مدیره (پیش‌نمایش)" onClose={() => setCreateOpen(false)}>
          <label htmlFor="bc-name" className="mb-1 block text-xs font-bold text-[#e7ecf3]">نام و نام خانوادگی</label>
          <input
            id="bc-name"
            value={createForm.fullName}
            onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
            className="w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
          />
          <label htmlFor="bc-username" className="mb-1 mt-3 block text-xs font-bold text-[#e7ecf3]">نام کاربری</label>
          <input
            id="bc-username"
            dir="ltr"
            value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
            className="font-num w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
          />
          <label htmlFor="bc-password" className="mb-1 mt-3 block text-xs font-bold text-[#e7ecf3]">رمز عبور اولیه</label>
          <input
            id="bc-password"
            dir="ltr"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            className="font-num w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
          />
          {createError && <p role="alert" className="mt-2 text-xs text-[#f87171]">{createError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setCreateOpen(false)} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">انصراف</button>
            <button onClick={() => void submitCreate()} className="rounded-lg bg-[#f59e0b] px-4 py-2 text-xs font-bold text-[#1a1204]">ایجاد حساب</button>
          </div>
        </Modal>
      )}

      {passwordOpen && (
        <Modal variant="dark" title="تغییر رمز عبور رئیس هیئت مدیره (پیش‌نمایش)" onClose={() => setPasswordOpen(false)}>
          <label htmlFor="bc-new-password" className="mb-1 block text-xs font-bold text-[#e7ecf3]">رمز عبور جدید</label>
          <input
            id="bc-new-password"
            dir="ltr"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="font-num w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
          />
          {passwordError && <p role="alert" className="mt-2 text-xs text-[#f87171]">{passwordError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setPasswordOpen(false)} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">انصراف</button>
            <button onClick={() => void submitPasswordChange()} className="rounded-lg bg-[#f59e0b] px-4 py-2 text-xs font-bold text-[#1a1204]">ثبت رمز جدید</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
