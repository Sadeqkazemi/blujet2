interface StatTileProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'accent' | 'good' | 'warning' | 'critical';
}

const TONE_CLASSES: Record<NonNullable<StatTileProps['tone']>, string> = {
  accent: 'bg-accent/10 text-accent',
  good: 'bg-[#05966915] text-[#059669]',
  warning: 'bg-[#f59e0b15] text-[#b45309]',
  critical: 'bg-danger/10 text-danger',
};

export default function StatTile({ label, value, sublabel, tone = 'accent' }: StatTileProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${TONE_CLASSES[tone]}`}>
        ٪
      </div>
      <div className="font-num text-xl font-black text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
      {sublabel && <div className="mt-1 text-[11px] text-muted-2">{sublabel}</div>}
    </div>
  );
}
