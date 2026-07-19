import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AgencyProtectedRoute from './components/AgencyProtectedRoute';
import PanelShell from './components/PanelShell';
import ComingSoonPage from './components/ComingSoonPage';
import DashboardRouter from './components/DashboardRouter';
import TabGate from './components/TabGate';
import LoginPage from './features/auth/LoginPage';
import TwoFactorPage from './features/auth/TwoFactorPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import AgencyLoginPage from './features/agency-portal/AgencyLoginPage';
import AgencyPortalShell from './features/agency-portal/AgencyPortalShell';
import AgencyDashboardPage from './features/agency-portal/AgencyDashboardPage';
import AgencySeatsPage from './features/agency-portal/AgencySeatsPage';
import AgencyWebservicePage from './features/agency-portal/AgencyWebservicePage';
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
import ServicesPage from './features/it-manager/ServicesPage';
import BackupsPage from './features/it-manager/BackupsPage';
import PricingPage from './features/pricing/PricingPage';
import RefundsPage from './features/refunds/RefundsPage';
import FlightsPage from './features/flights/FlightsPage';
import ReservationPage from './features/reservation/ReservationPage';
import FinancePage from './features/finance/FinancePage';
import PassengerReportsPage from './features/passenger-reports/PassengerReportsPage';
import StaffReportsPage from './features/staff-reports/StaffReportsPage';
import ManagerReportsPage from './features/manager-reports/ManagerReportsPage';
import AdminsPage from './features/admins/AdminsPage';
import SettingsPage from './features/settings/SettingsPage';
import SecurityRouter from './components/SecurityRouter';
import LogsRouter from './components/LogsRouter';
import PanelsAccessPage from './features/panels-access/PanelsAccessPage';
import HomeSearchPage from './features/public-site/HomeSearchPage';
import ResultsPage from './features/public-site/ResultsPage';
import BookPage from './features/public-site/BookPage';
import CheckoutPage from './features/public-site/CheckoutPage';
import TicketPage from './features/public-site/TicketPage';
import DestinationsPage from './features/public-site/DestinationsPage';
import PublicClubPage from './features/public-site/PublicClubPage';
import SupportPage from './features/public-site/SupportPage';
import TravelInfoPage from './features/public-site/TravelInfoPage';
import CustomerLoginPage from './features/public-site/CustomerLoginPage';
import ManageBookingPage from './features/public-site/ManageBookingPage';
import AboutPage from './features/public-site/AboutPage';
import ContactPage from './features/public-site/ContactPage';
import NotFoundPage from './features/public-site/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeSearchPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/book/:flightInstanceId" element={<BookPage />} />
          <Route path="/checkout/:bookingId" element={<CheckoutPage />} />
          <Route path="/ticket/:pnr" element={<TicketPage />} />
          <Route path="/destinations" element={<DestinationsPage />} />
          <Route path="/club" element={<PublicClubPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/travel-info" element={<TravelInfoPage />} />
          <Route path="/signin" element={<CustomerLoginPage />} />
          <Route path="/manage-booking" element={<ManageBookingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/two-factor" element={<TwoFactorPage />} />
          <Route path="/agency/login" element={<AgencyLoginPage />} />

          <Route element={<AgencyProtectedRoute />}>
            <Route path="/agency" element={<AgencyPortalShell />}>
              <Route index element={<AgencyDashboardPage />} />
              <Route path="seats" element={<AgencySeatsPage />} />
              <Route path="credit" element={<AgencyCreditPage />} />
              <Route path="webservice" element={<AgencyWebservicePage />} />
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
                <Route index element={<SecurityRouter />} />
              </Route>
              <Route path="services" element={<TabGate tabKey="services" />}>
                <Route index element={<ServicesPage />} />
              </Route>
              <Route path="logs" element={<TabGate tabKey="logs" />}>
                <Route index element={<LogsRouter />} />
              </Route>
              <Route path="backup" element={<TabGate tabKey="backup" />}>
                <Route index element={<BackupsPage />} />
              </Route>
              <Route path="pricing" element={<TabGate tabKey="pricing" />}>
                <Route index element={<PricingPage />} />
              </Route>
              <Route path="flights" element={<TabGate tabKey="flights" />}>
                <Route index element={<FlightsPage />} />
              </Route>
              <Route path="refund" element={<TabGate tabKey="refund" />}>
                <Route index element={<RefundsPage />} />
              </Route>
              <Route path="reservation" element={<TabGate tabKey="reservation" />}>
                <Route index element={<ReservationPage />} />
              </Route>
              <Route path="finance" element={<TabGate tabKey="finance" />}>
                <Route index element={<FinancePage />} />
              </Route>
              <Route path="reports" element={<TabGate tabKey="reports" />}>
                <Route index element={<PassengerReportsPage />} />
              </Route>
              <Route path="staff" element={<TabGate tabKey="staff" />}>
                <Route index element={<StaffReportsPage />} />
              </Route>
              <Route path="mgrreports" element={<TabGate tabKey="mgrreports" />}>
                <Route index element={<ManagerReportsPage />} />
              </Route>
              <Route path="panels" element={<TabGate tabKey="panels" />}>
                <Route index element={<PanelsAccessPage />} />
              </Route>
              <Route path="admins" element={<TabGate tabKey="admins" />}>
                <Route index element={<AdminsPage />} />
              </Route>
              <Route path="settings" element={<TabGate tabKey="settings" />}>
                <Route index element={<SettingsPage />} />
              </Route>
              <Route path=":tabKey" element={<ComingSoonPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
