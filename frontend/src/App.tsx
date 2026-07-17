import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import PanelShell from './components/PanelShell';
import ComingSoonPage from './components/ComingSoonPage';
import DashboardRouter from './components/DashboardRouter';
import TabGate from './components/TabGate';
import LoginPage from './features/auth/LoginPage';
import TwoFactorPage from './features/auth/TwoFactorPage';
import AgenciesListPage from './features/agencies/AgenciesListPage';
import AgencyDetailPage from './features/agencies/AgencyDetailPage';
import RequestDetailPage from './features/agencies/RequestDetailPage';
import CartablePage from './features/cartable/CartablePage';
import ReferralsPage from './features/referrals/ReferralsPage';
import ClubPage from './features/club/ClubPage';
import PricingPage from './features/pricing/PricingPage';
import RefundsPage from './features/refunds/RefundsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/two-factor" element={<TwoFactorPage />} />

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
              <Route path="pricing" element={<TabGate tabKey="pricing" />}>
                <Route index element={<PricingPage />} />
              </Route>
              <Route path="flights" element={<TabGate tabKey="flights" />}>
                <Route index element={<PricingPage />} />
              </Route>
              <Route path="refund" element={<TabGate tabKey="refund" />}>
                <Route index element={<RefundsPage />} />
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
