interface StatTileProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'accent' | 'good' | 'warning' | 'critical';
  variant?: 'light' | 'panel';
}

const TONE_CLASSES: Record<NonNullable<StatTileProps['tone']>, string> = {
  accent: 'bg-accent/10 text-accent',
  good: 'bg-[#05966915] text-[#059669]',
  warning: 'bg-[#f59e0b15] text-[#b45309]',
  critical: 'bg-danger/10 text-danger',
};

const PANEL_TONE_CLASSES: Record<NonNullable<StatTileProps['tone']>, string> = {
  accent: 'bg-[rgba(59,130,246,.16)] text-[#3b82f6]',
  good: 'bg-[rgba(16,185,129,.16)] text-[#34d399]',
  warning: 'bg-[rgba(245,158,11,.16)] text-[#f59e0b]',
  critical: 'bg-[rgba(248,113,113,.16)] text-[#f87171]',
};

export default function StatTile({
  label,
  value,
  sublabel,
  tone = 'accent',
  variant = 'light',
}: StatTileProps) {
  const isPanel = variant === 'panel';
  const toneClass = isPanel ? PANEL_TONE_CLASSES[tone] : TONE_CLASSES[tone];

  return (
    <div
      className={
        isPanel
          ? 'rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-3.5'
          : 'rounded-xl border border-border bg-white p-4'
      }
    >
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-[11px] text-sm font-bold ${toneClass}`}
      >
        ٪
      </div>
      <div className={isPanel ? 'text-[22.5px] font-black text-white' : 'font-num text-xl font-black text-ink'}>
        {value}
      </div>
      <div className={isPanel ? 'mt-0.5 text-[11.5px] text-[#6b7b94]' : 'mt-1 text-xs text-muted'}>{label}</div>
      {sublabel && (
        <div className={isPanel ? 'mt-1 text-[11px] text-[#6b7b94]' : 'mt-1 text-[11px] text-muted-2'}>{sublabel}</div>
      )}
    </div>
  );
}
