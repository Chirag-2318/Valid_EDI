import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { canAny } from './permissions';

export function RequireAuth({ children }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function RequirePermission({ required, children }) {
  const { loading, isAuthenticated, permissions } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAny(permissions, required)) {
    return <Navigate to="/dashboard_sleek" replace />;
  }

  return children;
}
