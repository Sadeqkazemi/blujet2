import { useAuth } from '../hooks/useAuth';
import AdminsPage from '../features/admins/AdminsPage';
import BoardChairAdminsPage from '../features/admins/BoardChairAdminsPage';

/** BOARD_CHAIR uses the design shell with an empty managers list (no seed/mock rows). */
export default function AdminsRouter() {
  const { user } = useAuth();
  if (user?.role === 'BOARD_CHAIR') return <BoardChairAdminsPage />;
  return <AdminsPage />;
}
