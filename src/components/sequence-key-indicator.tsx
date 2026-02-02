"use client";

import { useShortcuts } from "@/components/providers/shortcuts-provider";
import { KeyboardHint } from "@/components/ui/keyboard-hint";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Visual indicator showing the current sequence key being pressed
 * Appears briefly at the bottom of the screen when typing sequence shortcuts
 */
export function SequenceKeyIndicator() {
  const { pendingSequenceKeys } = useShortcuts();

  return (
    <AnimatePresence>
      {pendingSequenceKeys.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.15 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-popover border rounded-lg shadow-lg">
            <span className="text-sm text-muted-foreground">Druk op:</span>
            <KeyboardHint
              keys={pendingSequenceKeys}
              separator="none"
              size="default"
            />
            <span className="text-sm text-muted-foreground">+</span>
            <span className="text-sm font-medium">...</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
