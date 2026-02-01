import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { Toast, ToastData, ToastVariant, ToastPosition } from '../components/ui/Toast';

const MAX_VISIBLE_TOASTS = 3;

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export function ToastProvider({
  children,
  position = 'top',
  maxToasts = MAX_VISIBLE_TOASTS,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const toast = useCallback(
    (options: ToastOptions): string => {
      const id = generateId();
      const newToast: ToastData = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? 'default',
        duration: options.duration ?? 3000,
      };

      setToasts((currentToasts) => {
        // Remove oldest toasts if we exceed max
        const updatedToasts = [newToast, ...currentToasts];
        if (updatedToasts.length > maxToasts) {
          return updatedToasts.slice(0, maxToasts);
        }
        return updatedToasts;
      });

      return id;
    },
    [generateId, maxToasts]
  );

  const dismiss = useCallback((id: string) => {
    setToasts((currentToasts) => currentToasts.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss, dismissAll }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toastData, index) => (
          <Toast
            key={toastData.id}
            {...toastData}
            position={position}
            onDismiss={dismiss}
            index={index}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return {
    toast: context.toast,
    dismiss: context.dismiss,
    dismissAll: context.dismissAll,
  };
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});

export default ToastProvider;
