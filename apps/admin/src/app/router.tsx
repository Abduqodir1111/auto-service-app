import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../features/auth/auth-provider';
import { ApplicationsPage } from '../pages/applications-page';
import { CategoriesPage } from '../pages/categories-page';
import { DashboardPage } from '../pages/dashboard-page';
import { LoginPage } from '../pages/login-page';
import { ModerationHistoryPage } from '../pages/moderation-history-page';
import { PhotosPage } from '../pages/photos-page';
import { PrivacyPage } from '../pages/privacy-page';
import { ReportsPage } from '../pages/reports-page';
import { ReviewsPage } from '../pages/reviews-page';
import { SupportPage } from '../pages/support-page';
import { UsersPage } from '../pages/users-page';
import { WorkshopsPage } from '../pages/workshops-page';

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}

export function AppRouter() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/privacy-policy" element={<PrivacyPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/workshops" element={<WorkshopsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/photos" element={<PhotosPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/moderation-history" element={<ModerationHistoryPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
      </Route>
    </Routes>
  );
}
