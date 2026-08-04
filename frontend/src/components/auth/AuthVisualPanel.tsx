export default function AuthVisualPanel({
  title,
  subtitle,
  testId = 'auth-visual-panel',
}: {
  title: string;
  subtitle: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        background: 'linear-gradient(160deg,#0d2640,#1668c4)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '30px 28px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -80,
          left: -60,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: '#ffffff14',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 130,
          right: -50,
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: '#ffffff0d',
        }}
      />
      <svg
        viewBox="0 0 400 600"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
      >
        <path
          d="M 430 560 C 300 430, 210 320, 60 150"
          fill="none"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="2"
          strokeDasharray="2 12"
          strokeLinecap="round"
        />
      </svg>
      <svg
        viewBox="0 0 200 80"
        aria-hidden
        style={{
          position: 'absolute',
          top: '11%',
          left: '-10%',
          width: '120%',
          animation: 'authPlaneFloat 7s ease-in-out infinite',
          filter: 'drop-shadow(0 30px 40px rgba(5,18,36,.45))',
          pointerEvents: 'none',
        }}
      >
        <path
          d="M10 45 L190 35 L160 42 L175 55 L140 50 L120 65 L100 50 L65 55 L80 42 L50 35 Z"
          fill="rgba(255,255,255,0.92)"
        />
        <path d="M95 50 L105 50 L102 58 L98 58 Z" fill="#1668c4" />
      </svg>
      <div style={{ position: 'relative', color: '#fff' }}>
        <div
          style={{
            fontSize: 21,
            fontWeight: 900,
            lineHeight: 1.7,
            marginBottom: 10,
            whiteSpace: 'pre-line',
          }}
        >
          {title}
        </div>
        <p style={{ fontSize: 12, color: '#d6e4f7', lineHeight: 2.1, margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}
