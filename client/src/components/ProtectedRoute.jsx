import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role, sessionExpired } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const notice = sessionExpired ? 'Your session has expired. Please sign in again.' : undefined;
    return <Navigate to="/login" replace state={{ from: location, notice, noticeTone: 'warning' }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
