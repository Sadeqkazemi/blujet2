export interface FlightStatusNotFoundProps {
  title: string;
  message: string;
}

export default function FlightStatusNotFound({ title, message }: FlightStatusNotFoundProps) {
  return (
    <div
      data-testid="fs-not-found"
      style={{
        marginTop: 18,
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
      <div style={{ fontSize: 12, color: '#8a96a6', lineHeight: 1.9 }}>{message}</div>
    </div>
  );
}
