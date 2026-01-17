import { useTranslation } from "react-i18next";
import { FileText, RotateCcw, Trash2 } from "lucide-react";

interface DraftRecoveryDialogProps {
  isOpen: boolean;
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryDialog({
  isOpen,
  savedAt,
  onRestore,
  onDiscard,
}: DraftRecoveryDialogProps) {
  const { t, i18n } = useTranslation();

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("draftRecovery.title")}
              </h3>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t("draftRecovery.message", { date: formatDate(savedAt) })}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onRestore}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              {t("draftRecovery.restore")}
            </button>

            <button
              onClick={onDiscard}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4" />
              {t("draftRecovery.discard")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
