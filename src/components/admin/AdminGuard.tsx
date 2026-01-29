import { Navigate, useNavigate } from 'react-router-dom';
import { useAdmin } from '../../contexts';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useEffect, useRef } from 'react';
import { showWarningToast } from '../../utils/toast';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * AdminGuard protects admin routes from non-admin users
 * Users in the platform_admins collection have admin access
 * Redirects to dashboard if user is not an admin
 * Detects admin revocation and notifies user
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { isAdmin, isLoading } = useAdmin();
  const navigate = useNavigate();
  const previousIsAdminRef = useRef<boolean | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Skip revocation check until we've established an initial baseline
    if (!isLoading && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      previousIsAdminRef.current = isAdmin;
      return;
    }

    // Detect when admin status changes from true to false (revocation)
    if (previousIsAdminRef.current === true && isAdmin === false && !isLoading) {
      showWarningToast('Your admin access has been revoked');
      navigate('/app', { replace: true });
    }
    
    // Update the ref after checking
    if (!isLoading) {
      previousIsAdminRef.current = isAdmin;
    }
  }, [isAdmin, isLoading, navigate]);

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
