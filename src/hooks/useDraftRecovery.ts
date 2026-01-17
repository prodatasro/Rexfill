import { useState, useEffect, useCallback, useRef } from "react";

const DRAFT_PREFIX = "rexfill_draft_";
const AUTO_SAVE_INTERVAL = 5000; // 5 seconds
const DRAFT_EXPIRY_DAYS = 7;

interface DraftData {
  formData: Record<string, string>;
  savedAt: number;
  templateId?: string;
  templateName?: string;
}

interface UseDraftRecoveryOptions {
  templateId?: string;
  templateName?: string;
  enabled?: boolean;
}

export const useDraftRecovery = (options: UseDraftRecoveryOptions = {}) => {
  const { templateId, templateName, enabled = true } = options;

  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);

  const autoSaveTimerRef = useRef<number | null>(null);
  const currentFormDataRef = useRef<Record<string, string>>({});
  const isDirtyRef = useRef(false);

  const getDraftKey = useCallback(() => {
    if (!templateId) return null;
    return `${DRAFT_PREFIX}${templateId}`;
  }, [templateId]);

  // Check for existing draft on mount
  useEffect(() => {
    if (!enabled || !templateId) return;

    const draftKey = getDraftKey();
    if (!draftKey) return;

    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const parsed: DraftData = JSON.parse(stored);

        // Check if draft has expired
        const expiryTime = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.savedAt > expiryTime) {
          localStorage.removeItem(draftKey);
          return;
        }

        setDraftData(parsed);
        setHasDraft(true);
        setShowRecoveryPrompt(true);
      }
    } catch (error) {
      console.error("Error reading draft from localStorage:", error);
      const key = getDraftKey();
      if (key) localStorage.removeItem(key);
    }
  }, [enabled, templateId, getDraftKey]);

  // Auto-save timer
  useEffect(() => {
    if (!enabled || !templateId) return;

    const saveDraft = () => {
      if (!isDirtyRef.current) return;

      const draftKey = getDraftKey();
      if (!draftKey) return;

      const data: DraftData = {
        formData: { ...currentFormDataRef.current },
        savedAt: Date.now(),
        templateId,
        templateName,
      };

      try {
        localStorage.setItem(draftKey, JSON.stringify(data));
      } catch (error) {
        console.error("Error saving draft to localStorage:", error);
      }
    };

    autoSaveTimerRef.current = window.setInterval(saveDraft, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [enabled, templateId, templateName, getDraftKey]);

  // Update current form data reference (called from parent)
  const updateFormData = useCallback(
    (formData: Record<string, string>, isDirty: boolean) => {
      currentFormDataRef.current = formData;
      isDirtyRef.current = isDirty;
    },
    []
  );

  // Restore draft data
  const restoreDraft = useCallback(() => {
    setShowRecoveryPrompt(false);
    return draftData?.formData || null;
  }, [draftData]);

  // Dismiss draft and delete it
  const dismissDraft = useCallback(() => {
    setShowRecoveryPrompt(false);
    setHasDraft(false);
    setDraftData(null);

    const draftKey = getDraftKey();
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
  }, [getDraftKey]);

  // Clear draft after successful save/process
  const clearDraft = useCallback(() => {
    isDirtyRef.current = false;
    setHasDraft(false);
    setDraftData(null);

    const draftKey = getDraftKey();
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
  }, [getDraftKey]);

  // Force save draft immediately (e.g., before navigation)
  const forceSaveDraft = useCallback(() => {
    if (!enabled || !templateId || !isDirtyRef.current) return;

    const draftKey = getDraftKey();
    if (!draftKey) return;

    const data: DraftData = {
      formData: { ...currentFormDataRef.current },
      savedAt: Date.now(),
      templateId,
      templateName,
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(data));
    } catch (error) {
      console.error("Error force saving draft:", error);
    }
  }, [enabled, templateId, templateName, getDraftKey]);

  // Clean up old drafts (call periodically or on app startup)
  const cleanupOldDrafts = useCallback(() => {
    const expiryTime = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed: DraftData = JSON.parse(stored);
            if (now - parsed.savedAt > expiryTime) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          localStorage.removeItem(key!);
        }
      }
    }
  }, []);

  // Cleanup old drafts on mount
  useEffect(() => {
    cleanupOldDrafts();
  }, [cleanupOldDrafts]);

  return {
    hasDraft,
    draftData,
    showRecoveryPrompt,
    updateFormData,
    restoreDraft,
    dismissDraft,
    clearDraft,
    forceSaveDraft,
  };
};
