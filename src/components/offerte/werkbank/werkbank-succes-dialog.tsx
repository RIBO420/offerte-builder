"use client";

/**
 * Wat nu? — de vervolgacties nadat de offerte de conceptfase heeft verlaten.
 *
 * Overgenomen uit de wizard (dat was het sterkste scherm van de flow), maar
 * in Loof & Leem: geen blauwe SaaS-kaarten meer, wel dezelfde vier wegen.
 */

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  PenLine,
  Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface WerkbankSuccesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerteId: string | null;
  offerteNummer: string | null;
}

export function WerkbankSuccesDialog({
  open,
  onOpenChange,
  offerteId,
  offerteNummer,
}: WerkbankSuccesDialogProps) {
  const router = useRouter();

  const ga = (pad: string) => {
    onOpenChange(false);
    router.push(pad);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary"
          >
            <Sprout className="size-5" />
          </span>
          <DialogTitle className="font-display text-xl font-semibold tracking-tight">
            {offerteNummer ?? "De offerte"} staat vast
          </DialogTitle>
          <DialogDescription>
            De offerte is uit concept en klaar voor de volgende stap.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <VervolgActie
            aanbevolen
            icoon={<Calculator className="size-4" />}
            titel="Voorcalculatie invullen"
            uitleg="Teamgrootte en geschatte projectduur bepalen"
            onClick={() => ga(`/offertes/${offerteId}/voorcalculatie`)}
          />
          <VervolgActie
            icoon={<PenLine className="size-4" />}
            titel="Terug naar het werkblad"
            uitleg="Werkzaamheden en hoeveelheden aanpassen"
            onClick={() => ga(`/offertes/${offerteId}/bewerken`)}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={() => ga(`/offertes/${offerteId}`)}>
            Bekijk offerte
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => ga("/offertes")}
          >
            Naar overzicht
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VervolgActie({
  icoon,
  titel,
  uitleg,
  aanbevolen,
  onClick,
}: {
  icoon: React.ReactNode;
  titel: string;
  uitleg: string;
  aanbevolen?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        aanbevolen
          ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
          : "hover:bg-muted/50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          aanbevolen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {icoon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{titel}</span>
          {aanbevolen && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] leading-4 font-medium text-primary">
              Aanbevolen
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {uitleg}
        </span>
      </span>
      <ArrowRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}
