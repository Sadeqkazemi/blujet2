import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import PanelShell from './components/PanelShell';
import ComingSoonPage from './components/ComingSoonPage';
import DashboardRouter from './components/DashboardRouter';
import AgenciesTabGate from './components/AgenciesTabGate';
import LoginPage from './features/auth/LoginPage';
import TwoFactorPage from './features/auth/TwoFactorPage';
import AgenciesListPage from './features/agencies/AgenciesListPage';
import AgencyDetailPage from './features/agencies/AgencyDetailPage';
import RequestDetailPage from './features/agencies/RequestDetailPage';

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
              <Route path="agencies" element={<AgenciesTabGate />}>
                <Route index element={<AgenciesListPage />} />
                <Route path="requests/:requestId" element={<RequestDetailPage />} />
                <Route path=":agencyId" element={<AgencyDetailPage />} />
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
