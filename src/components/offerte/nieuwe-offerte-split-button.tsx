"use client";

import { useState, type ComponentType } from "react";
import {
  ChevronDown,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  PenLine,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeyboardHint } from "@/components/ui/keyboard-hint";
import { useShortcuts } from "@/components/providers/shortcuts-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useNieuweVrijeOfferte } from "@/hooks/use-nieuwe-vrije-offerte";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Split-button "Nieuwe offerte" — de enige entree naar een nieuwe offerte
 * (masterplan offerte-entree, fase A1).
 *
 * Hoofdklik doet wat kantoor negen van de tien keer wil: de tegel-dialog met de
 * acht werkzaamheden (A/O/R/B/S/P/G/V). De chevron ernaast opent de twee andere
 * ingangen, zodat die niet langer verstopt zitten:
 *
 *   V — Vrije offerte  → direct een leeg document in de regel-editor
 *   S — Scopes kiezen  → dezelfde tegel-dialog als de hoofdklik
 *   T — Templates      → Sheet met de opgeslagen sjablonen
 *
 * `klantId` reist door alle drie de paden: vanaf een klantdossier begint elke
 * ingang dus bij de juiste klant. De letters werken alléén zolang het menu open
 * staat — precies zoals A/O/R/… alleen in de tegel-dialog werken. Er komt
 * bewust geen globale V/S/T bij: losse letters zonder modifier zijn in deze app
 * gereserveerd voor de `g …`-navigatiereeksen.
 */
export interface NieuweOfferteSplitButtonProps {
  /** Klant die al vaststaat, bv. omdat de knop in zijn dossier staat. */
  klantId?: Id<"klanten">;
  size?: "sm" | "default";
  /** Klassen voor de wrapper (bv. `w-full sm:w-auto`). */
  className?: string;
}

interface MenuIngang {
  id: string;
  titel: string;
  ondertitel: string;
  toets: string;
  icon: ComponentType<{ className?: string }>;
  /** Kleur van de icoontegel — zelfde familie als de tegels in de dialog. */
  tegel: string;
  actie: () => void;
}

export function NieuweOfferteSplitButton({
  klantId,
  size = "default",
  className,
}: NieuweOfferteSplitButtonProps) {
  const { setShowNewOfferteDialog, setShowTemplatesSheet } = useShortcuts();
  const { startVrijeOfferte, bezig } = useNieuweVrijeOfferte();
  const [menuOpen, setMenuOpen] = useState(false);

  const openTegels = () => setShowNewOfferteDialog(true, { klantId });

  const ingangen: MenuIngang[] = [
    {
      id: "vrij",
      titel: "Vrije offerte",
      ondertitel: "Meteen een leeg document — regels typen of artikelen kiezen",
      toets: "v",
      icon: PenLine,
      tegel:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      actie: () => {
        setMenuOpen(false);
        void startVrijeOfferte({ klantId });
      },
    },
    {
      id: "scopes",
      titel: "Scopes kiezen",
      ondertitel: "De acht werkzaamheden, met hun lettertoetsen",
      toets: "s",
      icon: LayoutGrid,
      tegel: "bg-primary/10 text-primary",
      actie: () => {
        setMenuOpen(false);
        openTegels();
      },
    },
    {
      id: "templates",
      titel: "Templates",
      ondertitel: "Begin met een eerder opgeslagen samenstelling",
      toets: "t",
      icon: LayoutTemplate,
      tegel: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
      actie: () => {
        setMenuOpen(false);
        setShowTemplatesSheet(true, { klantId });
      },
    },
  ];

  useKeyboardShortcuts(
    menuOpen
      ? ingangen.map((ingang) => ({
          key: ingang.toets,
          description: `Nieuwe offerte: ${ingang.titel}`,
          action: ingang.actie,
        }))
      : []
  );

  return (
    <div className={cn("inline-flex w-full sm:w-auto", className)}>
      {/* Twee knoppen, één blok: de naad is een randlijn, niet een gat. */}
      <Button
        size={size}
        className="flex-1 rounded-r-none sm:flex-none"
        onClick={openTegels}
        disabled={bezig}
      >
        {bezig ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        Nieuwe offerte
      </Button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size={size}
            aria-label="Meer manieren om te starten"
            className="rounded-l-none border-l border-primary-foreground/25 px-2"
            disabled={bezig}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                menuOpen && "rotate-180"
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[20rem] p-1.5">
          <DropdownMenuLabel className="px-2 pt-1 pb-1.5 text-xs font-normal text-muted-foreground">
            Zo kun je beginnen
          </DropdownMenuLabel>
          {ingangen.map((ingang) => {
            const Icon = ingang.icon;
            return (
              <DropdownMenuItem
                key={ingang.id}
                onSelect={ingang.actie}
                className="items-start gap-3 rounded-md px-2 py-2"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                    ingang.tegel
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-tight font-medium">
                    {ingang.titel}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {ingang.ondertitel}
                  </span>
                </span>
                <KeyboardHint
                  keys={[ingang.toets.toUpperCase()]}
                  size="sm"
                  className="mt-0.5 shrink-0"
                />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
