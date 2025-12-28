import { toast } from 'sonner';

export const showSuccessToast = (message: string) => {
  toast.success(message, {
    style: {
      background: '#10b981',
      color: 'white',
      border: 'none',
    },
  });
};

export const showErrorToast = (message: string) => {
  toast.error(message, {
    style: {
      background: '#ef4444',
      color: 'white',
      border: 'none',
    },
  });
};

export const showWarningToast = (message: string) => {
  toast.warning(message, {
    style: {
      background: '#f59e0b',
      color: 'white',
      border: 'none',
    },
  });
};

export const showInfoToast = (message: string) => {
  toast.info(message, {
    style: {
      background: '#3b82f6',
      color: 'white',
      border: 'none',
    },
  });
};
