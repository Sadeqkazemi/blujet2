import { useState } from 'react';
import Modal from '../../components/Modal';
import { sendManagerMessage } from '../../api/cartable';
import type { ManagerMessageDept } from '../../types/cartable';

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
    <Modal title="ایجاد پیام جدید" onClose={onClose}>
      <label className="mb-1 block text-xs font-bold text-ink" htmlFor="compose-dept">
        گیرنده سازمانی
      </label>
      <select
        id="compose-dept"
        value={toDept}
        onChange={(e) => setToDept(e.target.value as ManagerMessageDept | '')}
        className="w-full rounded-lg border border-border bg-white p-3 text-xs outline-none transition focus:border-accent"
      >
        <option value="">انتخاب گیرنده…</option>
        {DEPT_OPTIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="compose-subject">
        موضوع
      </label>
      <input
        id="compose-subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="موضوع پیام…"
        className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
      />

      <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="compose-body">
        متن پیام
      </label>
      <textarea
        id="compose-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="متن پیام را بنویسید…"
        rows={4}
        className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
      />

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
          انصراف
        </button>
        <button
          onClick={() => void onSubmit()}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
        >
          ارسال پیام
        </button>
      </div>
    </Modal>
  );
}
