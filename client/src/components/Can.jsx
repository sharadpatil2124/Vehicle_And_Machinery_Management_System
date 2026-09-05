import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../config/permissions';

export default function Can({ resource, action, roles, fallback = null, children }) {
  const { role } = useAuth();

  if (roles) return roles.includes(role) ? children : fallback;
  if (resource && action) return hasPermission(role, resource, action) ? children : fallback;

  return children;
}
