import type { CSSProperties } from 'react';
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
import {
  StaffAlert,
  StaffPanelPageHeader,
  StaffPrimaryButton,
  StaffSecondaryButton,
  staffSegmentedControl,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { staffCard, staffInput, staffInnerTile, staffPage, staffStatusStyle } from '../../lib/staff-panel-styles';
import Modal from '../../components/Modal';
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

const PERM_MATRIX = [
  { role: 'مدیر مالی', managedBy: 'تحت مدیریت IT', caps: [true, true, false, false, false] },
  { role: 'مدیر بازرگانی', managedBy: 'تحت مدیریت IT', caps: [true, false, false, true, false] },
  { role: 'ادمین سایت', managedBy: 'تحت مدیریت IT', caps: [true, false, true, false, true] },
  { role: 'آژانس', managedBy: 'تحت مدیریت IT', caps: [true, false, false, false, false] },
  { role: 'مدیر ارشد', managedBy: 'فقط رئیس هیئت مدیره', caps: [true, true, true, true, true] },
  { role: 'رئیس هیئت مدیره', managedBy: 'بالاترین سطح', caps: [true, true, true, true, true] },
];

const PERM_COLS = ['داشبورد', 'مالی', 'محتوا', 'کاربران', 'تنظیمات'];

const IT_SCOPE = [
  { label: 'مدیریت کاربران و حساب‌ها', status: 'مجاز', ok: true },
  { label: 'بازنشانی و مدیریت رمز عبور', status: 'مجاز', ok: true },
  { label: 'تعیین دسترسی نقش‌ها', status: 'مجاز', ok: true },
  { label: 'دسترسی به پنل مدیر ارشد', status: 'غیرمجاز', ok: false },
  { label: 'دسترسی به پنل رئیس هیئت مدیره', status: 'غیرمجاز', ok: false },
];

const empTableHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.6fr 1.3fr 1.4fr 1fr 0.9fr 1.4fr',
  gap: 8,
  borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
  padding: '10px 16px',
  fontSize: 10.5,
  fontWeight: 800,
  color: STAFF_PANEL.textMuted,
};

const empTableRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.6fr 1.3fr 1.4fr 1fr 0.9fr 1.4fr',
  gap: 8,
  alignItems: 'center',
  padding: '12px 16px',
  fontSize: 11,
};

const permTableHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr repeat(5, 1fr)',
  gap: 8,
  borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
  padding: '10px 16px',
  fontSize: 10.5,
  fontWeight: 800,
  color: STAFF_PANEL.textMuted,
};

const permTableRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr repeat(5, 1fr)',
  gap: 8,
  alignItems: 'center',
  padding: '12px 16px',
  fontSize: 11,
};

const actionBtn: CSSProperties = {
  borderRadius: 8,
  border: `1px solid ${STAFF_PANEL.inputBorder}`,
  background: 'transparent',
  padding: '4px 8px',
  fontSize: 10,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 800,
  color: STAFF_PANEL.text,
};

const fieldInput: CSSProperties = {
  ...staffInput,
  width: '100%',
  padding: 12,
  fontSize: 11,
  boxSizing: 'border-box',
};

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
        referralScope: form.referralScope,
        permissionKeys: Array.from(selectedPerms),
      });
      setNotice(`کارمند «${form.fullName.trim()}» ایجاد شد ✓`);
      setAddOpen(false);
      setForm({
        fullName: '',
        username: '',
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
    <div style={staffPage}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <StaffPanelPageHeader
          title="کاربران و دسترسی‌ها"
          subtitle="مدیریت یوزرها، نقش‌ها و بازنشانی رمز عبور — همه حساب‌ها زیر نظر واحد IT"
        />
        <div style={{ paddingTop: 4 }}>
          <StaffPrimaryButton
            onClick={() => {
              setAddError(null);
              setAddOpen(true);
            }}
          >
            افزودن کاربر
          </StaffPrimaryButton>
        </div>
      </div>

      {error && <StaffAlert tone="error">{error}</StaffAlert>}
      {notice && <StaffAlert tone="success">{notice}</StaffAlert>}

      <section style={{ ...staffCard, marginBottom: 32 }}>
        <div style={empTableHeader}>
          <span>کاربر</span>
          <span>نقش</span>
          <span>نام کاربری</span>
          <span>آخرین ورود</span>
          <span>وضعیت</span>
          <span>اقدامات</span>
        </div>
        {loading ? (
          <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>
        ) : employees.length === 0 ? (
          <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted }}>کارمندی ثبت نشده است.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {employees.map((e, idx) => (
              <li
                key={e.id}
                style={{
                  ...empTableRow,
                  borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => setDetailId(e.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'right',
                    fontWeight: 800,
                    color: STAFF_PANEL.text,
                    textDecoration: 'underline dashed',
                    textUnderlineOffset: 4,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 11,
                  }}
                >
                  {e.fullName}
                </button>
                <span style={{ color: STAFF_PANEL.navMuted }}>{deptRoleLabel(e.dept, e.rank, customDeptLabels)}</span>
                <span className="font-num" style={{ direction: 'ltr', color: STAFF_PANEL.textMuted }}>{e.username}</span>
                <span className="font-num" style={{ color: STAFF_PANEL.textMuted }}>
                  {e.lastLoginAt ? formatJalaliDateTime(e.lastLoginAt) : 'هنوز وارد نشده'}
                </span>
                <span style={staffStatusStyle(e.isActive ? 'success' : 'danger')}>
                  {e.isActive ? 'فعال' : 'مسدود'}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setDetailId(e.id)}
                    style={{ ...actionBtn, color: STAFF_PANEL.navMuted, background: STAFF_PANEL.inputBg }}
                  >
                    جزئیات
                  </button>
                  <button
                    type="button"
                    onClick={() => void onQuickReset(e)}
                    style={{ ...actionBtn, color: STAFF_PANEL.link }}
                  >
                    ریست رمز
                  </button>
                  <button
                    type="button"
                    onClick={() => requestStatusChange(e)}
                    style={{ ...actionBtn, color: e.isActive ? STAFF_PANEL.danger : STAFF_PANEL.success }}
                  >
                    {e.isActive ? 'تعلیق' : 'فعال‌سازی'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ height: 20, width: 4, borderRadius: 2, background: STAFF_PANEL.warning }} />
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text, margin: 0 }}>دسترسی و سطوح کارمندان</h2>
          <p style={{ fontSize: 11, color: STAFF_PANEL.textMuted, margin: 0 }}>تعیین سطح دسترسی کارمندان واحدها و مدیریت رمز عبور</p>
        </div>
      </div>

      <div
        style={{
          marginBottom: 16,
          borderRadius: 14,
          border: `1px solid ${STAFF_PANEL.cardBorder}`,
          background: STAFF_PANEL.cardBg,
          padding: 16,
          fontSize: 11,
          lineHeight: 1.7,
          color: STAFF_PANEL.navMuted,
        }}
      >
        واحد IT فقط دسترسی <strong style={{ color: STAFF_PANEL.text }}>کارمندان</strong> واحدها را تعیین می‌کند.
        دسترسی به پنل‌های مدیریتی توسط <strong style={{ color: STAFF_PANEL.text }}>مدیر عامل</strong> و{' '}
        <strong style={{ color: STAFF_PANEL.text }}>مدیر ارشد</strong> مدیریت می‌شود.
      </div>

      <section style={{ ...staffCard, marginBottom: 24 }}>
        <div style={permTableHeader}>
          <span>نقش</span>
          {PERM_COLS.map((c) => (
            <span key={c} style={{ textAlign: 'center' }}>
              {c}
            </span>
          ))}
        </div>
        {PERM_MATRIX.map((p, idx) => (
          <div
            key={p.role}
            style={{
              ...permTableRow,
              borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{p.role}</div>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>{p.managedBy}</div>
            </div>
            {p.caps.map((ok, i) => (
              <span key={i} style={{ textAlign: 'center', fontSize: 14, color: ok ? STAFF_PANEL.success : STAFF_PANEL.textMuted }}>
                {ok ? '✓' : '—'}
              </span>
            ))}
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <section
            style={{
              borderRadius: 14,
              border: `1px solid ${STAFF_PANEL.cardBorder}`,
              background: STAFF_PANEL.cardBg,
              padding: 20,
            }}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>مدیریت رمز عبور کارمندان</h3>
            <p style={{ margin: '0 0 12px', fontSize: 10.5, color: STAFF_PANEL.textMuted }}>
              فقط رمز عبور کارمندان واحدها قابل بازنشانی است.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {employees.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 8,
                    border: `1px solid ${STAFF_PANEL.inputBorder}`,
                    padding: 10,
                    fontSize: 11,
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 800, color: STAFF_PANEL.text }}>
                    {e.fullName}{' '}
                    <span style={{ fontWeight: 400, color: STAFF_PANEL.textMuted }}>· {DEPT_LABELS[e.dept ?? ''] ?? e.dept}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void onQuickReset(e)}
                    style={{ ...actionBtn, color: STAFF_PANEL.link }}
                  >
                    بازنشانی رمز
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              borderRadius: 14,
              border: `1px solid ${STAFF_PANEL.cardBorder}`,
              background: STAFF_PANEL.cardBg,
              padding: 20,
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>سطح دسترسی واحد IT</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {IT_SCOPE.map((s, idx) => (
                <li
                  key={s.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    fontSize: 11,
                    borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
                  }}
                >
                  <span style={{ color: STAFF_PANEL.navMuted }}>{s.label}</span>
                  <span style={{ fontWeight: 800, color: s.ok ? STAFF_PANEL.success : STAFF_PANEL.danger }}>
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {addOpen && (
        <Modal dark title="ایجاد کارمند جدید" onClose={() => setAddOpen(false)}>
          <label style={labelStyle} htmlFor="emp-name">
            نام و نام خانوادگی
          </label>
          <input
            id="emp-name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            style={fieldInput}
          />
          <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="emp-username">
            نام کاربری
          </label>
          <input
            id="emp-username"
            dir="ltr"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="font-num"
            style={fieldInput}
          />
          <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="emp-password">
            رمز عبور اولیه
          </label>
          <input
            id="emp-password"
            dir="ltr"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={fieldInput}
          />

          <div style={{ marginTop: 12, marginBottom: 4, fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>رتبه سازمانی</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {RANK_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, rank: r })}
                style={staffSegmentedControl(form.rank === r)}
              >
                {r}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, marginBottom: 4, fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>دسترسی ارجاعات</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              onClick={() => setForm({ ...form, referralScope: 'MANAGERS_ONLY' })}
              style={staffSegmentedControl(form.referralScope === 'MANAGERS_ONLY')}
            >
              فقط مدیران بخش‌ها
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, referralScope: 'ALL_STAFF' })}
              style={staffSegmentedControl(form.referralScope === 'ALL_STAFF')}
            >
              همه کارمندان
            </button>
          </div>

          <div style={{ marginTop: 12, marginBottom: 4, fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>واحد سازمانی</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DEPT_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setForm({ ...form, dept: d.value })}
                style={staffSegmentedControl(form.dept === d.value)}
              >
                {d.label}
              </button>
            ))}
            {customDepts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setForm({ ...form, dept: d.id })}
                style={{
                  ...staffSegmentedControl(form.dept === d.id),
                  ...(form.dept === d.id ? { background: STAFF_PANEL.warning } : {}),
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          {addingDept ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="نام واحد جدید (مثلاً بازاریابی)"
                style={{ ...fieldInput, flex: 1, padding: 10 }}
              />
              <StaffPrimaryButton onClick={submitNewDept}>افزودن</StaffPrimaryButton>
              <StaffSecondaryButton
                onClick={() => {
                  setAddingDept(false);
                  setNewDeptName('');
                }}
              >
                انصراف
              </StaffSecondaryButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingDept(true)}
              style={{
                marginTop: 8,
                background: 'none',
                border: 'none',
                fontSize: 11,
                fontWeight: 800,
                color: STAFF_PANEL.link,
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: 0,
              }}
            >
              + ایجاد واحد سازمانی جدید
            </button>
          )}

          {form.dept.startsWith('custom_') && catalogGroups.length === 0 && (
            <p style={{ marginTop: 8, fontSize: 10.5, color: STAFF_PANEL.textMuted }}>
              برای واحد سفارشی، کاتالوگ دسترسی از پیش تعریف نشده — پس از ایجاد حساب می‌توانید دسترسی‌ها
              را در جزئیات اضافه کنید.
            </p>
          )}

          {catalogGroups.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8, fontSize: 10.5, color: STAFF_PANEL.textMuted }}>دسترسی‌های واحد</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catalogGroups.map((g) => (
                  <div key={g.sectionKey}>
                    <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 800, color: STAFF_PANEL.navMuted }}>{g.sectionLabelFa}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
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
                            style={{
                              borderRadius: 8,
                              border: `1px solid ${checked ? STAFF_PANEL.accent : STAFF_PANEL.inputBorder}`,
                              background: checked ? STAFF_PANEL.accentSoft : 'transparent',
                              color: checked ? STAFF_PANEL.accent : STAFF_PANEL.navMuted,
                              padding: '6px 10px',
                              textAlign: 'right',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
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
            <p role="alert" style={{ marginTop: 8, fontSize: 11, color: STAFF_PANEL.danger }}>
              {addError}
            </p>
          )}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <StaffSecondaryButton onClick={() => setAddOpen(false)}>انصراف</StaffSecondaryButton>
            <StaffPrimaryButton onClick={() => void onCreate()}>ایجاد حساب و اعلان به مدیر</StaffPrimaryButton>
          </div>
        </Modal>
      )}

      {statusConfirm && (
        <Modal dark title="تعلیق حساب کارمند" onClose={() => setStatusConfirm(null)}>
          <p style={{ marginBottom: 16, fontSize: 11, color: STAFF_PANEL.textMuted }}>
            آیا حساب «{statusConfirm.fullName}» معلق شود؟ کارمند تا زمان فعال‌سازی مجدد نمی‌تواند وارد
            سامانه شود.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <StaffSecondaryButton onClick={() => setStatusConfirm(null)}>انصراف</StaffSecondaryButton>
            <button
              type="button"
              onClick={() => void confirmSuspend()}
              style={{
                borderRadius: 10,
                background: STAFF_PANEL.danger,
                color: '#fff',
                padding: '8px 16px',
                fontSize: 11.5,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              تعلیق حساب
            </button>
          </div>
        </Modal>
      )}

      {detailId && detail && (
        <Modal dark title={detail.fullName} onClose={() => setDetailId(null)}>
          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 11 }}>
            <div style={staffInnerTile}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>آخرین ورود</div>
              <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>
                {detail.lastLoginAt ? formatJalaliDateTime(detail.lastLoginAt) : '—'}
              </div>
            </div>
            <div style={staffInnerTile}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>نام کاربری</div>
              <div className="font-num" style={{ direction: 'ltr', fontWeight: 800, color: STAFF_PANEL.text }}>{detail.username}</div>
            </div>
          </div>

          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>
              دسترسی‌های فعال{' '}
              <span style={{ fontSize: 10.5, fontWeight: 400, color: STAFF_PANEL.textMuted }}>
                ({faDigits(detail.permissions.length)})
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {detail.permissions.map((p) => (
              <div
                key={p.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 8,
                  border: '1px solid rgba(52,211,153,0.25)',
                  background: 'rgba(52,211,153,0.08)',
                  padding: 8,
                }}
              >
                <span style={{ flex: 1, fontSize: 11, color: STAFF_PANEL.navMuted }}>{p.labelFa}</span>
                <button
                  type="button"
                  onClick={() => void onGrant(p.key, false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 10,
                    fontWeight: 800,
                    color: STAFF_PANEL.danger,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>

          {detail.available.length > 0 && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${STAFF_PANEL.sidebarBorder}`, paddingTop: 12 }}>
              <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>افزودن دسترسی</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {detail.available.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => void onGrant(p.key, true)}
                    style={{
                      borderRadius: 8,
                      border: `1px dashed ${STAFF_PANEL.inputBorder}`,
                      background: 'transparent',
                      padding: 8,
                      textAlign: 'right',
                      fontSize: 11,
                      color: STAFF_PANEL.navMuted,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    + {p.labelFa}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tempPassword && (
            <div
              style={{
                marginTop: 16,
                borderRadius: 8,
                border: `1px solid rgba(59,130,246,0.4)`,
                background: STAFF_PANEL.accentSoft,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>رمز موقت تولیدشده</div>
              <div className="font-num" style={{ direction: 'ltr', marginTop: 4, fontSize: 13, fontWeight: 900, color: STAFF_PANEL.link }}>
                {tempPassword}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <StaffPrimaryButton onClick={() => void onResetPassword()}>بازنشانی رمز عبور</StaffPrimaryButton>
            <StaffSecondaryButton onClick={() => setDetailId(null)}>بستن</StaffSecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
