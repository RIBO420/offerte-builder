"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  useKeyboardShortcuts,
  useSequenceShortcuts,
  type Shortcut,
  type SequenceShortcut,
} from "@/hooks/use-keyboard-shortcuts";
import { useCommand } from "./command-provider";

interface ShortcutsContextValue {
  /** Whether the new offerte type selector dialog is open */
  showNewOfferteDialog: boolean;
  setShowNewOfferteDialog: (show: boolean) => void;
  /** Whether the shortcuts help dialog is open */
  showShortcutsHelp: boolean;
  setShowShortcutsHelp: (show: boolean) => void;
  /** Current pending sequence keys (for visual feedback) */
  pendingSequenceKeys: string[];
}

const ShortcutsContext = createContext<ShortcutsContextValue | undefined>(undefined);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { setOpen: setCommandOpen } = useCommand();
  const [showNewOfferteDialog, setShowNewOfferteDialog] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Navigation shortcuts using Cmd/Ctrl + number
  const navigationShortcuts = useMemo<Shortcut[]>(
    () => [
      // Cmd+1 -> Dashboard
      {
        key: "1",
        meta: true,
        description: "Ga naar Dashboard",
        action: () => router.push("/dashboard"),
      },
      // Cmd+2 -> Projecten
      {
        key: "2",
        meta: true,
        description: "Ga naar Projecten",
        action: () => router.push("/projecten"),
      },
      // Cmd+3 -> Offertes
      {
        key: "3",
        meta: true,
        description: "Ga naar Offertes",
        action: () => router.push("/offertes"),
      },
      // Cmd+4 -> Planning
      {
        key: "4",
        meta: true,
        description: "Ga naar Planning",
        action: () => router.push("/planning"),
      },
      // Cmd+5 -> Klanten
      {
        key: "5",
        meta: true,
        description: "Ga naar Klanten",
        action: () => router.push("/klanten"),
      },
    ],
    [router]
  );

  // Global action shortcuts
  const globalShortcuts = useMemo<Shortcut[]>(
    () => [
      // Cmd+N -> New offerte (show type selector)
      {
        key: "n",
        meta: true,
        description: "Nieuwe offerte",
        action: () => setShowNewOfferteDialog(true),
      },
      // Cmd+Shift+N -> New offerte (alternative)
      {
        key: "n",
        meta: true,
        shift: true,
        description: "Nieuwe offerte",
        action: () => setShowNewOfferteDialog(true),
      },
      // Cmd+/ -> Focus search (open command palette)
      {
        key: "/",
        meta: true,
        description: "Zoeken",
        action: () => setCommandOpen(true),
      },
      // Cmd+K -> Open command palette (alternative)
      {
        key: "k",
        meta: true,
        description: "Command palette",
        action: () => setCommandOpen(true),
      },
      // Cmd+, -> Settings
      {
        key: ",",
        meta: true,
        description: "Instellingen",
        action: () => router.push("/instellingen"),
      },
      // Cmd+? or Shift+? -> Show shortcuts help
      {
        key: "?",
        shift: true,
        description: "Sneltoetsen help",
        action: () => setShowShortcutsHelp(true),
      },
      // Escape -> Close modals (handled globally by dialogs, but we track state here)
      {
        key: "Escape",
        description: "Sluit dialoog",
        action: () => {
          // Close any open dialogs in order of priority
          if (showShortcutsHelp) {
            setShowShortcutsHelp(false);
          } else if (showNewOfferteDialog) {
            setShowNewOfferteDialog(false);
          }
        },
        allowInInput: true,
      },
    ],
    [router, setCommandOpen, showShortcutsHelp, showNewOfferteDialog]
  );

  // Sequence shortcuts (G then X for navigation)
  const sequenceShortcuts = useMemo<SequenceShortcut[]>(
    () => [
      // G then D -> Dashboard
      {
        sequence: ["g", "d"],
        description: "Ga naar Dashboard",
        action: () => router.push("/dashboard"),
      },
      // G then O -> Offertes
      {
        sequence: ["g", "o"],
        description: "Ga naar Offertes",
        action: () => router.push("/offertes"),
      },
      // G then P -> Projecten
      {
        sequence: ["g", "p"],
        description: "Ga naar Projecten",
        action: () => router.push("/projecten"),
      },
      // G then K -> Klanten
      {
        sequence: ["g", "k"],
        description: "Ga naar Klanten",
        action: () => router.push("/klanten"),
      },
      // G then L -> Planning (L for calendar)
      {
        sequence: ["g", "l"],
        description: "Ga naar Planning",
        action: () => router.push("/planning"),
      },
      // G then U -> Uren
      {
        sequence: ["g", "u"],
        description: "Ga naar Uren",
        action: () => router.push("/uren"),
      },
      // G then S -> Settings
      {
        sequence: ["g", "s"],
        description: "Ga naar Instellingen",
        action: () => router.push("/instellingen"),
      },
      // G then R -> Rapportages
      {
        sequence: ["g", "r"],
        description: "Ga naar Rapportages",
        action: () => router.push("/rapportages"),
      },
      // G then W -> Wagenpark
      {
        sequence: ["g", "w"],
        description: "Ga naar Wagenpark",
        action: () => router.push("/wagenpark"),
      },
      // G then M -> Medewerkers
      {
        sequence: ["g", "m"],
        description: "Ga naar Medewerkers",
        action: () => router.push("/medewerkers"),
      },
    ],
    [router]
  );

  // Register all shortcuts
  useKeyboardShortcuts([...navigationShortcuts, ...globalShortcuts]);
  const { pendingKeys: pendingSequenceKeys } = useSequenceShortcuts(sequenceShortcuts);

  const contextValue = useMemo<ShortcutsContextValue>(
    () => ({
      showNewOfferteDialog,
      setShowNewOfferteDialog,
      showShortcutsHelp,
      setShowShortcutsHelp,
      pendingSequenceKeys,
    }),
    [showNewOfferteDialog, showShortcutsHelp, pendingSequenceKeys]
  );

  return (
    <ShortcutsContext.Provider value={contextValue}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts() {
  const context = useContext(ShortcutsContext);
  if (context === undefined) {
    throw new Error("useShortcuts must be used within a ShortcutsProvider");
  }
  return context;
}
