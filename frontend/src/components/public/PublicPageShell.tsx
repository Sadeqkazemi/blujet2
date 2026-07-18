import type { ReactNode } from 'react';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';

/** Shared sticky header + footer shell for every public-site page. */
export default function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" style={{ fontFamily: "'Vazirmatn Variable', Vazirmatn, sans-serif", background: '#f6f8fb', minHeight: '100vh' }}>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
