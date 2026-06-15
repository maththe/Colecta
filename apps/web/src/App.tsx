import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/modules/auth/context/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/modules/auth/components/ProtectedRoute';
import { MainLayout } from '@/layouts/MainLayout';
import { LoginPage } from '@/modules/auth/pages/LoginPage';
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage';
import { BinsPage } from '@/modules/trash-bins/pages/BinsPage';
import { MapPage } from '@/modules/map/pages/MapPage';
import { LocationsPage } from '@/modules/locations/pages/LocationsPage';
import { TasksPage } from '@/modules/tasks/pages/TasksPage';
import { AnalyticsPage } from '@/modules/analytics/pages/AnalyticsPage';
import { SecurityPage } from '@/modules/security/pages/SecurityPage';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'ADMIN' ? '/dashboard' : '/map'} replace />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route element={<ProtectedRoute allow={['ADMIN']} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Route>
              <Route path="/bins" element={<BinsPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/security/:locationId" element={<SecurityPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="*" element={<HomeRedirect />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
