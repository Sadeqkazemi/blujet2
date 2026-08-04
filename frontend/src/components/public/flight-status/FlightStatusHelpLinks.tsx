import { Link } from 'react-router-dom';

export interface FlightStatusHelpLinksProps {
  isMobile: boolean;
  labels: {
    delayAlertTitle: string;
    delayAlertSub: string;
    manageBookingTitle: string;
    manageBookingSub: string;
    support24Title: string;
    support24Sub: string;
  };
}

function HelpLink({
  to,
  icon,
  title,
  sub,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: 'none',
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          flex: 'none',
          borderRadius: 11,
          background: '#eef4fb',
          color: '#1668c4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16202e' }}>{title}</div>
        <div style={{ fontSize: 10.5, color: '#8a96a6', marginTop: 2 }}>{sub}</div>
      </div>
    </Link>
  );
}

export default function FlightStatusHelpLinks({ isMobile, labels }: FlightStatusHelpLinksProps) {
  const cols = isMobile ? '1fr' : 'repeat(3, 1fr)';

  return (
    <div
      data-testid="fs-help-links"
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap: 13,
        marginTop: 22,
      }}
    >
      <HelpLink
        to="/support"
        title={labels.delayAlertTitle}
        sub={labels.delayAlertSub}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-3.3A8.4 8.4 0 1 1 21 11.5z" />
          </svg>
        }
      />
      <HelpLink
        to="/manage-booking"
        title={labels.manageBookingTitle}
        sub={labels.manageBookingSub}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 4v16" />
          </svg>
        }
      />
      <HelpLink
        to="/support"
        title={labels.support24Title}
        sub={labels.support24Sub}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4l3 2" />
          </svg>
        }
      />
    </div>
  );
}
