"use client";

import { useRouter } from "next/navigation";
import {
  Droplets,
  Layers,
  PenLine,
  Recycle,
  Shovel,
  Sparkles,
  SquareParking,
  Trees,
  type LucideIcon,
} from "lucide-react";
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
 * TT-004 — de vaste lijst werkzaamheden van Top Tuinen als startpunt.
 *
 * Bewust géén nieuwe waarden in `offertes.type`: de app werkt met twee
 * offertesoorten (aanleg en onderhoud) met daarbinnen scopes. Elke ingang
 * hieronder opent dus de juiste wizard met de juiste scopes voorgeselecteerd.
 * Zo staat de lijst die kantoor hanteert vóór in beeld, zonder de datastructuur
 * en alle bestaande filters, statistieken en PDF's te breken.
 */
interface StartOptie {
  id: string;
  naam: string;
  beschrijving: string;
  icon: LucideIcon;
  /** Kleuren van de icoontegel */
  stijl: string;
  /** Sneltoets binnen de dialog */
  toets: string;
  /** Waar deze ingang naartoe gaat */
  route: string;
  /** Volledige breedte in het raster */
  breed?: boolean;
  /** Corebusiness (Tuinaanleg/Onderhoud): zwaarder aangezet in het raster */
  prominent?: boolean;
}

const START_OPTIES: StartOptie[] = [
  {
    id: "tuinaanleg",
    naam: "Tuinaanleg",
    beschrijving: "Complete tuin: kies zelf de onderdelen",
    icon: Shovel,
    stijl: "bg-primary/10 text-primary",
    toets: "a",
    route: "/offertes/nieuw/aanleg",
    prominent: true,
  },
  {
    id: "onderhoud",
    naam: "Onderhoud",
    beschrijving: "Periodiek onderhoud en contracten",
    icon: Trees,
    stijl: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    toets: "o",
    route: "/offertes/nieuw/onderhoud",
    prominent: true,
  },
  {
    id: "tuinrenovatie",
    naam: "Tuinrenovatie",
    beschrijving: "Bestaande tuin opknappen — grondwerk, borders en gazon",
    icon: Recycle,
    stijl: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
    toets: "r",
    // Renovatie is aanleg met de typische opknap-scopes alvast aangevinkt.
    route: "/offertes/nieuw/aanleg?scope=grondwerk&scope=borders&scope=gras",
  },
  {
    id: "beregening",
    naam: "Beregening",
    beschrijving: "Sproei-installatie met zones en regelkast",
    icon: Droplets,
    stijl: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    toets: "b",
    route: "/offertes/nieuw/aanleg?scope=beregening",
  },
  {
    id: "bestrating",
    naam: "Bestrating",
    beschrijving: "Terras, pad of oprit met onderbouw",
    icon: Layers,
    stijl: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    toets: "s",
    route: "/offertes/nieuw/aanleg?scope=bestrating",
  },
  {
    id: "parkeerplaats",
    naam: "Aanleg parkeerplaats",
    beschrijving: "Fundering op verkeersbelasting, kolken en belijning",
    icon: SquareParking,
    stijl: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    toets: "p",
    route: "/offertes/nieuw/aanleg?scope=parkeerplaats",
  },
  {
    id: "reiniging",
    naam: "Reiniging",
    beschrijving: "Terras, bestrating en gevels reinigen",
    icon: Sparkles,
    stijl: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    toets: "g",
    route: "/offertes/nieuw/onderhoud?scope=reiniging",
  },
  {
    id: "overig",
    naam: "Overige diensten",
    beschrijving:
      "Regel-editor: artikelen aanklikken of vrije regels — voor alles wat niet in een pakket past",
    icon: PenLine,
    stijl: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    toets: "v",
    route: "/offertes/nieuw/vrij",
    breed: true,
  },
];

/**
 * Dialog for selecting the type of new offerte to create
 * Triggered by Cmd+N or Cmd+Shift+N
 */
export function NewOfferteDialog() {
  const router = useRouter();
  const { showNewOfferteDialog, setShowNewOfferteDialog } = useShortcuts();

  const kies = (route: string) => {
    setShowNewOfferteDialog(false);
    router.push(route);
  };

  useKeyboardShortcuts(
    showNewOfferteDialog
      ? START_OPTIES.map((optie) => ({
          key: optie.toets,
          description: `Nieuwe offerte: ${optie.naam}`,
          action: () => kies(optie.route),
        }))
      : []
  );

  return (
    <Dialog open={showNewOfferteDialog} onOpenChange={setShowNewOfferteDialog}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nieuwe offerte</DialogTitle>
          <DialogDescription>
            Kies de werkzaamheid. De juiste onderdelen staan daarna alvast klaar
            — je kunt ze in de wizard nog aanvullen of weghalen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {START_OPTIES.map((optie) => {
            const Icon = optie.icon;
            return (
              <Button
                key={optie.id}
                variant="outline"
                // h-auto! wint van de sm:h-10 uit de Button-basis (WS5
                // touch-targets); anders drukt de vaste hoogte de tegel plat.
                className={`group relative flex h-auto! flex-col items-center gap-2 ${
                  optie.breed ? "col-span-2" : ""
                } ${
                  // Corebusiness zwaarder aangezet dan de overige startpunten
                  optie.prominent
                    ? "border-primary/40 bg-primary/5 py-6 hover:bg-primary/10"
                    : "py-4"
                }`}
                onClick={() => kies(optie.route)}
              >
                <div
                  className={`flex items-center justify-center rounded-lg ${
                    optie.prominent ? "size-12" : "size-10"
                  } ${optie.stijl}`}
                >
                  <Icon className={optie.prominent ? "size-6" : "size-5"} />
                </div>
                <div className="text-center">
                  <div className={optie.prominent ? "text-base font-semibold" : "font-medium"}>
                    {optie.naam}
                  </div>
                  <div className="whitespace-normal text-xs text-muted-foreground">
                    {optie.beschrijving}
                  </div>
                </div>
                {/* Sneltoetsletter altijd zichtbaar (was alleen bij hover) */}
                <KeyboardHint
                  keys={[optie.toets.toUpperCase()]}
                  className="absolute top-2 right-2"
                />
              </Button>
            );
          })}
        </div>

        <div className="flex items-center justify-center border-t pt-3 text-xs text-muted-foreground">
          Druk op de letter in de hoek om direct te kiezen
        </div>
      </DialogContent>
    </Dialog>
  );
}
