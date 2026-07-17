import { useOutletContext } from 'react-router-dom';
import DashboardPage from '../features/dashboard/DashboardPage';
import ComingSoonPage from './ComingSoonPage';
import type { PanelNavItem } from '../types/panels';

interface PanelShellContext {
  nav: PanelNavItem[] | null;
}

/**
 * The shared sales/KPI dashboard only backs the roles reporting.controller
 * actually allows (CEO/Board Chair/Senior/Finance/Commercial). A role whose
 * "dashboard" nav entry isn't `implemented` (e.g. IT Manager's real
 * dashboard is service-health widgets, out of Phase 1 scope) gets the
 * coming-soon placeholder instead of a broken fetch-and-error dashboard.
 */
export default function DashboardRouter() {
  const { nav } = useOutletContext<PanelShellContext>();
  const dashboardEntry = nav?.find((item) => item.key === 'dashboard');

  if (nav !== null && dashboardEntry && !dashboardEntry.implemented) {
    return <ComingSoonPage />;
  }

  return <DashboardPage />;
}
