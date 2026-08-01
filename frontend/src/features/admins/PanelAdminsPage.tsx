import { useEffect, useState } from 'react';
import {
  blockAdmin,
  createAdmin,
  fetchAdmins,
  resetAdminPassword,
  unblockAdmin,
} from '../../api/admins';
import { ApiRequestError } from '../../api/envelope';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useStepUp } from '../../hooks/useStepUp';
import type { AdminCreatableRole, AdminRow } from '../../types/admins';
import { panelInitials } from '../panel/panel-nav-icons';
import PanelAlert from '../panel/PanelAlert';
import PanelModal from '../panel/PanelModal';
import {
  panelBtnGhost,
  panelBtnPrimary,
  panelCard,
  panelElevated,
  panelInput,
  panelMuted,
  panelMuted2,
  panelText,
  panelTitle,
} from '../panel/panel-theme';

const CREATABLE_ROLES: { value: AdminCreatableRole; label: string }[] = [
  { value: 'SENIOR_MANAGER', label: 'مدیر ارشد' },
  { value: 'FINANCE_MANAGER', label: 'مدیر مالی' },
  { value: 'COMMERCIAL_MANAGER', label: 'مدیر بازرگانی' },
  { value: 'IT_MANAGER', label: 'مدیر IT' },
  { value: 'SITE_ADMIN', label: 'ادمین سایت' },
];

const ROLE_BADGE: Record<string, { color: string; bg: string }> = {
  SENIOR_MANAGER: { color: '#f97316', bg: 'rgba(249,115,22,.16)' },
  FINANCE_MANAGER: { color: '#3b82f6', bg: 'rgba(59,130,246,.16)' },
  COMMERCIAL_MANAGER: { color: '#22d3ee', bg: 'rgba(34,211,238,.16)' },
  IT_MANAGER: { color: '#60a5fa', bg: 'rgba(96,165,250,.16)' },
  SITE_ADMIN: { color: '#a855f7', bg: 'rgba(168,85,247,.16)' },
};

function formatRelativeFa(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return 'همین الان';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${faDigits(mins)} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${faDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${faDigits(days)} روز پیش`;
  return formatJalaliDateTime(iso);
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function RoleBadge({ label, role }: { label: string; role: string }) {
  const style = ROLE_BADGE[role] ?? { color: '#9fb0c7', bg: 'rgba(159,176,199,.16)' };
  return (
    <span
      className="inline-block rounded-[18px] px-2.5 py-1 text-[11px] font-bold"
      style={{ color: style.color, background: style.bg }}
    >
      {label}
    </span>
  );
}

function StatusDot({ row }: { row: AdminRow }) {
  if (!row.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#f87171]">
        <span className="h-[7px] w-[7px] rounded-full bg-[#f87171]" />
        مسدود
      </span>
    );
  }
  if (row.online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#34d399]">
        <span className="h-[7px] w-[7px] rounded-full bg-[#34d399]" />
        آنلاین
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#6b7b94]">
      <span className="h-[7px] w-[7px] rounded-full bg-[#6b7b94]" />
      آفلاین
    </span>
  );
}

/** Dark management-panel admins tab — design-reference-v2/پنل رئیس هیئت مدیره.dc.html */
export default function PanelAdminsPage() {
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
  const [resetDelivery, setResetDelivery] = useState<'sms' | 'email'>('sms');
  const stepUp = useStepUp('ADMIN_ROLE_CHANGE');

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
      const fields = await stepUp.confirm();
      await createAdmin({ ...addForm, ...fields });
      setAddOpen(false);
      setAddForm({
        fullName: '',
        email: '',
        username: '',
        role: 'IT_MANAGER',
        password: '',
        delivery: 'sms',
      });
      setNotice(
        `مدیر جدید افزوده شد و رمز عبور از طریق ${addForm.delivery === 'sms' ? 'پیامک' : 'ایمیل سازمانی'} ارسال شد ✓`,
      );
      reload();
    } catch (err) {
      if (err instanceof Error && err.message === 'CANCELLED') return;
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
      const result = await resetAdminPassword(row.id, {
        ...(explicit ? { password: explicit } : {}),
        delivery: resetDelivery,
      });
      setTempPassword(result.tempPassword);
      setNewPass('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در بازنشانی رمز.');
    }
  }

  if (error) return <PanelAlert>{error}</PanelAlert>;
  if (!rows) return <p className={`text-sm ${panelMuted}`}>در حال بارگذاری…</p>;

  if (selected) {
    return (
      <div className="flex flex-col gap-[15px]">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={`inline-flex w-max items-center gap-1.5 text-xs ${panelMuted2} transition hover:text-white`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
          بازگشت به فهرست ادمین‌ها
        </button>

        <div
          className={`flex flex-wrap items-center gap-[15px] rounded-2xl border border-[#2a3550] bg-gradient-to-br from-[#172339] to-[#1d2a44] p-4`}
        >
          <span className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#9333ea] text-base font-black text-white">
            {panelInitials(selected.fullName)}
          </span>
          <div className="min-w-0 leading-snug">
            <div className="text-lg font-black text-white">{selected.fullName}</div>
            <div className={`font-num ltr text-[11.5px] ${panelMuted2}`}>{selected.email ?? '—'}</div>
          </div>
          <span className="mr-auto">
            <RoleBadge label={selected.roleLabelFa} role={selected.role} />
          </span>
        </div>

        <div className={`${panelCard} p-[15px]`}>
          <h3 className={`mb-1 text-[13.5px] ${panelTitle}`}>امنیت و دسترسی ورود</h3>
          <p className={`mb-4 text-[11.5px] ${panelMuted}`}>
            رمز عبور این مدیر را تغییر دهید یا ورود او به پنل را مسدود/فعال کنید.
          </p>

          <div className={`mb-[18px] flex items-center justify-between gap-2.5 rounded-[11px] bg-[#0f1726] px-[13px] py-[11px]`}>
            <div className="leading-snug">
              <div className={`text-xs font-bold ${panelText}`}>وضعیت ورود به پنل</div>
              <div className={`text-[10.5px] ${panelMuted}`}>نقش: {selected.roleLabelFa}</div>
            </div>
            <span
              className={`rounded-2xl px-[11px] py-1.5 text-[11px] font-extrabold ${
                selected.isActive ? 'bg-[rgba(52,211,153,.16)] text-[#34d399]' : 'bg-[rgba(248,113,113,.16)] text-[#f87171]'
              }`}
            >
              {selected.isActive ? 'فعال' : 'مسدود'}
            </span>
          </div>

          <label className={`mb-2 block text-[11.5px] font-bold ${panelText}`}>تغییر رمز عبور</label>
          <div className="mb-[11px] flex flex-wrap gap-2">
            <input
              dir="ltr"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="رمز جدید (حداقل ۶ کاراکتر)"
              className={`font-num ltr min-w-[180px] flex-1 px-3 py-2.5 text-left text-[12.5px] ${panelInput}`}
            />
            <button
              type="button"
              onClick={() => setNewPass(generatePassword())}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[11.5px] font-bold ${panelBtnGhost}`}
            >
              تولید رمز
            </button>
            <button
              type="button"
              disabled={newPass.length < 6}
              onClick={() => void onResetPassword(selected, newPass)}
              className={`px-[18px] py-2.5 text-xs font-extrabold disabled:opacity-50 ${panelBtnPrimary}`}
            >
              تغییر و ارسال
            </button>
          </div>

          <button
            type="button"
            onClick={() => void onResetPassword(selected)}
            className="mb-4 w-full rounded-[11px] border border-[rgba(59,130,246,.35)] bg-[rgba(59,130,246,.12)] py-2.5 text-xs font-extrabold text-[#60a5fa] transition hover:brightness-110"
          >
            تولید رمز موقت
          </button>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className={`text-[11px] ${panelMuted}`}>ارسال از طریق:</span>
            {(['sms', 'email'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setResetDelivery(d)}
                className={`rounded-[9px] border px-3 py-1.5 text-[11.5px] font-bold transition ${
                  resetDelivery === d
                    ? 'border-[#3b82f6] bg-[rgba(59,130,246,.12)] text-white'
                    : 'border-panel-border-2 text-panel-muted-2'
                }`}
              >
                {d === 'sms' ? 'پیامک' : 'ایمیل سازمانی'}
              </button>
            ))}
          </div>

          {selected.managedByCaller && (
            <button
              type="button"
              onClick={() => void onToggleBlock(selected)}
              className={`flex h-[46px] w-full items-center justify-center rounded-[11px] text-[12.5px] font-extrabold text-white transition hover:brightness-110 ${
                selected.isActive ? 'bg-[#f87171]' : 'bg-[#16a34a]'
              }`}
            >
              {selected.isActive ? 'مسدودسازی ورود به پنل' : 'فعال‌سازی ورود به پنل'}
            </button>
          )}
        </div>

        {tempPassword && (
          <PanelModal title="بازنشانی رمز عبور" onClose={() => setTempPassword(null)}>
            <p className={`mb-3 text-xs ${panelMuted}`}>
              رمز موقت تولیدشده — فقط همین یک بار نمایش داده می‌شود:
            </p>
            <div className="font-num mb-4 rounded-[11px] bg-[#0f1726] p-3 text-center text-base font-black text-[#34d399]">
              {tempPassword}
            </div>
            <button type="button" onClick={() => setTempPassword(null)} className={`w-full py-2.5 ${panelBtnPrimary}`}>
              تأیید
            </button>
          </PanelModal>
        )}
      </div>
    );
  }

  return (
    <div>
      {notice && <PanelAlert tone="success">{notice}</PanelAlert>}

      <div className={`${panelCard} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-panel-border px-[15px] py-3">
          <h3 className={`m-0 text-[14.5px] ${panelTitle}`}>مدیران</h3>
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setAddOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-[9px] bg-panel-accent px-[11px] py-[7px] text-[11.5px] font-bold text-white transition hover:brightness-110"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            افزودن مدیر / ادمین
          </button>
        </div>

        <div className="px-2 py-[5px]">
          <div
            className={`hidden grid-cols-[2fr_1.6fr_1.2fr_1fr_0.5fr] border-b border-panel-border px-[11px] py-2.5 text-[11px] font-bold md:grid ${panelMuted}`}
          >
            <span>نام</span>
            <span>نقش</span>
            <span>آخرین ورود</span>
            <span>وضعیت</span>
            <span />
          </div>

          {rows.length === 0 ? (
            <p className={`py-[22px] text-center text-[11.5px] ${panelMuted}`}>هنوز اطلاعاتی وارد نشده است.</p>
          ) : (
            rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className={`grid w-full grid-cols-1 items-center gap-2 border-b border-[#1b2536] px-[11px] py-3 text-right transition last:border-b-0 hover:bg-[#18223a] md:grid-cols-[2fr_1.6fr_1.2fr_1fr_0.5fr] md:gap-0`}
              >
                <div className="flex items-center gap-[9px]">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#9333ea] text-[11px] font-extrabold text-white">
                    {panelInitials(r.fullName)}
                  </span>
                  <div className="min-w-0 leading-snug">
                    <div className={`text-xs font-semibold ${panelText}`}>{r.fullName}</div>
                    <div className={`font-num ltr text-[10.5px] ${panelMuted}`}>{r.email ?? '—'}</div>
                  </div>
                </div>
                <div className="md:block">
                  <RoleBadge label={r.roleLabelFa} role={r.role} />
                </div>
                <div className={`font-num text-xs ${panelMuted2}`}>{formatRelativeFa(r.lastLoginAt)}</div>
                <div>
                  <StatusDot row={r} />
                </div>
                <span className={`hidden justify-end ${panelMuted} md:flex`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {addOpen && (
        <PanelModal title="افزودن مدیر / ادمین" onClose={() => setAddOpen(false)} wide>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="pa-name" className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                نام و نام خانوادگی
              </label>
              <input
                id="pa-name"
                value={addForm.fullName}
                onChange={(e) => setAddForm((f) => ({ ...f, fullName: e.target.value }))}
                className={`w-full px-3 py-2.5 text-sm ${panelInput}`}
              />
            </div>
            <div>
              <label htmlFor="pa-email" className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                ایمیل سازمانی
              </label>
              <input
                id="pa-email"
                dir="ltr"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                className={`font-num ltr w-full px-3 py-2.5 text-sm ${panelInput}`}
              />
            </div>
            <div>
              <label htmlFor="pa-username" className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                نام کاربری
              </label>
              <input
                id="pa-username"
                dir="ltr"
                value={addForm.username}
                onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                className={`font-num ltr w-full px-3 py-2.5 text-sm ${panelInput}`}
              />
            </div>
            <div>
              <label htmlFor="pa-role" className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                نقش
              </label>
              <select
                id="pa-role"
                value={addForm.role}
                onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as AdminCreatableRole }))}
                className={`w-full px-3 py-2.5 text-sm ${panelInput}`}
              >
                {CREATABLE_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pa-pass" className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                رمز عبور اولیه (حداقل ۶ کاراکتر)
              </label>
              <div className="flex gap-2">
                <input
                  id="pa-pass"
                  dir="ltr"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  className={`font-num ltr min-w-0 flex-1 px-3 py-2.5 text-sm ${panelInput}`}
                />
                <button
                  type="button"
                  onClick={() => setAddForm((f) => ({ ...f, password: generatePassword() }))}
                  className={`shrink-0 px-3 py-2 text-[11px] font-bold ${panelBtnGhost}`}
                >
                  تولید
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] ${panelMuted}`}>ارسال از طریق:</span>
              {(['sms', 'email'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setAddForm((f) => ({ ...f, delivery: d }))}
                  className={`rounded-[9px] border px-3 py-1.5 text-[11px] font-bold transition ${
                    addForm.delivery === d
                      ? 'border-[#3b82f6] bg-[rgba(59,130,246,.12)] text-white'
                      : 'border-panel-border-2 text-panel-muted-2'
                  }`}
                >
                  {d === 'sms' ? 'پیامک' : 'ایمیل سازمانی'}
                </button>
              ))}
            </div>
            {addError && (
              <p role="alert" className="text-xs text-[#f87171]">
                {addError}
              </p>
            )}
            <button type="button" onClick={() => void onSubmitAdd()} className={`py-2.5 ${panelBtnPrimary}`}>
              ایجاد حساب و ارسال رمز
            </button>
          </div>
        </PanelModal>
      )}

      {stepUp.modal}
    </div>
  );
}
