import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Claims837Page } from './pages/Claims837';
import { DashboardPage } from './pages/Dashboard';
import { DocumentationPage } from './pages/Documentation';
import { Enrollment834Page } from './pages/Enrollment834';
import { HelpCenterPage } from './pages/HelpCenter';
import { LoginPage } from './pages/Login';
import { MasterParserPage } from './pages/MasterParser';
import { NotificationsPage } from './pages/Notifications';
import { Remittance835Page } from './pages/Remittance835';
import { SettingsPage } from './pages/Settings';
import { UserProfilePage } from './pages/UserProfile';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login_sleek_redesign" element={<LoginPage />} />
        <Route path="/dashboard_sleek" element={<DashboardPage />} />
        <Route path="/master_parser_sleek" element={<MasterParserPage />} />
        <Route path="/835_remittance_sleek" element={<Remittance835Page />} />
        <Route path="/834_enrollment_sleek" element={<Enrollment834Page />} />
        <Route path="/837_claims_view" element={<Claims837Page />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/user_profile" element={<UserProfilePage />} />
        <Route path="/documentation" element={<DocumentationPage />} />
        <Route path="/help_center" element={<HelpCenterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
