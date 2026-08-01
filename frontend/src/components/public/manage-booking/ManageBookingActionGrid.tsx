export interface ManageBookingActionGridProps {
  isMobile: boolean;
  labels: {
    changeSeat: string;
    refund: string;
    download: string;
  };
  canChangeSeat: boolean;
  canRefund: boolean;
  canDownload: boolean;
  refundDone: boolean;
  onChangeSeat: () => void;
  onRefund: () => void;
  onDownload: () => void;
}

function ActionCard({
  icon,
  label,
  disabled,
  testId,
  hoverBorder,
  iconBg,
  iconColor,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  testId: string;
  hoverBorder: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 14,
        padding: '14px 12px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.55 : 1,
        width: '100%',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          margin: '0 auto 9px',
          borderRadius: 11,
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: disabled ? '#aab8c8' : '#16202e' }}>{label}</div>
    </button>
  );
}

export default function ManageBookingActionGrid({
  isMobile,
  labels,
  canChangeSeat,
  canRefund,
  canDownload,
  refundDone,
  onChangeSeat,
  onRefund,
  onDownload,
}: ManageBookingActionGridProps) {
  const cols = isMobile ? '1fr' : 'repeat(3, 1fr)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 11 }}>
      <ActionCard
        testId="mb-change-seat"
        label={labels.changeSeat}
        disabled={!canChangeSeat}
        iconBg="#eef4fb"
        iconColor="#1668c4"
        hoverBorder="#dbe7f6"
        onClick={onChangeSeat}
        icon={
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="8" width="10" height="12" rx="2" />
            <path d="M6 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            <path d="M6 12h4M6 16h4" />
            <path d="M17 8v8M17 8l-2 2M17 8l2 2" />
          </svg>
        }
      />
      <ActionCard
        testId="mb-open-refund"
        label={labels.refund}
        disabled={!canRefund || refundDone}
        iconBg="#fdeeee"
        iconColor="#d64545"
        hoverBorder="#f5c9c9"
        onClick={onRefund}
        icon={
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 5 5v1" />
          </svg>
        }
      />
      <ActionCard
        testId="mb-download-ticket"
        label={labels.download}
        disabled={!canDownload}
        iconBg="#eef4fb"
        iconColor="#1668c4"
        hoverBorder="#dbe7f6"
        onClick={onDownload}
        icon={
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v12" />
            <path d="M8 11l4 4 4-4" />
            <path d="M5 21h14" />
          </svg>
        }
      />
    </div>
  );
}
