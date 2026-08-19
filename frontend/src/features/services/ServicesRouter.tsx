import { useAuth } from '../../hooks/useAuth';
import ItServicesPage from '../it-manager/ServicesPage';
import CommercialServicesPage from './CommercialServicesPage';

export default function ServicesRouter() {
  const { user } = useAuth();

  if (user?.role === 'COMMERCIAL_MANAGER') {
    return <CommercialServicesPage />;
  }

  return <ItServicesPage />;
}
