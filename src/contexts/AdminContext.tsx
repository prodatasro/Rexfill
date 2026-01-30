import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import type { Doc } from '@junobuild/core';
import type { PlatformAdmin } from '../types';
import { adminRepository } from '../dal';

interface AdminContextType {
  isAdmin: boolean;
  isFirstAdmin: boolean; // True if current user is the original (first) admin
  isLoading: boolean;
  checkAdminStatus: () => Promise<void>;
  adminsList: Doc<PlatformAdmin>[]; // All platform admins
  refetchAdmins: () => Promise<void>; // Manual refetch function
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminsList, setAdminsList] = useState<Doc<PlatformAdmin>[]>([]);
  const previousIsAdminRef = useRef<boolean>(false);

  const checkAdminStatus = async () => {
    // Wait for auth to finish loading before checking admin status
    if (authLoading) {
      return;
    }
    
    if (!user) {
      setIsAdmin(false);
      setIsFirstAdmin(false);
      setAdminsList([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // List all platform admins - ensure we get fresh data
      const items = await adminRepository.list();

      // If no admins exist, first user becomes admin
      if (items.length === 0) {
        const adminData: PlatformAdmin = {
          principalId: user.key,
          addedAt: Date.now(),
          addedBy: user.key,
        };

        const adminDoc = await adminRepository.create(user.key, adminData, user.key);

        setIsAdmin(true);
        setIsFirstAdmin(true);
        setAdminsList([adminDoc]);
        previousIsAdminRef.current = true;
        return;
      }

      // Sort by addedAt to identify the first admin
      const sortedAdmins = [...items].sort((a, b) => {
        const aData = a.data as PlatformAdmin;
        const bData = b.data as PlatformAdmin;
        return aData.addedAt - bData.addedAt;
      });
      
      setAdminsList(sortedAdmins);
      
      // Check if current user is in the admins list
      const isCurrentUserAdmin = sortedAdmins.some(admin => admin.key === user.key);
      
      // Check if current user is the first admin (earliest by addedAt)
      const firstAdmin = sortedAdmins[0];
      const isCurrentUserFirstAdmin = firstAdmin.key === user.key;
      
      setIsAdmin(isCurrentUserAdmin);
      setIsFirstAdmin(isCurrentUserFirstAdmin);
      previousIsAdminRef.current = isCurrentUserAdmin;
    } catch (error) {
      console.error('[AdminContext] Failed to check admin status:', error);
      setIsAdmin(false);
      setIsFirstAdmin(false);
      setAdminsList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const refetchAdmins = async () => {
    await checkAdminStatus();
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user?.key, authLoading]); // Re-check when user changes OR when auth loading completes

  // Polling interval to detect admin status changes (revocations)
  useEffect(() => {
    if (!user || authLoading) return;

    const intervalId = setInterval(() => {
      checkAdminStatus();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(intervalId);
  }, [user?.key, authLoading]);

  return (
    <AdminContext.Provider value={{ 
      isAdmin, 
      isFirstAdmin, 
      isLoading, 
      checkAdminStatus, 
      adminsList,
      refetchAdmins 
    }}>
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
