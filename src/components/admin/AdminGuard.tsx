import { Navigate } from 'react-router-dom';
import { useAdmin } from '../../contexts';
import LoadingSpinner from '../ui/LoadingSpinner';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * AdminGuard protects admin routes from non-admin users
 * Redirects to dashboard if user is not an admin
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { isAdmin, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
