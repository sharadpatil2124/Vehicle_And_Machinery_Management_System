import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import VehiclesListPage from './pages/VehiclesListPage';
import VehicleFormPage from './pages/VehicleFormPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import MachineryListPage from './pages/MachineryListPage';
import MachineryFormPage from './pages/MachineryFormPage';
import MachineryDetailPage from './pages/MachineryDetailPage';
import AllAssetsPage from './pages/AllAssetsPage';
import SitesPage from './pages/SitesPage';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="/vehicles" element={<VehiclesListPage />} />
        <Route path="/vehicles/new" element={<VehicleFormPage />} />
        <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
        <Route path="/vehicles/:id/edit" element={<VehicleFormPage />} />
        <Route path="/machinery" element={<MachineryListPage />} />
        <Route path="/machinery/new" element={<MachineryFormPage />} />
        <Route path="/machinery/:id" element={<MachineryDetailPage />} />
        <Route path="/machinery/:id/edit" element={<MachineryFormPage />} />
        <Route path="/assets" element={<AllAssetsPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
