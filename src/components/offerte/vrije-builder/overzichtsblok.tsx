"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import { formatCurrency } from "@/lib/format";
import {
  berekenOverzicht,
  berekenVrijeTotalen,
  type VrijeRegel,
} from "../../../../convex/vrijeOfferteBerekening";

interface OverzichtsblokProps {
  regels: VrijeRegel[];
  kortingOpTotaal: number;
  onKortingOpTotaalChange?: (bedrag: number) => void;
}

/**
 * Live overzichtsblok naast de editor (PRD §2.5b, bijlage B deel B):
 * posten, werkuren, inkoop, marge (€ en %), netto en bruto — meerekenend
 * tijdens het bouwen. Inclusief korting op het totaal.
 */
export function Overzichtsblok({
  regels,
  kortingOpTotaal,
  onKortingOpTotaalChange,
}: OverzichtsblokProps) {
  const { overzicht, totalen, fout } = useMemo(() => {
    try {
      return {
        overzicht: berekenOverzicht(regels, kortingOpTotaal),
        totalen: berekenVrijeTotalen(regels, kortingOpTotaal),
        fout: null as string | null,
      };
    } catch (e) {
      return {
        overzicht: null,
        totalen: null,
        fout:
          e instanceof Error && "data" in e
            ? String((e as { data: unknown }).data)
            : "Controleer de korting",
      };
    }
  }, [regels, kortingOpTotaal]);

  return (
    <Card className="lg:sticky lg:top-4" data-testid="overzichtsblok">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Overzicht</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {fout ? (
          <p className="text-destructive">{fout}</p>
        ) : overzicht && totalen ? (
          <>
            <Rij label="Posten" waarde={String(overzicht.posten)} />
            <Rij
              label="Werkuren"
              waarde={`${overzicht.werkuren.toLocaleString("nl-NL")} uur`}
            />
            <Rij label="Inkoop" waarde={formatCurrency(overzicht.inkoop)} />
            <Rij
              label="Marge"
              waarde={`${formatCurrency(overzicht.margeBedrag)} (${overzicht.margePercentage.toLocaleString("nl-NL")}%)`}
            />
            <div className="my-2 border-t" />
            <Rij label="Subtotaal" waarde={formatCurrency(totalen.subtotaal)} />
            {onKortingOpTotaalChange ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Korting op totaal €</span>
                <div className="w-28">
                  <NumberInput
                    value={kortingOpTotaal}
                    onChange={onKortingOpTotaalChange}
                    min={0}
                    step={0.01}
                    aria-label="Korting op totaal"
                  />
                </div>
              </div>
            ) : (
              kortingOpTotaal > 0 && (
                <Rij
                  label="Korting op totaal"
                  waarde={`− ${formatCurrency(kortingOpTotaal)}`}
                />
              )
            )}
            <Rij
              label="Netto (ex btw)"
              waarde={formatCurrency(overzicht.netto)}
              nadruk
            />
            <Rij label="Btw" waarde={formatCurrency(totalen.btw)} />
            <Rij
              label="Bruto (incl btw)"
              waarde={formatCurrency(overzicht.bruto)}
              nadruk
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Rij({
  label,
  waarde,
  nadruk,
}: {
  label: string;
  waarde: string;
  nadruk?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={nadruk ? "font-semibold tabular-nums" : "tabular-nums"}>
        {waarde}
      </span>
    </div>
  );
}
