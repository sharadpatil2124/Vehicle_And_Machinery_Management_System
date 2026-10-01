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
import SiteManagementPage from './pages/site-management/SiteManagementPage';
import ItemCatalogPage from './pages/inventory/ItemCatalogPage';
import StockMovementsPage from './pages/inventory/StockMovementsPage';
import PurchaseFormPage from './pages/inventory/PurchaseFormPage';
import PurchaseDetailPage from './pages/inventory/PurchaseDetailPage';
import StockPage from './pages/inventory/StockPage';
import AssetIssueFormPage from './pages/inventory/AssetIssueFormPage';
import AssetIssueDetailPage from './pages/inventory/AssetIssueDetailPage';
import StockAdjustmentFormPage from './pages/inventory/StockAdjustmentFormPage';
import StockAdjustmentDetailPage from './pages/inventory/StockAdjustmentDetailPage';
import StockTransferFormPage from './pages/inventory/StockTransferFormPage';
import StockTransferDetailPage from './pages/inventory/StockTransferDetailPage';
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
        <Route
          path="/sites"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SitesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/site-management" element={<SiteManagementPage />} />

        { }
        <Route path="/inventory/catalog" element={<ItemCatalogPage />} />

        { }
        <Route path="/inventory/stock" element={<StockPage />} />

        { }
        <Route path="/inventory/movements" element={<StockMovementsPage />} />
        <Route path="/inventory/purchases/new" element={<PurchaseFormPage />} />
        <Route path="/inventory/purchases/:id" element={<PurchaseDetailPage />} />
        <Route path="/inventory/purchases/:id/edit" element={<PurchaseFormPage />} />
        <Route path="/inventory/asset-issues/new" element={<AssetIssueFormPage />} />
        <Route path="/inventory/asset-issues/:id" element={<AssetIssueDetailPage />} />
        <Route path="/inventory/stock-adjustments/new" element={<StockAdjustmentFormPage />} />
        <Route path="/inventory/stock-adjustments/:id" element={<StockAdjustmentDetailPage />} />
        <Route
          path="/inventory/stock-transfers/new"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StockTransferFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stock-transfers/:id"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StockTransferDetailPage />
            </ProtectedRoute>
          }
        />

        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
