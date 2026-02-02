"use client";

import { ShortcutsHelp } from "@/components/shortcuts-help";
import { useShortcuts } from "@/components/providers/shortcuts-provider";

/**
 * Global shortcuts help dialog that connects to the shortcuts provider
 * This allows the shortcut system to control when the help dialog is shown
 */
export function GlobalShortcutsHelp() {
  const { showShortcutsHelp, setShowShortcutsHelp } = useShortcuts();

  return (
    <ShortcutsHelp
      open={showShortcutsHelp}
      onOpenChange={setShowShortcutsHelp}
    />
  );
}
