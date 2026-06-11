import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BinsPage } from './pages/BinsPage';
import { MapPage } from './pages/MapPage';
import { LocationsPage } from './pages/LocationsPage';
import { TasksPage } from './pages/TasksPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

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
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="*" element={<HomeRedirect />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
