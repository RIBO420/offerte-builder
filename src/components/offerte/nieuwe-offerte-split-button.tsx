"use client";

import { Fragment, useState, type ComponentType } from "react";
import {
  ChevronDown,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Plus,
  Shovel,
  Trees,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
 * acht werkzaamheden (A/O/R/B/S/P/G/V). De chevron ernaast opent de andere
 * ingangen, zodat die niet langer verstopt zitten:
 *
 *   V — Vrije offerte · aanleg     → leeg document, type `aanleg`
 *   O — Vrije offerte · onderhoud  → hetzelfde, maar type `onderhoud`
 *   S — Scopes kiezen              → dezelfde tegel-dialog als de hoofdklik
 *   T — Templates                  → Sheet met de opgeslagen sjablonen
 *
 * **Waarom twee vrije rijen en geen submenu (eindschouw S5).** De vrije route
 * startte altijd `type: "aanleg"`; onderhoud kon alleen via `?type=onderhoud`
 * op `/offertes/nieuw/vrij`, en de werkbank zette er dan onverbiddelijk
 * "Aanleg — eenmalig werk of maatwerk" boven. Een submenu of een tussenscherm
 * zou de keuze wél geven maar iedereen een extra klik of hover kosten, terwijl
 * de hele entree juist op kliktelling is ontworpen. Twee gelijkwaardige rijen
 * kosten niemand een klik, houden V op zijn vertrouwde plek en maken van het
 * type wat het is: een eigenschap die je vooraf kiest, niet een verstopte
 * instelling. Verder dan twee gaat het niet — `offertes.type` kent exact twee
 * waarden (TT-004).
 *
 * De twee rijen delen bewust dezelfde amberkleurige tegel: die staat voor de
 * route ("vrij"), niet voor het type. Het type zit in de titel en in het icoon,
 * en die iconen zijn de bestaande huisafspraak — Shovel = aanleg, Trees =
 * onderhoud, net als in `offerte-card.tsx` en het typefilter.
 *
 * `klantId` reist door alle paden: vanaf een klantdossier begint elke ingang
 * dus bij de juiste klant. De letters werken alléén zolang het menu open staat
 * — precies zoals A/O/R/… alleen in de tegel-dialog werken. Er komt bewust geen
 * globale V/O/S/T bij: losse letters zonder modifier zijn in deze app
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
  /** Streep eronder: scheidt de vrije route van de andere ingangen. */
  scheiding?: boolean;
  actie: () => void;
}

/** De amberkleurige tegel van de vrije route; het icoon zegt welk type. */
const VRIJ_TEGEL =
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";

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
      id: "vrij-aanleg",
      titel: "Vrije offerte · aanleg",
      ondertitel: "Leeg document voor eenmalig werk of maatwerk",
      toets: "v",
      icon: Shovel,
      tegel: VRIJ_TEGEL,
      actie: () => {
        setMenuOpen(false);
        void startVrijeOfferte({ klantId, type: "aanleg" });
      },
    },
    {
      id: "vrij-onderhoud",
      titel: "Vrije offerte · onderhoud",
      ondertitel: "Leeg document voor terugkerend onderhoudswerk",
      toets: "o",
      icon: Trees,
      tegel: VRIJ_TEGEL,
      scheiding: true,
      actie: () => {
        setMenuOpen(false);
        void startVrijeOfferte({ klantId, type: "onderhoud" });
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
              <Fragment key={ingang.id}>
                <DropdownMenuItem
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
                {ingang.scheiding && <DropdownMenuSeparator />}
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
