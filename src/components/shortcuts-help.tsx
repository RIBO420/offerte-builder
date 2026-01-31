"use client";

import * as React from "react";
import { useState, useMemo } from "react";
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
import { useKeyboardShortcuts, getModifierKey } from "@/hooks/use-keyboard-shortcuts";

interface ShortcutDefinition {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutDefinition[];
}

const shortcutCategories: ShortcutCategory[] = [
  {
    name: "Algemeen",
    shortcuts: [
      { keys: ["."], description: "Open command palette" },
      { keys: ["/"], description: "Toon deze help" },
      { keys: ["Esc"], description: "Sluit dialoog / annuleer" },
    ],
  },
  {
    name: "Offerte Editor",
    shortcuts: [
      { keys: ["S"], description: "Offerte opslaan" },
      { keys: ["N"], description: "Nieuwe regel toevoegen" },
      { keys: ["Shift", "R"], description: "Regels herberekenen" },
      { keys: ["P"], description: "Preview openen" },
    ],
  },
  {
    name: "Offerte Wizard",
    shortcuts: [
      { keys: ["→"], description: "Volgende stap" },
      { keys: ["←"], description: "Vorige stap" },
      { keys: ["1-7"], description: "Toggle scope (stap 1)" },
    ],
  },
  {
    name: "Offertes Overzicht",
    shortcuts: [
      { keys: ["A"], description: "Nieuwe aanleg offerte" },
      { keys: ["O"], description: "Nieuwe onderhoud offerte" },
      { keys: ["K"], description: "Zoeken" },
    ],
  },
  {
    name: "Command Palette",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigeer door resultaten" },
      { keys: ["Enter"], description: "Selecteer item" },
      { keys: ["Esc"], description: "Sluiten" },
    ],
  },
  {
    name: "Lijsten & Tabellen",
    shortcuts: [
      { keys: ["↑"], description: "Vorige item" },
      { keys: ["↓"], description: "Volgende item" },
      { keys: ["Enter"], description: "Item openen" },
    ],
  },
];

interface ShortcutsHelpProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Modal dialog showing all available keyboard shortcuts
 * Opens with Cmd/Ctrl + / or ?
 */
export function ShortcutsHelp({ open: controlledOpen, onOpenChange }: ShortcutsHelpProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const modKey = getModifierKey();

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
            shortcut.keys.some((key) => key.toLowerCase().includes(searchLower))
        ),
      }))
      .filter((category) => category.shortcuts.length > 0);
  }, [search]);

  // Register keyboard shortcut to open help
  useKeyboardShortcuts([
    {
      key: "/",
      meta: true,
      description: "Open keyboard shortcuts help",
      action: () => setOpen(true),
    },
    {
      key: "?",
      shift: true,
      description: "Open keyboard shortcuts help",
      action: () => setOpen(true),
    },
  ]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5" />
            Sneltoetsen
          </DialogTitle>
          <DialogDescription>
            Navigeer sneller door de app met deze sneltoetsen. Alle sneltoetsen gebruiken{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{modKey}</kbd> als
            modifier.
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
                  <div className="space-y-2">
                    {category.shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                            {modKey}
                          </kbd>
                          {shortcut.keys.map((key, keyIndex) => (
                            <React.Fragment key={keyIndex}>
                              {keyIndex > 0 && (
                                <span className="text-xs text-muted-foreground mx-0.5">+</span>
                              )}
                              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                                {key}
                              </kbd>
                            </React.Fragment>
                          ))}
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
            Tip: Gebruik <kbd className="px-1.5 py-0.5 bg-muted rounded">{modKey}.</kbd> om snel
            te zoeken en navigeren.
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
  const modKey = getModifierKey();

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
