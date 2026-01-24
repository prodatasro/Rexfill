import { createContext, useContext, useEffect, useState, ReactNode, FC, useRef } from 'react';
import { initSatellite, onAuthStateChange, signIn, signOut, User, SignInUserInterruptError } from '@junobuild/core';
import { initOrbiter } from '@junobuild/analytics';
import { showErrorToast } from '../utils/toast';
import { logActivity } from '../utils/activityLogger';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const previousUserRef = useRef<User | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastLoggedLoginKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    // Initialize analytics as early as possible
    if (import.meta.env.DEV) {
      initOrbiter({
        satelliteId: 'auamu-4x777-77775-aaaaa-cai',
        orbiterId: 'atbka-rp777-77775-aaaaq-cai',
        container: 'http://localhost:5987'
      });
    }

    const initAuth = async () => {
      // Initialize satellite first, then listen for auth changes
      await initSatellite({
        workers: {
          auth: true,
        },
      });

      unsubscribe = onAuthStateChange(async (newUser) => {
        const wasLoggedOut = previousUserRef.current === null;
        const isNowLoggedIn = newUser !== null;
        
        setUser(newUser);
        setLoading(false);
        
        // Log login event only when transitioning from null to user (not on initial load)
        // and only if we haven't already logged this user's login
        if (wasLoggedOut && isNowLoggedIn && !isInitialLoadRef.current && lastLoggedLoginKeyRef.current !== newUser.key) {
          // Set the flag IMMEDIATELY before async operation to prevent race condition
          lastLoggedLoginKeyRef.current = newUser.key;
          
          try {
            await logActivity({
              action: 'login',
              resource_type: 'auth_event',
              resource_id: newUser.key,
              resource_name: 'User Login',
              created_by: newUser.key,
              modified_by: newUser.key,
              success: true,
            });
          } catch (error) {
            console.error('Failed to log login activity:', error);
            // Reset on error so we can retry
            lastLoggedLoginKeyRef.current = null;
          }
        }
        
        // After first auth state change, mark initial load as complete
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
        
        // Update the ref for next comparison
        previousUserRef.current = newUser;
      });
    };

    initAuth();

    return () => unsubscribe?.();
  }, []);

  const login = async () => {
    try {
      await signIn({
        internet_identity: {
          options: {
            domain: "id.ai"
          } 
      }
      });
    } catch (error) {
      if (error instanceof SignInUserInterruptError) {
          // User canceled sign-in, no need to show an error
          return;
        }

      console.error('Login failed:', error);
      // Don't show error for user cancellation
      if (error && typeof error === 'object' && 'name' in error && error.name !== 'UserInterruptedError') {
        showErrorToast('Login failed. Please try again.');
      }
    }
  };

  const logout = async () => {
    try {
      const currentUser = user;
      
      // Log logout before signing out
      if (currentUser) {
        await logActivity({
          action: 'logout',
          resource_type: 'auth_event',
          resource_id: currentUser.key,
          resource_name: 'User Logout',
          created_by: currentUser.key,
          modified_by: currentUser.key,
          success: true,
        });
        
        // Clear the last logged login key so next login will be logged
        lastLoggedLoginKeyRef.current = null;
      }
      
      await signOut({ windowReload: false });
      setUser(null);
      // Redirect to landing page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
