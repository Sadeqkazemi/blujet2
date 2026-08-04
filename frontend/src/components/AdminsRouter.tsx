import { useAuth } from '../hooks/useAuth';
import AdminsPage from '../features/admins/AdminsPage';
import PanelAdminsPage from '../features/admins/PanelAdminsPage';

const PANEL_ADMIN_ROLES = new Set(['BOARD_CHAIR', 'CEO', 'SENIOR_MANAGER']);

/** Executive panels use the dark design shell; others keep the legacy light page. */
export default function AdminsRouter() {
  const { user } = useAuth();
  if (user?.role && PANEL_ADMIN_ROLES.has(user.role)) return <PanelAdminsPage />;
  return <AdminsPage />;
}
