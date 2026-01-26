import { Navigate } from 'react-router-dom';
import { useAdmin } from '../../contexts';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useEffect } from 'react';
import { toast } from 'sonner';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * AdminGuard protects admin routes from non-admin users
 * Only the first user who logged in has admin access
 * Redirects to dashboard if user is not the admin
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { isAdmin, isLoading } = useAdmin();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast.error('Access Denied', {
        description: 'Only the platform administrator can access this area.',
      });
    }
  }, [isLoading, isAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
