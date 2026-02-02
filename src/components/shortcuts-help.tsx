"use client";

import * as React from "react";
import { useState, useMemo, useSyncExternalStore } from "react";
import { Search, X, Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KeyboardHint } from "@/components/ui/keyboard-hint";
import { getModifierKey, isMac } from "@/hooks/use-keyboard-shortcuts";

// SSR-safe mounting check using useSyncExternalStore
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;
function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

interface ShortcutDefinition {
  keys: string[];
  description: string;
  /** Whether to show the modifier key prefix */
  hasModifier?: boolean;
  /** Whether this is a sequence shortcut (G then D) */
  isSequence?: boolean;
}

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutDefinition[];
}

const shortcutCategories: ShortcutCategory[] = [
  {
    name: "Algemeen",
    shortcuts: [
      { keys: ["K"], description: "Open command palette", hasModifier: true },
      { keys: ["/"], description: "Open command palette", hasModifier: true },
      { keys: ["N"], description: "Nieuwe offerte", hasModifier: true },
      { keys: [","], description: "Instellingen", hasModifier: true },
      { keys: ["?"], description: "Toon deze help (Shift+?)", hasModifier: false },
      { keys: ["Esc"], description: "Sluit dialoog / annuleer", hasModifier: false },
    ],
  },
  {
    name: "Snelle Navigatie (met nummer)",
    shortcuts: [
      { keys: ["1"], description: "Ga naar Dashboard", hasModifier: true },
      { keys: ["2"], description: "Ga naar Projecten", hasModifier: true },
      { keys: ["3"], description: "Ga naar Offertes", hasModifier: true },
      { keys: ["4"], description: "Ga naar Planning", hasModifier: true },
      { keys: ["5"], description: "Ga naar Klanten", hasModifier: true },
    ],
  },
  {
    name: "Snelle Navigatie (G + letter)",
    shortcuts: [
      { keys: ["G", "D"], description: "Ga naar Dashboard", isSequence: true },
      { keys: ["G", "P"], description: "Ga naar Projecten", isSequence: true },
      { keys: ["G", "O"], description: "Ga naar Offertes", isSequence: true },
      { keys: ["G", "L"], description: "Ga naar Planning", isSequence: true },
      { keys: ["G", "K"], description: "Ga naar Klanten", isSequence: true },
      { keys: ["G", "U"], description: "Ga naar Uren", isSequence: true },
      { keys: ["G", "R"], description: "Ga naar Rapportages", isSequence: true },
      { keys: ["G", "W"], description: "Ga naar Wagenpark", isSequence: true },
      { keys: ["G", "M"], description: "Ga naar Medewerkers", isSequence: true },
      { keys: ["G", "S"], description: "Ga naar Instellingen", isSequence: true },
    ],
  },
  {
    name: "Offerte Editor",
    shortcuts: [
      { keys: ["S"], description: "Offerte opslaan", hasModifier: true },
      { keys: ["N"], description: "Nieuwe regel toevoegen", hasModifier: true },
      { keys: ["Shift", "R"], description: "Regels herberekenen", hasModifier: true },
      { keys: ["P"], description: "Preview openen", hasModifier: true },
    ],
  },
  {
    name: "Offerte Wizard",
    shortcuts: [
      { keys: ["\u2192"], description: "Volgende stap", hasModifier: true },
      { keys: ["\u2190"], description: "Vorige stap", hasModifier: true },
      { keys: ["1-7"], description: "Toggle scope (stap 1)", hasModifier: false },
    ],
  },
  {
    name: "Command Palette",
    shortcuts: [
      { keys: ["\u2191", "\u2193"], description: "Navigeer door resultaten", hasModifier: false },
      { keys: ["Enter"], description: "Selecteer item", hasModifier: false },
      { keys: ["Esc"], description: "Sluiten", hasModifier: false },
    ],
  },
];

interface ShortcutsHelpProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Modal dialog showing all available keyboard shortcuts
 * Opens with Cmd/Ctrl + / or Shift+?
 */
export function ShortcutsHelp({ open: controlledOpen, onOpenChange }: ShortcutsHelpProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const mounted = useMounted();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const modKey = mounted ? getModifierKey() : "Ctrl";
  const mac = mounted && isMac();

  // Filter categories and shortcuts based on search
  const filteredCategories = useMemo(() => {
    if (!search) return shortcutCategories;
    const searchLower = search.toLowerCase();
    return shortcutCategories
      .map((category) => ({
        ...category,
        shortcuts: category.shortcuts.filter(
          (shortcut) =>
            shortcut.description.toLowerCase().includes(searchLower) ||
            shortcut.keys.some((key) => key.toLowerCase().includes(searchLower)) ||
            category.name.toLowerCase().includes(searchLower)
        ),
      }))
      .filter((category) => category.shortcuts.length > 0);
  }, [search]);

  // Reset search when dialog closes - use Dialog's onOpenChange callback
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearch("");
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5" />
            Sneltoetsen
          </DialogTitle>
          <DialogDescription>
            Navigeer sneller door de app met deze sneltoetsen.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Zoek sneltoetsen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
              onClick={() => setSearch("")}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>

        {/* Shortcuts list */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Geen sneltoetsen gevonden voor &quot;{search}&quot;</p>
              </div>
            ) : (
              filteredCategories.map((category) => (
                <div key={category.name}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    {category.name}
                  </h3>
                  <div className="space-y-1">
                    {category.shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.isSequence ? (
                            // Sequence shortcuts (G then D)
                            <KeyboardHint
                              keys={shortcut.keys}
                              separator="then"
                              size="sm"
                            />
                          ) : (
                            // Regular shortcuts with optional modifier
                            <>
                              {shortcut.hasModifier && (
                                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border/50 shadow-sm">
                                  {modKey}
                                </kbd>
                              )}
                              {shortcut.keys.map((key, keyIndex) => (
                                <React.Fragment key={keyIndex}>
                                  {(keyIndex > 0 || shortcut.hasModifier) && !mac && (
                                    <span className="text-xs text-muted-foreground mx-0.5">+</span>
                                  )}
                                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border/50 shadow-sm">
                                    {key}
                                  </kbd>
                                </React.Fragment>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
          <p>
            Tip: Druk <KeyboardHint keys={["G"]} size="xs" /> en dan een letter om snel te navigeren.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Sluiten
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Button component to trigger the shortcuts help dialog
 */
export function ShortcutsHelpButton() {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();

  const modKey = mounted ? getModifierKey() : "Ctrl";

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground"
      >
        <Keyboard className="size-4 mr-1" />
        <span className="hidden sm:inline">Sneltoetsen</span>
        <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-[10px] hidden sm:inline">
          {modKey}?
        </kbd>
      </Button>
      <ShortcutsHelp open={open} onOpenChange={setOpen} />
    </>
  );
}
