import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'rexfill_recent_templates';
const MAX_RECENT = 10;
const EXPIRY_DAYS = 30;

interface RecentTemplateEntry {
  id: string;
  name: string;
  accessedAt: number;
}

interface UseRecentTemplatesReturn {
  recentTemplates: RecentTemplateEntry[];
  addRecentTemplate: (id: string, name: string) => void;
  removeRecentTemplate: (id: string) => void;
  clearRecentTemplates: () => void;
}

/**
 * Hook to manage recently accessed templates
 * Stores last 10 processed template IDs in localStorage
 * Entries expire after 30 days
 */
export function useRecentTemplates(): UseRecentTemplatesReturn {
  const [recentTemplates, setRecentTemplates] = useState<RecentTemplateEntry[]>([]);

  // Load recent templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const entries: RecentTemplateEntry[] = JSON.parse(stored);

        // Filter out expired entries (older than 30 days)
        const now = Date.now();
        const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const validEntries = entries.filter(
          entry => now - entry.accessedAt < expiryMs
        );

        // Save cleaned list back if we removed any
        if (validEntries.length !== entries.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validEntries));
        }

        setRecentTemplates(validEntries);
      }
    } catch (error) {
      console.error('Failed to load recent templates:', error);
      setRecentTemplates([]);
    }
  }, []);

  // Add or update a template in recent list
  const addRecentTemplate = useCallback((id: string, name: string) => {
    setRecentTemplates(prev => {
      // Remove existing entry with same ID if present
      const filtered = prev.filter(entry => entry.id !== id);

      // Add new entry at the beginning
      const newEntry: RecentTemplateEntry = {
        id,
        name,
        accessedAt: Date.now()
      };

      // Keep only MAX_RECENT entries
      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT);

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save recent templates:', error);
      }

      return updated;
    });
  }, []);

  // Remove a template from recent list
  const removeRecentTemplate = useCallback((id: string) => {
    setRecentTemplates(prev => {
      const updated = prev.filter(entry => entry.id !== id);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save recent templates:', error);
      }

      return updated;
    });
  }, []);

  // Clear all recent templates
  const clearRecentTemplates = useCallback(() => {
    setRecentTemplates([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear recent templates:', error);
    }
  }, []);

  return {
    recentTemplates,
    addRecentTemplate,
    removeRecentTemplate,
    clearRecentTemplates
  };
}

export default useRecentTemplates;
