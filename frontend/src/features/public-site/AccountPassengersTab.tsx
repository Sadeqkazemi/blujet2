import { useState } from 'react';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { SavedPassenger } from '../../types/public-site';

const STR: Record<
  StoredLocale,
  {
    hdr: string;
    sub: string;
    empty: string;
    add: string;
    remove: string;
    save: string;
    cancel: string;
    edit: string;
    fullName: string;
    latinName: string;
    nationalId: string;
    passportNo: string;
    mobile: string;
    isChild: string;
    modalAdd: string;
    modalEdit: string;
    idRequired: string;
  }
> = {
  fa: {
    hdr: 'مسافران ذخیره‌شده',
    sub: 'مسافرانی که برای رزروهای بعدی ذخیره کرده‌اید',
    empty: 'مسافری ذخیره نشده است.',
    add: 'افزودن مسافر',
    remove: 'حذف',
    save: 'ذخیره',
    cancel: 'انصراف',
    edit: 'ویرایش',
    fullName: 'نام و نام خانوادگی',
    latinName: 'نام لاتین (روی بلیط)',
    nationalId: 'کد ملی',
    passportNo: 'شماره گذرنامه',
    mobile: 'موبایل',
    isChild: 'مسافر کودک',
    modalAdd: 'افزودن مسافر',
    modalEdit: 'ویرایش مسافر',
    idRequired: 'حداقل یکی از کد ملی یا گذرنامه الزامی است.',
  },
  en: {
    hdr: 'Saved Passengers',
    sub: 'Passengers saved for future bookings',
    empty: 'No passengers saved.',
    add: 'Add Passenger',
    remove: 'Remove',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    fullName: 'Full name',
    latinName: 'Latin name (on ticket)',
    nationalId: 'National ID',
    passportNo: 'Passport number',
    mobile: 'Mobile',
    isChild: 'Child passenger',
    modalAdd: 'Add passenger',
    modalEdit: 'Edit passenger',
    idRequired: 'At least one of national ID or passport is required.',
  },
  ar: {
    hdr: 'المسافرون المحفوظون',
    sub: 'مسافرون حفظتهم للحجوزات القادمة',
    empty: 'لا يوجد مسافرون محفوظون.',
    add: 'إضافة مسافر',
    remove: 'إزالة',
    save: 'حفظ',
    cancel: 'إلغاء',
    edit: 'تعديل',
    fullName: 'الاسم الكامل',
    latinName: 'الاسم اللاتيني (على التذكرة)',
    nationalId: 'الرقم الوطني',
    passportNo: 'رقم جواز السفر',
    mobile: 'الجوال',
    isChild: 'مسافر طفل',
    modalAdd: 'إضافة مسافر',
    modalEdit: 'تعديل المسافر',
    idRequired: 'مطلوب الرقم الوطني أو جواز السفر على الأقل.',
  },
};

export interface SavedPassengerForm {
  fullName: string;
  latinName: string;
  nationalId: string;
  passportNo: string;
  mobile: string;
  isChild: boolean;
}

export const emptyPassengerForm = (): SavedPassengerForm => ({
  fullName: '',
  latinName: '',
  nationalId: '',
  passportNo: '',
  mobile: '',
  isChild: false,
});

export function passengerInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('');
}

export function passengerMeta(p: SavedPassenger): string {
  const idPart = p.passportNo ?? p.nationalId ?? '';
  return `${p.latinName}${idPart ? ` · ${idPart}` : ''}`;
}

interface Props {
  passengers: SavedPassenger[];
  busyId: string | null;
  formBusy: boolean;
  formError: string | null;
  onRemove: (id: string) => void;
  onSave: (form: SavedPassengerForm, editingId: string | null) => Promise<void>;
}

export default function AccountPassengersTab({
  passengers,
  busyId,
  formBusy,
  formError,
  onRemove,
  onSave,
}: Props) {
  const { locale } = useLocale();
  const t = STR[locale];
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SavedPassengerForm>(emptyPassengerForm());
  const [localError, setLocalError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(emptyPassengerForm());
    setLocalError(null);
    setModalOpen(true);
  }

  function openEdit(p: SavedPassenger) {
    setEditingId(p.id);
    setForm({
      fullName: p.fullName,
      latinName: p.latinName,
      nationalId: p.nationalId ?? '',
      passportNo: p.passportNo ?? '',
      mobile: p.mobile ?? '',
      isChild: p.isChild,
    });
    setLocalError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (formBusy) return;
    setModalOpen(false);
    setEditingId(null);
    setLocalError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.latinName.trim()) return;
    if (!form.nationalId.trim() && !form.passportNo.trim()) {
      setLocalError(t.idRequired);
      return;
    }
    setLocalError(null);
    void onSave(form, editingId)
      .then(() => {
        setModalOpen(false);
        setEditingId(null);
      })
      .catch(() => undefined);
  }

  return (
    <>
      <div
        data-testid="account-passengers"
        style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 18 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px' }}>{t.hdr}</h2>
            <p style={{ fontSize: 11.5, color: '#8a96a6', margin: 0 }}>{t.sub}</p>
          </div>
          <button
            type="button"
            data-testid="passengers-add-open"
            onClick={openAdd}
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: '#1668c4',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + {t.add}
          </button>
        </div>

        {passengers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#9aa4b2', fontSize: 11.5 }}>
            {t.empty}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {passengers.map((p) => (
              <div
                key={p.id}
                data-testid="account-passenger"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  border: '1px solid #eef1f5',
                  borderRadius: 12,
                  padding: '11px 13px',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#eef4fb',
                    color: '#1668c4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 12,
                    flex: 'none',
                  }}
                >
                  {passengerInitials(p.fullName)}
                </div>
                <div style={{ lineHeight: 1.5, flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                    {p.fullName}
                    {p.isChild && locale === 'fa' ? ' (کودک)' : p.isChild && locale === 'en' ? ' (child)' : p.isChild ? ' (طفل)' : ''}
                  </div>
                  <div
                    dir="ltr"
                    style={{
                      fontSize: 10.5,
                      color: '#9aa4b2',
                      fontFamily: 'Roboto Mono, monospace',
                    }}
                  >
                    {passengerMeta(p)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={t.edit}
                  data-testid={`passenger-edit-${p.id}`}
                  onClick={() => openEdit(p)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#1668c4',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.edit}
                </button>
                <button
                  type="button"
                  aria-label={t.remove}
                  disabled={busyId === p.id}
                  onClick={() => onRemove(p.id)}
                  style={{
                    fontSize: 14,
                    color: '#c2cad6',
                    background: 'none',
                    border: 'none',
                    cursor: busyId === p.id ? 'wait' : 'pointer',
                    padding: 4,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="passengers-form-modal"
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7,12,22,.55)',
            zIndex: 210,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            style={{
              background: '#fff',
              borderRadius: 18,
              width: 460,
              maxWidth: '100%',
              overflow: 'hidden',
              boxShadow: '0 30px 80px -20px rgba(13,38,102,.35)',
            }}
          >
            <div
              style={{
                padding: '18px 20px',
                borderBottom: '1px solid #eef1f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0d2640' }}>
                {editingId ? t.modalEdit : t.modalAdd}
              </div>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: '#f4f6fa',
                  color: '#5a6678',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(localError || formError) && (
                <p role="alert" style={{ fontSize: 12, color: '#e5484d', margin: 0 }}>
                  {localError ?? formError}
                </p>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0d2640' }}>{t.fullName}</span>
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0d2640' }}>{t.latinName}</span>
                <input
                  required
                  dir="ltr"
                  value={form.latinName}
                  onChange={(e) => setForm((f) => ({ ...f, latinName: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0d2640' }}>{t.nationalId}</span>
                <input
                  dir="ltr"
                  value={form.nationalId}
                  onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0d2640' }}>{t.passportNo}</span>
                <input
                  dir="ltr"
                  value={form.passportNo}
                  onChange={(e) => setForm((f) => ({ ...f, passportNo: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0d2640' }}>{t.mobile}</span>
                <input
                  dir="ltr"
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={form.isChild}
                  onChange={(e) => setForm((f) => ({ ...f, isChild: e.target.checked }))}
                />
                {t.isChild}
              </label>
              <button
                type="submit"
                data-testid="passengers-form-save"
                disabled={formBusy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 50,
                  borderRadius: 12,
                  background: '#1668c4',
                  color: '#fff',
                  fontSize: 13.5,
                  fontWeight: 800,
                  border: 'none',
                  cursor: formBusy ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  marginTop: 4,
                }}
              >
                {formBusy ? '…' : t.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 46,
  border: '1.5px solid #e3e8ef',
  borderRadius: 12,
  padding: '0 12px',
  fontSize: 13,
  color: '#16202e',
  fontFamily: 'inherit',
};
