export interface ManageBookingNotFoundProps {
  title: string;
  subtitle: string;
  btnLabel: string;
  onReset: () => void;
}

export default function ManageBookingNotFound({ title, subtitle, btnLabel, onReset }: ManageBookingNotFoundProps) {
  return (
    <div
      data-testid="mb-not-found"
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 16,
        padding: '44px 24px',
        textAlign: 'center',
        boxShadow: '0 18px 50px -28px rgba(13,38,102,.5)',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#f6f8fb',
          color: '#8a96a6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          margin: '0 auto 16px',
        }}
      >
        🔍
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#16202e', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#8a96a6', marginBottom: 20, lineHeight: 1.9 }}>{subtitle}</div>
      <button
        type="button"
        data-testid="mb-search-again"
        onClick={onReset}
        style={{
          display: 'inline-flex',
          height: 46,
          padding: '0 22px',
          borderRadius: 12,
          background: '#1668c4',
          color: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12.5,
          fontWeight: 800,
          cursor: 'pointer',
          border: 'none',
          fontFamily: 'inherit',
        }}
      >
        {btnLabel}
      </button>
    </div>
  );
}
