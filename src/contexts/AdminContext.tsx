import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { listDocs, setDoc } from '@junobuild/core';
import type { PlatformAdmin } from '../types';

interface AdminContextType {
  isAdmin: boolean;
  isLoading: boolean;
  checkAdminStatus: () => Promise<void>;
  adminPrincipalId: string | null; // ID of the single platform admin
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminPrincipalId, setAdminPrincipalId] = useState<string | null>(null);

  const checkAdminStatus = async () => {
    // Wait for auth to finish loading before checking admin status
    if (authLoading) {
      return;
    }
    
    if (!user) {
      setIsAdmin(false);
      setAdminPrincipalId(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // Reset state immediately to prevent stale data
      setIsAdmin(false);
      setAdminPrincipalId(null);

      // List all platform admins - ensure we get fresh data
      const { items } = await listDocs({
        collection: 'platform_admins',
        // Force fresh fetch - don't use any cached data
      });

      console.log('[AdminContext] Found admin records:', items.length);
      console.log('[AdminContext] Current user key:', user.key);
debugger;
      // SINGLE ADMIN POLICY: Only the first user who logs in becomes the admin
      if (items.length === 0) {
        // First user to log in becomes the platform admin
        const adminData: PlatformAdmin = {
          principalId: user.key,
          addedAt: Date.now(),
          addedBy: user.key,
        };

        await setDoc({
          collection: 'platform_admins',
          doc: {
            key: user.key,
            data: adminData,
          },
        });

        console.log('[AdminContext] Created FIRST admin:', user.key);
        setIsAdmin(true);
        setAdminPrincipalId(user.key);
        return;
      }

      // Admin already exists - check if current user is THE admin
      // Sort by addedAt to get the earliest admin (in case of multiple records)
      const sortedAdmins = [...items].sort((a, b) => {
        const aData = a.data as PlatformAdmin;
        const bData = b.data as PlatformAdmin;
        return aData.addedAt - bData.addedAt;
      });
      
      const theOnlyAdmin = sortedAdmins[0];
      const theOnlyAdminData = theOnlyAdmin.data as PlatformAdmin;
      const isCurrentUserTheAdmin = theOnlyAdmin.key === user.key;
      
      console.log('[AdminContext] THE ONLY admin is:', theOnlyAdmin.key, 'added at:', new Date(theOnlyAdminData.addedAt).toISOString());
      console.log('[AdminContext] Is current user THE admin?', isCurrentUserTheAdmin);
      
      // STRICT: Only set isAdmin to true if current user is THE admin
      setIsAdmin(isCurrentUserTheAdmin);
      setAdminPrincipalId(theOnlyAdmin.key);
      
      if (!isCurrentUserTheAdmin) {
        console.log('[AdminContext] Current user is NOT admin - blocking access');
      }
    } catch (error) {
      console.error('[AdminContext] Failed to check admin status:', error);
      setIsAdmin(false);
      setAdminPrincipalId(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user?.key, authLoading]); // Re-check when user changes OR when auth loading completes

  return (
    <AdminContext.Provider value={{ isAdmin, isLoading, checkAdminStatus, adminPrincipalId }}>
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
