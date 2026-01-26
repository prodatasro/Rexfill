import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { listDocs, setDoc } from '@junobuild/core';
import type { PlatformAdmin } from '../types';

interface AdminContextType {
  isAdmin: boolean;
  isLoading: boolean;
  checkAdminStatus: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // List all platform admins
      const { items } = await listDocs({
        collection: 'platform_admins',
      });

      // Auto-bootstrap: If no admins exist, make current user the first admin
      if (items.length === 0) {
        const adminData: PlatformAdmin = {
          principalId: user.key,
          addedAt: Date.now(),
          addedBy: user.key, // Self-added for first admin
        };

        await setDoc({
          collection: 'platform_admins',
          doc: {
            key: user.key,
            data: adminData,
          },
        });

        setIsAdmin(true);
        setIsLoading(false);
        return;
      }

      // Check if current user is in the admin list
      const isUserAdmin = items.some(item => item.key === user.key);
      setIsAdmin(isUserAdmin);
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  return (
    <AdminContext.Provider value={{ isAdmin, isLoading, checkAdminStatus }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
