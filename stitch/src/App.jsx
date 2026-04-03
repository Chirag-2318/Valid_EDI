import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequirePermission } from './auth/RouteGuards';
import {
  ADMIN_PERMISSIONS,
  ANY_EDI_VIEW_PERMISSIONS,
  CLAIMS_ACCESS_PERMISSIONS,
  ENROLLMENT_ACCESS_PERMISSIONS,
  REMITTANCE_ACCESS_PERMISSIONS
} from './auth/permissions';
import { AdminUsersPage } from './pages/AdminUsers';
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
        <Route
          path="/dashboard_sleek"
          element={(
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/master_parser_sleek"
          element={(
            <RequirePermission required={ANY_EDI_VIEW_PERMISSIONS}>
              <MasterParserPage />
            </RequirePermission>
          )}
        />
        <Route
          path="/835_remittance_sleek"
          element={(
            <RequirePermission required={REMITTANCE_ACCESS_PERMISSIONS}>
              <Remittance835Page />
            </RequirePermission>
          )}
        />
        <Route
          path="/834_enrollment_sleek"
          element={(
            <RequirePermission required={ENROLLMENT_ACCESS_PERMISSIONS}>
              <Enrollment834Page />
            </RequirePermission>
          )}
        />
        <Route
          path="/837_claims_view"
          element={(
            <RequirePermission required={CLAIMS_ACCESS_PERMISSIONS}>
              <Claims837Page />
            </RequirePermission>
          )}
        />
        <Route
          path="/notifications"
          element={(
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/settings"
          element={(
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/admin/users"
          element={(
            <RequirePermission required={ADMIN_PERMISSIONS}>
              <AdminUsersPage />
            </RequirePermission>
          )}
        />
        <Route
          path="/user_profile"
          element={(
            <RequireAuth>
              <UserProfilePage />
            </RequireAuth>
          )}
        />
        <Route
          path="/documentation"
          element={(
            <RequireAuth>
              <DocumentationPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/help_center"
          element={(
            <RequireAuth>
              <HelpCenterPage />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
