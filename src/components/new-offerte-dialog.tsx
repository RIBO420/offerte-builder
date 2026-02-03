"use client";

import { useRouter } from "next/navigation";
import { Shovel, Trees } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyboardHint } from "@/components/ui/keyboard-hint";
import { useShortcuts } from "@/components/providers/shortcuts-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

/**
 * Dialog for selecting the type of new offerte to create
 * Triggered by Cmd+N or Cmd+Shift+N
 */
export function NewOfferteDialog() {
  const router = useRouter();
  const { showNewOfferteDialog, setShowNewOfferteDialog } = useShortcuts();

  const handleSelectAanleg = () => {
    setShowNewOfferteDialog(false);
    router.push("/offertes/nieuw/aanleg");
  };

  const handleSelectOnderhoud = () => {
    setShowNewOfferteDialog(false);
    router.push("/offertes/nieuw/onderhoud");
  };

  // Keyboard shortcuts within the dialog
  useKeyboardShortcuts(
    showNewOfferteDialog
      ? [
          {
            key: "a",
            description: "Nieuwe aanleg offerte",
            action: handleSelectAanleg,
          },
          {
            key: "o",
            description: "Nieuwe onderhoud offerte",
            action: handleSelectOnderhoud,
          },
          {
            key: "1",
            description: "Nieuwe aanleg offerte",
            action: handleSelectAanleg,
          },
          {
            key: "2",
            description: "Nieuwe onderhoud offerte",
            action: handleSelectOnderhoud,
          },
        ]
      : []
  );

  return (
    <Dialog open={showNewOfferteDialog} onOpenChange={setShowNewOfferteDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nieuwe Offerte</DialogTitle>
          <DialogDescription>
            Kies het type offerte dat je wilt maken.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-3 h-auto py-6 relative group"
            onClick={handleSelectAanleg}
          >
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
              <Shovel className="size-6 text-primary" />
            </div>
            <div className="text-center">
              <div className="font-medium">Aanleg</div>
              <div className="text-xs text-muted-foreground">
                Tuinaanleg project
              </div>
            </div>
            <KeyboardHint
              keys={["A"]}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </Button>

          <Button
            variant="outline"
            className="flex flex-col items-center gap-3 h-auto py-6 relative group"
            onClick={handleSelectOnderhoud}
          >
            <div className="flex size-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Trees className="size-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <div className="font-medium">Onderhoud</div>
              <div className="text-xs text-muted-foreground">
                Periodiek onderhoud
              </div>
            </div>
            <KeyboardHint
              keys={["O"]}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground border-t pt-4">
          <span className="flex items-center gap-1">
            Druk <KeyboardHint keys={["A"]} size="sm" /> of{" "}
            <KeyboardHint keys={["O"]} size="sm" /> om te selecteren
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
