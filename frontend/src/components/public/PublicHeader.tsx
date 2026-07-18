import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchClubPoints } from '../../api/publicSite';
import { faDigits } from '../../lib/fa-format';

const TIER_LABEL: Record<string, string> = {
  SILVER: 'نقره‌ای',
  GOLD: 'طلایی',
  PLATINUM: 'پلاتین',
};

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0] ?? '').join('') || 'کا';
}

/** Sticky public-site header — matches design-reference/صفحه اصلی.dc.html exactly. */
export default function PublicHeader() {
  const { status, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [club, setClub] = useState<{ isMember: boolean; level: string | null; balance: number } | null>(null);

  const loggedIn = status === 'authenticated' && user?.role === 'USER';

  useEffect(() => {
    if (!loggedIn) return;
    fetchClubPoints()
      .then(setClub)
      .catch(() => setClub(null));
  }, [loggedIn]);

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e6eaf0', boxShadow: '0 2px 12px -8px rgba(13,38,102,.25)' }}>
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '0 26px',
            height: 86,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#1668c4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 18,
              }}
            >
              ✈
            </div>
            <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-.5px' }}>blujet</span>
          </Link>

          <nav style={{ display: 'flex', gap: 30, fontSize: '14.5px', color: '#3b4554', fontWeight: 600, height: '100%', alignItems: 'center' }}>
            <Link
              to="/"
              style={{
                color: '#1668c4',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '3px solid #1668c4',
                textDecoration: 'none',
              }}
            >
              پرواز
            </Link>
            <Link to="/destinations" style={{ textDecoration: 'none', color: '#3b4554' }}>
              مقاصد پروازی
            </Link>
            <Link to="/club" style={{ textDecoration: 'none', color: '#3b4554' }}>
              باشگاه مشتریان
            </Link>
            <Link to="/travel-info" style={{ textDecoration: 'none', color: '#3b4554' }}>
              اطلاعات سفر
            </Link>
            <Link to="/support" style={{ textDecoration: 'none', color: '#3b4554' }}>
              پشتیبانی
            </Link>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!loggedIn && (
              <>
                <Link
                  to="/login"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '7px 15px',
                    border: '1.5px solid #d5e1f0',
                    color: '#0d2640',
                    borderRadius: 10,
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                  ورود / ثبت‌نام
                </Link>
                <Link
                  to="/club"
                  style={{
                    padding: '8px 18px',
                    background: '#1668c4',
                    color: '#fff',
                    borderRadius: 10,
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  عضویت باشگاه
                </Link>
              </>
            )}

            {loggedIn && user && (
              <>
                {club?.isMember && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#eef4fb',
                      border: '1px solid #dce8f7',
                      padding: '7px 11px',
                      borderRadius: 24,
                    }}
                  >
                    <span style={{ color: '#caa53a', fontSize: '12.5px' }}>★</span>
                    <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1668c4' }}>{faDigits(club.balance)}</span>
                    <span style={{ fontSize: 11, color: '#7a8696' }}>امتیاز</span>
                  </div>
                )}
                <div style={{ position: 'relative' }}>
                  <div
                    data-testid="public-user-menu-toggle"
                    onClick={() => setMenuOpen((v) => !v)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#fff',
                      border: '1px solid #e6eaf0',
                      padding: '4px 10px 4px 7px',
                      borderRadius: 30,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg,#1668c4,#0d3b66)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '11.5px',
                      }}
                    >
                      {initials(user.fullName)}
                    </div>
                    <div style={{ lineHeight: 1.35, textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#16202e' }}>{user.fullName}</div>
                      {club?.isMember && club.level && (
                        <div style={{ fontSize: 10, color: '#caa53a', fontWeight: 700 }}>★ عضو {TIER_LABEL[club.level] ?? club.level}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 8, color: '#9aa4b2', marginRight: 2 }}>▼</span>
                  </div>

                  {menuOpen && (
                    <>
                      <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120 }} />
                      <div
                        style={{
                          position: 'absolute',
                          top: 54,
                          left: 0,
                          width: 260,
                          background: '#fff',
                          border: '1px solid #e6eaf0',
                          borderRadius: 16,
                          boxShadow: '0 20px 50px -16px rgba(13,38,64,.35)',
                          zIndex: 130,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ padding: 5 }}>
                          <Link
                            to="/manage-booking"
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, fontSize: '11.5px', color: '#16202e', textDecoration: 'none', fontWeight: 600 }}
                          >
                            <span style={{ color: '#1668c4' }}>🧳</span>
                            سفرها و مدیریت رزرو
                          </Link>
                          <Link
                            to="/club"
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, fontSize: '11.5px', color: '#16202e', textDecoration: 'none', fontWeight: 600 }}
                          >
                            <span style={{ color: '#1668c4' }}>★</span>
                            باشگاه مشتریان
                          </Link>
                          <span
                            data-testid="public-logout"
                            onClick={() => void signOut()}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, fontSize: '11.5px', color: '#e5484d', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <span>↩</span>
                            خروج از حساب
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
