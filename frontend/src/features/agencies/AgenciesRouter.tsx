import { useAuth } from '../../hooks/useAuth';
import AgenciesListPage from './AgenciesListPage';
import EmployeeAgenciesPage from './EmployeeAgenciesPage';

/** EMPLOYEE gets the design screenshot table; managers keep the full list UI. */
export default function AgenciesRouter() {
  const { user } = useAuth();
  if (user?.role === 'EMPLOYEE') return <EmployeeAgenciesPage />;
  return <AgenciesListPage />;
}
