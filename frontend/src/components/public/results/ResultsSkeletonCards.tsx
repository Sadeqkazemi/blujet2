export default function ResultsSkeletonCards({ count = 5 }: { count?: number }) {
  return (
    <div
      data-testid="results-skeleton"
      style={{ display: 'flex', flexDirection: 'column', gap: 11 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            background: '#fff',
            border: '1px solid #eef1f5',
            borderRadius: 14,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 25,
          }}
        >
          <div style={{ width: 96, height: 58, borderRadius: 14, background: '#eef1f5', flex: 'none' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ height: 14, width: '42%', background: '#eef1f5', borderRadius: 6 }} />
            <div style={{ height: 11, width: '62%', background: '#f0f2f5', borderRadius: 6 }} />
          </div>
          <div style={{ width: 120, height: 40, borderRadius: 10, background: '#eef1f5', flex: 'none' }} />
        </div>
      ))}
    </div>
  );
}
