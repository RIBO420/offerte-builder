"use client";

/**
 * De klantsectie van het werkblad.
 *
 * Progressieve onthulling: zolang er geen klant is, is dit de enige sectie met
 * werkstroom-gewicht en staat de keuzelijst open. Zodra de klant er staat,
 * zakt de sectie terug naar één regel met een stille "Wisselen" — de aandacht
 * hoort dan bij het werk, niet bij de tenaamstelling.
 *
 * De stille staat vertelt óók waarom dit later verplicht wordt: een concept
 * mag zonder klant bestaan, versturen niet (harde guard in Convex).
 */

import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Button } from "@/components/ui/button";
import { KlantSelector } from "@/components/offerte/klant-selector";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { WerkbankKlantVelden } from "./use-werkbank";

interface WerkbankKlantSectieProps {
  klant: WerkbankKlantVelden;
  klantCompleet: boolean;
  /** `?klantId=` uit de URL — de selector selecteert die alvast voor. */
  initialKlantId?: string;
  initialLeadId?: string;
  /** Melding van de backend toen definitief maken werd geweigerd. */
  fout?: string | null;
  onVelden: (velden: WerkbankKlantVelden) => void;
  onKoppel: (velden: WerkbankKlantVelden, klantId: Id<"klanten"> | null) => void;
  onLead: (leadId: string | null) => void;
}

export function WerkbankKlantSectie({
  klant,
  klantCompleet,
  initialKlantId,
  initialLeadId,
  fout,
  onVelden,
  onKoppel,
  onLead,
}: WerkbankKlantSectieProps) {
  const [open, setOpen] = useState(false);
  const veldenRef = useRef(klant);
  useEffect(() => {
    veldenRef.current = klant;
  }, [klant]);

  const heeftKlant = klant.naam.trim().length > 0;
  const toonSelector = open || !heeftKlant;

  const adresregel = [
    klant.adres,
    [klant.postcode, klant.plaats].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <SectiePaneel
      id="werkbank-klant"
      titel="Klant"
      icoon={<UserRound />}
      gewicht={heeftKlant ? "secundair" : "primair"}
      uitleg="Een concept mag zonder klant bestaan. Definitief maken of versturen kan pas met naam, adres, postcode en plaats."
      acties={
        heeftKlant && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Klaar" : "Wisselen"}
          </Button>
        )
      }
    >
      <div className="space-y-3 px-3 py-3">
        {heeftKlant && !open && (
          <div className="min-w-0">
            <p className="truncate text-sm leading-snug font-medium">
              {klant.naam}
            </p>
            {adresregel ? (
              <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
                {adresregel}
              </p>
            ) : (
              <p className="mt-0.5 text-xs leading-tight text-scope-houtwerk">
                Nog geen adres — vul dat aan vóór je de offerte verstuurt.
              </p>
            )}
          </div>
        )}

        {toonSelector && (
          <KlantSelector
            value={klant}
            onChange={(velden) => {
              veldenRef.current = velden;
              onVelden(velden);
            }}
            onKlantSelect={(klantId) => {
              onKoppel(veldenRef.current, klantId ?? null);
              if (klantId) setOpen(false);
            }}
            onLeadSelect={(leadId) => onLead(leadId as string)}
            initialKlantId={initialKlantId}
            initialLeadId={initialLeadId as Id<"configuratorAanvragen"> | undefined}
          />
        )}

        {!klantCompleet &&
          (fout ? (
            <p className="text-xs leading-4 text-destructive">{fout}</p>
          ) : (
            <p className="text-xs leading-4 text-muted-foreground">
              Verplicht vóór versturen. Zolang dit een concept is, mag het leeg
              blijven.
            </p>
          ))}
      </div>
    </SectiePaneel>
  );
}
