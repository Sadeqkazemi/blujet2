import { useAuth } from '../../hooks/useAuth';
import CartablePage from './CartablePage';
import EmployeeCartablePage from './EmployeeCartablePage';

/** The `cartable` tab key backs two views: exec panels get the full
 * review/transfer/compose UI (CartablePage); EMPLOYEE gets the simpler
 * design-v2 cartable with «انجام شد» + message-to-manager form. */
export default function CartableRouter() {
  const { user } = useAuth();
  if (user?.role === 'EMPLOYEE') return <EmployeeCartablePage />;
  return <CartablePage />;
}
