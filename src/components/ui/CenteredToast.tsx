import { FC, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";

export const CenteredToast: FC = () => {
  const [hasToasts, setHasToasts] = useState(false);

  useEffect(() => {
    // Monitor toast state
    const checkToasts = () => {
      const toastElements = document.querySelectorAll('[data-sonner-toast]');
      setHasToasts(toastElements.length > 0);
    };

    // Check periodically
    const interval = setInterval(checkToasts, 100);
    return () => clearInterval(interval);
  }, []);

  const handleBackdropClick = () => {
    toast.dismiss();
  };

  return (
    <>
      {hasToasts && (
        <div
          className="fixed inset-0 bg-black/20 z-9998"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-9999 pointer-events-none">
        <div className="pointer-events-auto">
          <Toaster
            position="top-center"
            closeButton
            duration={Infinity}
            offset={0}
            toastOptions={{
              unstyled: true,
              classNames: {
                toast: 'bg-slate-800 text-white rounded-lg shadow-xl border border-slate-700 p-4 pr-12 min-w-[320px] flex items-center gap-3 relative',
                title: 'text-white text-center flex-1 font-medium',
                description: 'text-slate-300 text-center flex-1 text-sm',
                closeButton: 'absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-md transition-all duration-200 border-0 cursor-pointer',
                error: 'bg-red-600 border-red-700',
                success: 'bg-green-600 border-green-700',
                warning: 'bg-amber-600 border-amber-700',
                info: 'bg-blue-600 border-blue-700',
              },
            }}
          />
        </div>
      </div>
    </>
  );
};
