import { Link, useLocation } from 'react-router-dom';

const titles: Record<string, [string,string]> = {
  '/app/book':['Book','Search and book your next BlueJet flight.'],
  '/app/trips':['My Trips','Manage upcoming, past and cancelled trips.'],
  '/app/rewards':['SkyRewards','More flights. Greater rewards.'],
  '/app/more':['More','Profile, settings, support and travel tools.'],
  '/app/check-in':['Check-in','Review your flight and complete check-in.'],
  '/app/flight-status':['Flight Status','Track your flight in real time.'],
  '/app/support':['Support Center',"We're here to help you travel with confidence."],
};
export default function MobilePlaceholderPage() {
  const { pathname } = useLocation();
  const [title,subtitle]=titles[pathname] ?? ['BlueJet','Your journey, in one place.'];
  return <div className="bj-page"><section className="bj-hero compact"><p className="bj-eyebrow">BLUEJET</p><h1>{title}</h1><p>{subtitle}</p></section>
    <section className="bj-card"><h2>{title}</h2><p>This mobile flow is ready for the next customer-app screen implementation.</p><Link className="bj-primary" to="/app">Back to Home</Link></section>
  </div>;
}
