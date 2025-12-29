import { createContext, useContext, useEffect, useState, ReactNode, FC } from 'react';
import { onAuthStateChange, signIn, signOut, User, SignInUserInterruptError } from '@junobuild/core';
import { showErrorToast } from '../utils/toast';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
      setUser(user);
      setLoading(false);
    });

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
      await signOut({ windowReload: false });
      setUser(null);
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
