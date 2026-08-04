import { useState } from 'react';
import { sendManagerMessage } from '../../api/cartable';
import type { ManagerMessageDept } from '../../types/cartable';
import PanelModal from '../panel/PanelModal';
import { panelBtnGhost, panelBtnPrimary, panelInput, panelMuted, panelText } from '../panel/panel-theme';

const DEPT_OPTIONS: { value: ManagerMessageDept; label: string }[] = [
  { value: 'FINANCE', label: 'واحد مالی' },
  { value: 'COMMERCIAL', label: 'واحد بازرگانی' },
  { value: 'SUPPORT', label: 'واحد پشتیبانی' },
  { value: 'AGENCIES', label: 'واحد آژانس‌ها' },
  { value: 'CEO', label: 'مدیر عامل سامانه' },
  { value: 'ALL_MANAGERS', label: 'همه مدیران (اعلان عمومی)' },
];

interface Props {
  onClose: () => void;
  onSent: (label: string) => void;
  theme?: 'light' | 'dark';
}

export default function ComposeMessageModal({ onClose, onSent, theme = 'light' }: Props) {
  const dark = theme === 'dark';
  const [toDept, setToDept] = useState<ManagerMessageDept | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fieldClass = dark
    ? 'w-full rounded-[11px] border border-[#28344c] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]'
    : 'w-full rounded-lg border border-border bg-white p-3 text-xs outline-none transition focus:border-accent';
  const labelClass = `mb-1 block text-xs font-bold ${dark ? 'text-[#e7ecf3]' : 'text-ink'}`;

  async function onSubmit() {
    if (!toDept || !subject.trim() || !body.trim()) {
      setError('گیرنده، موضوع و متن پیام الزامی است.');
      return;
    }
    try {
      await sendManagerMessage({ toDept, subject: subject.trim(), body: body.trim() });
      onSent(DEPT_OPTIONS.find((d) => d.value === toDept)?.label ?? toDept);
      onClose();
    } catch {
      setError('خطا در ارسال پیام.');
    }
  }

  return (
    <Modal title="ایجاد پیام جدید" onClose={onClose} variant={dark ? 'dark' : 'light'}>
      <label className={labelClass} htmlFor="compose-dept">
        گیرنده سازمانی
      </label>
      <select
        id="compose-dept"
        value={toDept}
        onChange={(e) => setToDept(e.target.value as ManagerMessageDept | '')}
        className={fieldClass}
      >
        <option value="">انتخاب گیرنده…</option>
        {DEPT_OPTIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      <label className={`${labelClass} mt-3`} htmlFor="compose-subject">
        موضوع
      </label>
      <input
        id="compose-subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="موضوع پیام…"
        className={fieldClass}
      />

      <label className={`${labelClass} mt-3`} htmlFor="compose-body">
        متن پیام
      </label>
      <textarea
        id="compose-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="متن پیام را بنویسید…"
        rows={4}
        className={fieldClass}
      />

      {error && (
        <p role="alert" className={`mt-2 text-xs ${dark ? 'text-[#f87171]' : 'text-danger'}`}>
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className={
            dark
              ? 'rounded-lg border border-[#28344c] px-4 py-2 text-xs font-bold text-[#9fb0c7]'
              : 'rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2'
          }
        >
          انصراف
        </button>
        <button
          onClick={() => void onSubmit()}
          className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2563eb]"
        >
          ارسال پیام
        </button>
      </div>
    </PanelModal>
  );
}
