"use client";

/**
 * Normuur-suggesties uit de nacalculatie-loop (PRD §3.4 + §2.5a).
 *
 * Per bouwsteen met voldoende data (drempel instelbaar, default ≥5 volledig
 * uitgevoerde beurten) één suggestie-blok: "werkelijk gemiddeld X,X uur over
 * N beurten — huidige norm Y,Y" met één-klik-overnemen. De mens beslist;
 * overnemen is een gewone kantoor-update van het bouwsteen-record (de prijs
 * per beurt volgt de bestaande uurtarief/prijs-op-datum-regels).
 *
 * Gebruikt op het catalogusbeheer-scherm én in het Calculatie
 * Analyse-tabblad (rapportages) — zelfde patroon, zelfde query.
 */

import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, Lightbulb, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsKantoor } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-current-user";

/** Uren in NL-notatie met één decimaal (2.6 → "2,6"). */
export function formatUren(uren: number): string {
  return uren.toFixed(1).replace(".", ",");
}

export function NormuurSuggesties() {
  const { user } = useCurrentUser();
  const isKantoor = useIsKantoor();
  const magBeheren = Boolean(user?._id) && isKantoor;

  const data = useQuery(
    api.beurtNacalculatie.getNormuurSuggesties,
    magBeheren ? {} : "skip"
  );
  const neemOver = useMutation(api.beurtNacalculatie.neemNormuurOver);
  const [bezigMet, setBezigMet] = useState<string | null>(null);

  const handleOvernemen = useCallback(
    async (suggestie: {
      bouwsteenId: Id<"bouwstenen">;
      naam: string;
      voorgesteldeNormUren: number;
    }) => {
      setBezigMet(suggestie.bouwsteenId);
      try {
        await neemOver({
          bouwsteenId: suggestie.bouwsteenId,
          uren: suggestie.voorgesteldeNormUren,
        });
        toast.success(
          `Norm van "${suggestie.naam}" bijgewerkt naar ${formatUren(
            suggestie.voorgesteldeNormUren
          )} uur`
        );
      } catch (error) {
        toast.error("Fout bij overnemen van de norm");
        console.error(error);
      } finally {
        setBezigMet(null);
      }
    },
    [neemOver]
  );

  // Geen kantoor, nog aan het laden of niets te suggereren → geen blok
  if (!magBeheren || !data || data.suggesties.length === 0) return null;

  return (
    <Card data-testid="normuur-suggesties">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-5 text-amber-500" />
          Normuur-suggesties uit nacalculatie
        </CardTitle>
        <CardDescription>
          Gemiddelde werkelijke duur uit bevestigde urensegmenten (vanaf{" "}
          {data.drempel} uitgevoerde beurten per bouwsteen). Jij beslist —
          overnemen werkt de bouwsteen bij; de prijs per beurt volgt het
          geldende uurtarief.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.suggesties.map((suggestie) => (
          <div
            key={suggestie.bouwsteenId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <Badge variant="outline">{suggestie.code}</Badge>
              <div>
                <p className="font-medium">{suggestie.naam}</p>
                <p className="text-sm text-muted-foreground">
                  Werkelijk gemiddeld{" "}
                  <span className="font-medium text-foreground">
                    {formatUren(suggestie.gemiddeldeUren)} uur
                  </span>{" "}
                  over {suggestie.aantalBeurten} beurten — huidige norm{" "}
                  {suggestie.huidigeNormUren !== null
                    ? `${formatUren(suggestie.huidigeNormUren)} uur`
                    : "nog niet ingevuld"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={bezigMet !== null}
              onClick={() => handleOvernemen(suggestie)}
            >
              {bezigMet === suggestie.bouwsteenId ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              Neem {formatUren(suggestie.voorgesteldeNormUren)} u over
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
