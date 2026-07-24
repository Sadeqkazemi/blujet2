import { downloadFile } from '../api/files';
import type { ReferralAttachment } from '../types/cartable';

interface AttachmentListProps {
  attachments: ReferralAttachment[];
  /** Matches the design's two read-only chip stylings: neutral for a
   * referral's own attachments, success (green) for a report's. */
  variant?: 'neutral' | 'success';
}

export default function AttachmentList({ attachments, variant = 'neutral' }: AttachmentListProps) {
  if (attachments.length === 0) return null;
  const chipClass =
    variant === 'success'
      ? 'bg-[#10b98115] text-[#059669]'
      : 'border border-border bg-surface text-text-2';

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {attachments.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => void downloadFile(f.id, f.fileName)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition hover:opacity-80 ${chipClass}`}
        >
          {f.fileName}
        </button>
      ))}
    </div>
  );
}
