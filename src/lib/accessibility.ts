/**
 * Accessibility Utilities
 *
 * Provides helper functions and constants for WCAG AA compliance.
 */

// Focus trap for modals and dialogs
export function createFocusTrap(container: HTMLElement): {
  activate: () => void;
  deactivate: () => void;
} {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  let previousActiveElement: Element | null = null;

  function getFocusableElements(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab: Move focus backward
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: Move focus forward
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  return {
    activate() {
      previousActiveElement = document.activeElement;
      container.addEventListener('keydown', handleKeyDown);

      // Focus the first focusable element
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    },
    deactivate() {
      container.removeEventListener('keydown', handleKeyDown);

      // Return focus to previously focused element
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    },
  };
}

// Announce message to screen readers
// Returns a cleanup function to cancel the announcement early if needed
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): () => void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Safe cleanup function that checks if element still exists
  const cleanup = () => {
    if (announcement.parentNode === document.body) {
      document.body.removeChild(announcement);
    }
  };

  // Remove after announcement is read
  const timeoutId = setTimeout(cleanup, 1000);

  // Return cleanup function for early cancellation
  return () => {
    clearTimeout(timeoutId);
    cleanup();
  };
}

// Generate unique IDs for ARIA relationships
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${++idCounter}`;
}

// Check if reduced motion is preferred
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Keyboard navigation helpers
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

// Handle keyboard activation (Enter/Space)
export function handleKeyboardActivation(
  event: React.KeyboardEvent,
  callback: () => void
): void {
  if (event.key === KEYBOARD_KEYS.ENTER || event.key === KEYBOARD_KEYS.SPACE) {
    event.preventDefault();
    callback();
  }
}

// Handle Escape key to close
export function handleEscapeKey(
  event: React.KeyboardEvent,
  callback: () => void
): void {
  if (event.key === KEYBOARD_KEYS.ESCAPE) {
    event.preventDefault();
    callback();
  }
}

// Roving tabindex helper for list navigation
export function getRovingTabIndex(
  currentIndex: number,
  activeIndex: number
): 0 | -1 {
  return currentIndex === activeIndex ? 0 : -1;
}

// ARIA live region messages (Dutch)
export const ARIA_MESSAGES = {
  loading: 'Laden...',
  loaded: 'Inhoud geladen',
  saved: 'Opgeslagen',
  deleted: 'Verwijderd',
  error: 'Er is een fout opgetreden',
  success: 'Actie succesvol uitgevoerd',
  formInvalid: 'Formulier bevat fouten',
  formValid: 'Formulier is correct ingevuld',
  dialogOpened: 'Dialoogvenster geopend',
  dialogClosed: 'Dialoogvenster gesloten',
  menuOpened: 'Menu geopend',
  menuClosed: 'Menu gesloten',
  itemSelected: (item: string) => `${item} geselecteerd`,
  itemsSelected: (count: number) => `${count} items geselecteerd`,
  pageChanged: (page: number) => `Pagina ${page}`,
  sortedBy: (column: string, dir: 'asc' | 'desc') =>
    `Gesorteerd op ${column}, ${dir === 'asc' ? 'oplopend' : 'aflopend'}`,
  filterApplied: 'Filter toegepast',
  filterCleared: 'Filter gewist',
  searchResults: (count: number) =>
    count === 0
      ? 'Geen resultaten gevonden'
      : count === 1
        ? '1 resultaat gevonden'
        : `${count} resultaten gevonden`,
} as const;

// Color contrast helpers (WCAG AA minimum ratios)
export const CONTRAST_RATIOS = {
  normalText: 4.5, // AA for normal text
  largeText: 3, // AA for large text (18pt+ or 14pt bold+)
  uiComponents: 3, // AA for UI components and graphics
} as const;
