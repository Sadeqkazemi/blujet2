import { Link } from 'react-router-dom';

export default function MobileHomePage() {
  return <div className="bj-page">
    <section className="bj-hero">
      <p className="bj-eyebrow">TRAVEL SMARTER TOGETHER</p>
      <h1>Where do you want to fly?</h1>
      <p>Search, book and manage your BlueJet journey in one place.</p>
    </section>
    <section className="bj-search-card">
      <div className="bj-segment"><button className="active">Round Trip</button><button>One Way</button><button>Multi-City</button></div>
      <div className="bj-route">
        <Link to="/app/book"><small>From</small><strong>THR</strong><span>Tehran</span></Link>
        <button className="bj-swap">⇄</button>
        <Link to="/app/book"><small>To</small><strong>DXB</strong><span>Dubai</span></Link>
      </div>
      <div className="bj-home-grid">
        <Link to="/app/book"><small>Departure</small><strong>Select date</strong></Link>
        <Link to="/app/book"><small>Passengers</small><strong>1 Adult</strong></Link>
      </div>
      <Link className="bj-primary" to="/app/book">Search Flights →</Link>
    </section>
    <section className="bj-section">
      <h2>Quick actions</h2>
      <div className="bj-action-grid">
        <Link to="/app/trips">▣<span>My Trips</span></Link>
        <Link to="/app/check-in">✓<span>Check-in</span></Link>
        <Link to="/app/flight-status">✈<span>Flight Status</span></Link>
        <Link to="/app/support">?<span>Support</span></Link>
      </div>
    </section>
  </div>;
}
