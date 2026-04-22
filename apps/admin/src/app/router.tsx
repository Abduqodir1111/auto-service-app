import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../features/auth/auth-provider';
import { ApplicationsPage } from '../pages/applications-page';
import { CategoriesPage } from '../pages/categories-page';
import { DashboardPage } from '../pages/dashboard-page';
import { LoginPage } from '../pages/login-page';
import { PhotosPage } from '../pages/photos-page';
import { ReviewsPage } from '../pages/reviews-page';
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
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
      </Route>
    </Routes>
  );
}
