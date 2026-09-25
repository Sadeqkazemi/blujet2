import { Link, Outlet, useLocation } from 'react-router-dom';
import './mobile-customer.css';

const nav = [
  { to: '/app', icon: '⌂', label: 'Home' },
  { to: '/app/book', icon: '✈', label: 'Book' },
  { to: '/app/trips', icon: '▣', label: 'My Trips' },
  { to: '/app/rewards', icon: '♢', label: 'SkyRewards' },
  { to: '/app/more', icon: '☰', label: 'More' },
];

export default function MobileCustomerShell() {
  const { pathname } = useLocation();
  return (
    <div className="bj-app-shell">
      <header className="bj-app-header">
        <Link to="/app" className="bj-back" aria-label="Back">‹ <span>Back</span></Link>
        <Link to="/app" className="bj-wordmark">BlueJet<span>FLY BEYOND</span></Link>
        <div className="bj-header-actions">
          <button aria-label="Search">⌕</button>
          <button aria-label="Notifications">♢</button>
          <button className="bj-lang">◎ EN⌄</button>
          <button className="bj-avatar" aria-label="Profile">SK</button>
        </div>
      </header>
      <main className="bj-app-main"><Outlet /></main>
      <nav className="bj-bottom-nav" aria-label="Customer app">
        {nav.map((item) => {
          const active = item.to === '/app' ? pathname === '/app' : pathname.startsWith(item.to);
          return <Link key={item.to} to={item.to} className={active ? 'active' : ''}>
            <span className="bj-nav-icon">{item.icon}</span><span>{item.label}</span>
          </Link>;
        })}
      </nav>
    </div>
  );
}
