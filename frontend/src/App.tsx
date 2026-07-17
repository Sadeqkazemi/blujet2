import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AgencyProtectedRoute from './components/AgencyProtectedRoute';
import PanelShell from './components/PanelShell';
import ComingSoonPage from './components/ComingSoonPage';
import DashboardRouter from './components/DashboardRouter';
import TabGate from './components/TabGate';
import LoginPage from './features/auth/LoginPage';
import TwoFactorPage from './features/auth/TwoFactorPage';
import AgencyLoginPage from './features/agency-portal/AgencyLoginPage';
import AgencyPortalShell from './features/agency-portal/AgencyPortalShell';
import AgencyDashboardPage from './features/agency-portal/AgencyDashboardPage';
import AgencyCreditPage from './features/agency-portal/AgencyCreditPage';
import AgencySalesPage from './features/agency-portal/AgencySalesPage';
import AgencyInboxPage from './features/agency-portal/AgencyInboxPage';
import AgencyProfilePage from './features/agency-portal/AgencyProfilePage';
import AgenciesListPage from './features/agencies/AgenciesListPage';
import AgencyDetailPage from './features/agencies/AgencyDetailPage';
import RequestDetailPage from './features/agencies/RequestDetailPage';
import CartablePage from './features/cartable/CartablePage';
import ReferralsPage from './features/referrals/ReferralsPage';
import ClubPage from './features/club/ClubPage';
import EmployeesPage from './features/it-manager/EmployeesPage';
import SecurityPage from './features/it-manager/SecurityPage';
import ServicesPage from './features/it-manager/ServicesPage';
import LogsPage from './features/it-manager/LogsPage';
import BackupsPage from './features/it-manager/BackupsPage';
import PricingPage from './features/pricing/PricingPage';
import ReservationPage from './features/reservation/ReservationPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/two-factor" element={<TwoFactorPage />} />
          <Route path="/agency/login" element={<AgencyLoginPage />} />

          <Route element={<AgencyProtectedRoute />}>
            <Route path="/agency" element={<AgencyPortalShell />}>
              <Route index element={<AgencyDashboardPage />} />
              <Route path="credit" element={<AgencyCreditPage />} />
              <Route path="sales" element={<AgencySalesPage />} />
              <Route path="inbox" element={<AgencyInboxPage />} />
              <Route path="profile" element={<AgencyProfilePage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/panel" element={<PanelShell />}>
              <Route index element={<DashboardRouter />} />
              <Route path="agencies" element={<TabGate tabKey="agencies" />}>
                <Route index element={<AgenciesListPage />} />
                <Route path="requests/:requestId" element={<RequestDetailPage />} />
                <Route path=":agencyId" element={<AgencyDetailPage />} />
              </Route>
              <Route path="cartable" element={<TabGate tabKey="cartable" />}>
                <Route index element={<CartablePage />} />
              </Route>
              <Route path="referrals" element={<TabGate tabKey="referrals" />}>
                <Route index element={<ReferralsPage />} />
              </Route>
              <Route path="club" element={<TabGate tabKey="club" />}>
                <Route index element={<ClubPage />} />
              </Route>
              <Route path="vip" element={<TabGate tabKey="vip" />}>
                <Route index element={<ClubPage />} />
              </Route>
              <Route path="users" element={<TabGate tabKey="users" />}>
                <Route index element={<EmployeesPage />} />
              </Route>
              <Route path="security" element={<TabGate tabKey="security" />}>
                <Route index element={<SecurityPage />} />
              </Route>
              <Route path="services" element={<TabGate tabKey="services" />}>
                <Route index element={<ServicesPage />} />
              </Route>
              <Route path="logs" element={<TabGate tabKey="logs" />}>
                <Route index element={<LogsPage />} />
              </Route>
              <Route path="backup" element={<TabGate tabKey="backup" />}>
                <Route index element={<BackupsPage />} />
              </Route>
              <Route path="pricing" element={<TabGate tabKey="pricing" />}>
                <Route index element={<PricingPage />} />
              </Route>
              <Route path="flights" element={<TabGate tabKey="flights" />}>
                <Route index element={<PricingPage />} />
              </Route>
              <Route path="reservation" element={<TabGate tabKey="reservation" />}>
                <Route index element={<ReservationPage />} />
              </Route>
              <Route path=":tabKey" element={<ComingSoonPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/panel" replace />} />
          <Route path="*" element={<Navigate to="/panel" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
