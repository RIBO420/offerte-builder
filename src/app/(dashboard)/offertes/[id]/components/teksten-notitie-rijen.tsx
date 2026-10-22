"use client";

/**
 * Twee compacte rijen onderaan het regelspaneel: inleiding/afsluiting en de
 * notitie. Vervangen de TekstenCard en NotitiesCard; de inhoud zit
 * achter een dialoog zodat de pagina niet meer om de tekst heen scrolt.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Lock, Pencil, StickyNote } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TekstVoorbeeld, TekstenDialog } from "@/components/teksten/document-teksten-card";
import { cn } from "@/lib/utils";

const RIJ =
  "flex w-full min-w-0 items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

interface TekstenRijProps {
  id: string;
  type: "aanleg" | "onderhoud";
  status: string;
  vrijeTeksten?: { aanhef?: string; voorwaarden?: string };
}

export function TekstenRij({ id, type, status, vrijeTeksten }: TekstenRijProps) {
  const offerteId = id as Id<"offertes">;
  const getoond = useQuery(api.offertes.getTeksten, { id: offerteId });
  const opslaan = useMutation(api.offertes.updateTeksten);
  const [venster, setVenster] = useState<"bekijken" | "bewerken" | null>(null);

  const magBewerken = status === "concept" || status === "voorcalculatie";
  const soort = type === "onderhoud" ? "offerte_onderhoud" : "offerte_aanleg";
  const leeg = getoond ? !getoond.teksten.inleiding && !getoond.teksten.afsluiting : true;
  const ontbrekend = getoond?.ontbrekend ?? [];

  const samenvatting =
    getoond === undefined
      ? "Laden…"
      : leeg
        ? magBewerken
          ? "Niet ingevuld · standaardtekst kiezen"
          : "Niet ingevuld"
        : getoond.vastgelegd
          ? "Vastgelegd bij versturen"
          : [getoond.teksten.inleiding && "Inleiding", getoond.teksten.afsluiting && "afsluiting"]
              .filter(Boolean)
              .join(" en ") + " ingevuld";

  return (
    <>
      <button
        type="button"
        className={cn(RIJ, "border-b @xl/sectie:border-r @xl/sectie:border-b-0")}
        disabled={getoond === undefined}
        // Leeg en bewerkbaar: meteen naar de editor, er valt niets te bekijken.
        onClick={() => setVenster(leeg && magBewerken ? "bewerken" : "bekijken")}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {getoond?.vastgelegd ? <Lock className="size-3.5" /> : <Pencil className="size-3.5" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Inleiding en afsluiting</span>
          <span className="block truncate text-[13px] text-muted-foreground">{samenvatting}</span>
          {ontbrekend.length > 0 && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-status-in-uitvoering-text">
              <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">Nog in te vullen: {ontbrekend.join(", ")}</span>
            </span>
          )}
        </span>
      </button>

      {getoond && venster === "bekijken" && (
        <Dialog open onOpenChange={(open) => !open && setVenster(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Inleiding en afsluiting</DialogTitle>
              <DialogDescription>
                {getoond.vastgelegd
                  ? "Vastgelegd bij het versturen; zo staat het op de PDF."
                  : "Zo komt het op de PDF van deze offerte."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {ontbrekend.length > 0 && (
                <p className="flex gap-2 rounded-md border border-status-in-uitvoering-border bg-status-in-uitvoering p-3 text-sm text-status-in-uitvoering-text">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Nog in te vullen voordat u kunt versturen: {ontbrekend.join(", ")}.
                    Bedrijfsgegevens vult u in onder{" "}
                    <Link href="/profiel" className="underline">
                      Profiel
                    </Link>
                    .
                  </span>
                </p>
              )}
              {leeg ? (
                <p className="text-sm text-muted-foreground">
                  Geen inleiding of afsluiting. Standaardteksten stelt u in onder{" "}
                  <Link href="/instellingen/tekstblokken" className="underline">
                    Instellingen → Tekstblokken
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <TekstVoorbeeld titel="Inleiding" tekst={getoond.teksten.inleiding} />
                  <TekstVoorbeeld titel="Afsluiting" tekst={getoond.teksten.afsluiting} />
                </>
              )}
            </div>
            {magBewerken && (
              <DialogFooter>
                <Button onClick={() => setVenster("bewerken")}>
                  <Pencil />
                  Bewerken
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {getoond && magBewerken && venster === "bewerken" && (
        <TekstenDialog
          open
          onOpenChange={(open) => !open && setVenster(null)}
          documentNaam="offerte"
          soort={soort}
          beginWaarde={{
            inleiding: vrijeTeksten?.aanhef,
            afsluiting: vrijeTeksten?.voorwaarden,
          }}
          waarden={getoond.waarden}
          onOpslaan={async (teksten) => {
            await opslaan({ id: offerteId, ...teksten });
          }}
        />
      )}
    </>
  );
}

/**
 * `offertes.notities` heet in het ontwerp "interne notitie", maar staat op de
 * PDF (Opmerkingen) en in het klantportaal — vandaar gewoon "Notitie".
 */
export function NotitieRij({ notities }: { notities?: string | null }) {
  const [open, setOpen] = useState(false);

  if (!notities) {
    return (
      <div className={cn(RIJ, "hover:bg-transparent")}>
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          <StickyNote className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Notitie</span>
          <span className="block text-[13px] text-muted-foreground">Geen notitie</span>
        </span>
      </div>
    );
  }

  return (
    <>
      <button type="button" className={RIJ} onClick={() => setOpen(true)}>
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          <StickyNote className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Notitie</span>
          <span className="block truncate text-[13px] text-muted-foreground">{notities}</span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notitie</DialogTitle>
            <DialogDescription>Let op: deze notitie staat ook op de PDF en in het klantportaal.</DialogDescription>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap">{notities}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
