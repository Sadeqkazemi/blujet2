export interface ManageBookingLookupFormProps {
  pnr: string;
  lastName: string;
  loading: boolean;
  error: string | null;
  labels: {
    pnrLabel: string;
    pnrPlaceholder: string;
    lastNameLabel: string;
    lastNamePlaceholder: string;
    lookupBtn: string;
    lookingUpBtn: string;
    emailSmsNote: string;
  };
  onPnrChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ManageBookingLookupForm({
  pnr,
  lastName,
  loading,
  error,
  labels,
  onPnrChange,
  onLastNameChange,
  onSubmit,
}: ManageBookingLookupFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 16,
        padding: 21,
        boxShadow: '0 18px 50px -28px rgba(13,38,102,.5)',
      }}
    >
      <div style={{ display: 'flex', gap: 13, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11.5, color: '#8a96a6', marginBottom: 8, fontWeight: 600 }}>{labels.pnrLabel}</div>
          <input
            id="mb-pnr"
            data-testid="mb-pnr"
            dir="ltr"
            value={pnr}
            onChange={(e) => onPnrChange(e.target.value)}
            placeholder={labels.pnrPlaceholder}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: 52,
              border: '1.5px solid #e2e7ee',
              borderRadius: 12,
              background: '#fafbfd',
              padding: '0 12px',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              color: '#16202e',
              outline: 'none',
              textTransform: 'uppercase',
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11.5, color: '#8a96a6', marginBottom: 8, fontWeight: 600 }}>{labels.lastNameLabel}</div>
          <input
            id="mb-lastname"
            data-testid="mb-lastname"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
            placeholder={labels.lastNamePlaceholder}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: 52,
              border: '1.5px solid #e2e7ee',
              borderRadius: 12,
              background: '#fafbfd',
              padding: '0 12px',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              color: '#16202e',
              outline: 'none',
            }}
          />
        </div>
      </div>
      <button
        type="submit"
        data-testid="mb-lookup"
        disabled={loading}
        style={{
          marginTop: 20,
          width: '100%',
          height: 54,
          border: 'none',
          borderRadius: 13,
          background: loading ? '#125aab' : '#1668c4',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          fontSize: 14,
          fontWeight: 800,
          cursor: loading ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 14px 30px -14px rgba(22,104,196,.6)',
          opacity: loading ? 0.85 : 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        {loading ? labels.lookingUpBtn : labels.lookupBtn}
      </button>
      <div style={{ marginTop: 16, fontSize: 11.5, color: '#9aa4b2', textAlign: 'center' }}>{labels.emailSmsNote}</div>
      {error && (
        <div
          data-testid="mb-lookup-error"
          style={{
            marginTop: 14,
            borderRadius: 10,
            background: '#fef2f2',
            padding: 10,
            fontSize: 12,
            color: '#e5484d',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
