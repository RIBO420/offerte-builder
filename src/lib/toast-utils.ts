import { toast } from "sonner";

/**
 * Toast Utilities
 *
 * Utility functions for consistent toast notifications throughout the app.
 * All messages are in Dutch for consistency with the application.
 */

interface SuccessToastOptions {
  description?: string;
  action?: { label: string; onClick: () => void };
  undo?: () => void;
}

interface ErrorToastOptions {
  description?: string;
  retry?: () => void;
}

interface UndoToastOptions {
  duration?: number;
  description?: string;
}

/**
 * Show a success toast notification
 *
 * @example
 * showSuccessToast("Offerte opgeslagen")
 * showSuccessToast("Klant toegevoegd", { description: "De klant is succesvol aangemaakt" })
 * showSuccessToast("Offerte opgeslagen", { undo: () => revertChanges() })
 */
export function showSuccessToast(
  message: string,
  options?: SuccessToastOptions
): void {
  const { description, action, undo } = options ?? {};

  toast.success(message, {
    description,
    action: undo
      ? {
          label: "Ongedaan maken",
          onClick: undo,
        }
      : action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : undefined,
    duration: undo ? 5000 : 4000,
  });
}

/**
 * Show an error toast notification
 *
 * @example
 * showErrorToast("Kon offerte niet opslaan")
 * showErrorToast("Netwerkfout", { retry: () => retryRequest() })
 */
export function showErrorToast(
  message: string,
  options?: ErrorToastOptions
): void {
  const { description, retry } = options ?? {};

  toast.error(message, {
    description,
    action: retry
      ? {
          label: "Opnieuw proberen",
          onClick: retry,
        }
      : undefined,
    duration: 6000,
  });
}

/**
 * Show a toast with undo action
 *
 * @example
 * showUndoToast("Offerte verwijderd", () => restoreOfferte(id))
 * showUndoToast("Item verwijderd", undoDelete, { duration: 8000 })
 */
export function showUndoToast(
  message: string,
  undoAction: () => void,
  options?: UndoToastOptions
): void {
  const { duration = 5000, description } = options ?? {};

  toast(message, {
    description,
    action: {
      label: "Ongedaan maken",
      onClick: undoAction,
    },
    duration,
  });
}

/**
 * Show a delete toast with 30-second undo window
 * Used for soft delete operations where user has time to undo
 *
 * @example
 * showDeleteToast("Offerte verwijderd", () => restoreOfferte(id))
 * showDeleteToast("Project verwijderd", () => restoreProject(id), "Het project wordt over 30 dagen permanent verwijderd")
 */
export function showDeleteToast(
  message: string,
  undoAction: () => void | Promise<void>,
  description?: string
): void {
  toast(message, {
    description: description ?? "Je kunt dit binnen 30 dagen herstellen",
    action: {
      label: "Ongedaan maken",
      onClick: async () => {
        try {
          await undoAction();
          toast.success("Herstel gelukt");
        } catch {
          toast.error("Herstel mislukt");
        }
      },
    },
    duration: 30000, // 30 seconds
  });
}

/**
 * Show a saving/loading toast and return its ID
 * Use with dismissSavingToast to update the state when done
 *
 * @example
 * const savingId = showSavingToast()
 * try {
 *   await saveData()
 *   dismissSavingToast(savingId, true)
 * } catch {
 *   dismissSavingToast(savingId, false)
 * }
 */
export function showSavingToast(message?: string): string {
  const id = toast.loading(message ?? "Opslaan...", {
    duration: Infinity,
  });
  return String(id);
}

/**
 * Dismiss a saving toast and show success or error
 *
 * @param id - The toast ID returned from showSavingToast
 * @param success - Whether the operation was successful
 * @param message - Optional custom message (defaults to "Opgeslagen" or "Opslaan mislukt")
 */
export function dismissSavingToast(
  id: string,
  success: boolean,
  message?: string
): void {
  if (success) {
    toast.success(message ?? "Opgeslagen", { id });
  } else {
    toast.error(message ?? "Opslaan mislukt", { id });
  }
}

/**
 * Show an info toast notification
 *
 * @example
 * showInfoToast("Tip: Je kunt meerdere items selecteren")
 */
export function showInfoToast(
  message: string,
  options?: { description?: string; duration?: number }
): void {
  toast.info(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
  });
}

/**
 * Show a warning toast notification
 *
 * @example
 * showWarningToast("Let op: wijzigingen zijn nog niet opgeslagen")
 */
export function showWarningToast(
  message: string,
  options?: { description?: string; duration?: number }
): void {
  toast.warning(message, {
    description: options?.description,
    duration: options?.duration ?? 5000,
  });
}

/**
 * Show a promise toast that tracks async operation states
 *
 * @example
 * showPromiseToast(
 *   saveOfferte(data),
 *   {
 *     loading: "Offerte opslaan...",
 *     success: "Offerte opgeslagen",
 *     error: "Kon offerte niet opslaan"
 *   }
 * )
 */
export function showPromiseToast<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
): void {
  toast.promise(promise, messages);
}
