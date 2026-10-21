"use client";

/**
 * Begrote manuren van de offerte (HERO-nabouw fase 1b). Na acceptatie komen
 * ze op de klus in de opdrachtenbak; het tijdbord toont begroot / gepland.
 * Leeg = de uren uit de calculatie.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function BegroteUrenCard({
  id,
  status,
  begroteUren,
  calculatieUren,
}: {
  id: string;
  status: string;
  begroteUren?: number;
  calculatieUren: number;
}) {
  const opslaan = useMutation(api.offertes.updateBegroteUren);
  const [waarde, setWaarde] = useState(begroteUren !== undefined ? String(begroteUren) : "");
  const [bezig, setBezig] = useState(false);
  const magBewerken = status !== "geaccepteerd";
  const getoond = begroteUren ?? (calculatieUren > 0 ? calculatieUren : undefined);
  const gewijzigd = waarde !== (begroteUren !== undefined ? String(begroteUren) : "");

  const bewaar = async () => {
    setBezig(true);
    try {
      const getal = waarde.trim() === "" ? null : Number(waarde.replace(",", "."));
      if (getal !== null && Number.isNaN(getal)) throw new Error("Vul een getal in");
      await opslaan({ id: id as Id<"offertes">, begroteUren: getal });
      toast.success("Begrote uren opgeslagen");
    } catch (fout) {
      toast.error(
        fout instanceof Error && "data" in fout
          ? String((fout as { data: unknown }).data)
          : fout instanceof Error
            ? fout.message
            : "Opslaan mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          Begrote manuren
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {magBewerken ? (
          <div className="flex gap-2">
            <Input
              aria-label="Begrote manuren"
              inputMode="decimal"
              value={waarde}
              placeholder={calculatieUren > 0 ? `${calculatieUren} (calculatie)` : "bijv. 48"}
              onChange={(e) => setWaarde(e.target.value)}
            />
            <Button variant="outline" onClick={bewaar} disabled={bezig || !gewijzigd}>
              {bezig && <Loader2 className="size-4 animate-spin" />}
              Opslaan
            </Button>
          </div>
        ) : (
          <p className="text-sm font-medium tabular-nums">{getoond ?? "–"} u</p>
        )}
        <p className="text-xs text-muted-foreground">
          {begroteUren === undefined && calculatieUren > 0
            ? `Nu ${calculatieUren} u uit de calculatie. `
            : ""}
          Na acceptatie staan deze uren op de klus in de opdrachtenbak.
        </p>
      </CardContent>
    </Card>
  );
}
