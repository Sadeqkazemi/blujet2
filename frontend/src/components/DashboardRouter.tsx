import { useOutletContext } from 'react-router-dom';
import DashboardPage from '../features/dashboard/DashboardPage';
import ItDashboardPage from '../features/it-manager/ItDashboardPage';
import ComingSoonPage from './ComingSoonPage';
import { useAuth } from '../hooks/useAuth';
import type { PanelNavItem } from '../types/panels';

interface PanelShellContext {
  nav: PanelNavItem[] | null;
}

/**
 * The shared sales/KPI dashboard only backs the roles reporting.controller
 * actually allows (CEO/Board Chair/Senior/Finance/Commercial). IT Manager's
 * "dashboard" nav entry points at a different real page (service-health/
 * os-metrics, Phase 8) instead of the shared one. Any role whose entry
 * isn't `implemented` gets the coming-soon placeholder instead of a broken
 * fetch-and-error dashboard.
 */
export default function DashboardRouter() {
  const { nav } = useOutletContext<PanelShellContext>();
  const { user } = useAuth();
  const dashboardEntry = nav?.find((item) => item.key === 'dashboard');

  if (nav !== null && dashboardEntry && !dashboardEntry.implemented) {
    return <ComingSoonPage />;
  }

  if (user?.role === 'IT_MANAGER') return <ItDashboardPage />;
  return <DashboardPage />;
}
