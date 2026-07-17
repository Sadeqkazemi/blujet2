import { Outlet, useOutletContext } from 'react-router-dom';
import ComingSoonPage from './ComingSoonPage';
import type { PanelNavItem } from '../types/panels';

interface PanelShellContext {
  nav: PanelNavItem[] | null;
}

/** Renders the tab's real pages only when this role's nav entry is
 * implemented — otherwise the shared coming-soon placeholder, never a
 * broken fetch-and-error page (same pattern as DashboardRouter). */
export default function TabGate({ tabKey }: { tabKey: string }) {
  const { nav } = useOutletContext<PanelShellContext>();
  const entry = nav?.find((item) => item.key === tabKey);

  if (nav !== null && (!entry || !entry.implemented)) {
    return <ComingSoonPage />;
  }

  return <Outlet />;
}
