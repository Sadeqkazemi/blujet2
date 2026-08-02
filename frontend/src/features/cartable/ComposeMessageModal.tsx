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
}

export default function ComposeMessageModal({ onClose, onSent }: Props) {
  const [toDept, setToDept] = useState<ManagerMessageDept | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    <PanelModal
      title="ایجاد پیام جدید"
      onClose={onClose}
      wide
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onSubmit()}
            className={`flex h-[42px] flex-1 items-center justify-center gap-1.5 text-[12.5px] font-bold ${panelBtnPrimary}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            ارسال پیام
          </button>
          <button type="button" onClick={onClose} className={`h-[42px] px-4 ${panelBtnGhost}`}>
            انصراف
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-[13px]">
        <div>
          <label className={`mb-2 block text-[11.5px] font-bold ${panelText}`} htmlFor="compose-dept">
            گیرنده سازمانی
          </label>
          <select
            id="compose-dept"
            value={toDept}
            onChange={(e) => setToDept(e.target.value as ManagerMessageDept | '')}
            className={`h-[46px] w-full cursor-pointer px-[11px] ${panelInput}`}
          >
            <option value="">انتخاب گیرنده…</option>
            {DEPT_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`mb-2 block text-[11.5px] font-bold ${panelText}`} htmlFor="compose-subject">
            موضوع
          </label>
          <input
            id="compose-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="موضوع پیام…"
            className={`h-[46px] w-full px-[11px] ${panelInput}`}
          />
        </div>

        <div>
          <label className={`mb-2 block text-[11.5px] font-bold ${panelText}`} htmlFor="compose-body">
            متن پیام
          </label>
          <textarea
            id="compose-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="متن پیام را بنویسید…"
            rows={4}
            className={`min-h-[110px] w-full resize-y px-[11px] py-2.5 leading-relaxed ${panelInput}`}
          />
        </div>

        <div>
          <label className={`mb-2 block text-[11.5px] font-bold ${panelText}`}>پیوست سند (PDF یا تصویر)</label>
          <div className="flex h-12 items-center justify-center gap-1.5 rounded-[11px] border-[1.5px] border-dashed border-[#3a4a66] bg-[#0f1623] text-[11.5px] font-semibold text-panel-muted-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 9l5-5 5 5M12 4v12" />
            </svg>
            افزودن فایل
          </div>
          <p className={`mt-1.5 text-[10.5px] ${panelMuted}`}>پیوست اختیاری است و در فاز بعدی به API وصل می‌شود.</p>
        </div>

        {error && (
          <p role="alert" className="text-[11.5px] font-semibold text-[#f87171]">
            {error}
          </p>
        )}
      </div>
    </PanelModal>
  );
}
