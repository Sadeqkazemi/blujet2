import { useAuth } from '../../hooks/useAuth';
import PassengerReportsPage from '../passenger-reports/PassengerReportsPage';
import EmployeeReportsPage from '../staff-reports/EmployeeReportsPage';

/** EMPLOYEE → گزارش‌های من (activity feed); other roles keep passenger search. */
export default function ReportsRouter() {
  const { user } = useAuth();
  if (user?.role === 'EMPLOYEE') return <EmployeeReportsPage />;
  return <PassengerReportsPage />;
}
