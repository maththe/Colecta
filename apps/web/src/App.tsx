import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BinsPage } from './pages/BinsPage';
import { MapPage } from './pages/MapPage';
import { LocationsPage } from './pages/LocationsPage';
import { TasksPage } from './pages/TasksPage';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/bins" element={<BinsPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
