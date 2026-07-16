import { Outlet, useOutletContext } from 'react-router-dom';
import ComingSoonPage from './ComingSoonPage';
import type { PanelNavItem } from '../types/panels';

interface PanelShellContext {
  nav: PanelNavItem[] | null;
}

/** Mirrors DashboardRouter's pattern: only render the real Agencies pages
 * when this role's nav entry is implemented — otherwise the shared
 * coming-soon placeholder, never a broken fetch-and-error page. */
export default function AgenciesTabGate() {
  const { nav } = useOutletContext<PanelShellContext>();
  const entry = nav?.find((item) => item.key === 'agencies');

  if (nav !== null && (!entry || !entry.implemented)) {
    return <ComingSoonPage />;
  }

  return <Outlet />;
}
