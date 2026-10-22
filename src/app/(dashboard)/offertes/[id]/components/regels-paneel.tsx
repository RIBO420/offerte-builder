"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bereikbaarheidLabels, scopeLabels } from "./utils";
import { TekstenRij, NotitieRij } from "./teksten-notitie-rijen";

interface Regel {
  id: string;
  omschrijving: string;
  type: string;
  scope: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
  optioneel?: boolean;
}

interface Groep {
  scope: string;
  regels: Regel[];
  uren: number;
  bedrag: number;
}

// Regels gegroepeerd per scope (volgorde van eerste voorkomen), met het
// subtotaal in de groepsrij: arbeidsuren en bedrag.
export function groepeerPerScope(regels: Regel[]): Groep[] {
  const groepen: Groep[] = [];
  const perScope = new Map<string, Groep>();
  for (const regel of regels) {
    let groep = perScope.get(regel.scope);
    if (!groep) {
      groep = { scope: regel.scope, regels: [], uren: 0, bedrag: 0 };
      perScope.set(regel.scope, groep);
      groepen.push(groep);
    }
    groep.regels.push(regel);
    groep.bedrag += regel.totaal;
    if (regel.type === "arbeid") groep.uren += regel.hoeveelheid;
  }
  return groepen;
}

const getal = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });
const uren = (n: number) => `${getal.format(Math.round(n * 10) / 10)} u`;

/** Soortkleur uit de grafiektokens: dezelfde kleur als in de prijsopbouw. */
const SOORT: Record<string, { label: string; kleur: string }> = {
  arbeid: { label: "Arbeid", kleur: "bg-chart-1" },
  materiaal: { label: "Materiaal", kleur: "bg-chart-2" },
  machine: { label: "Machine", kleur: "bg-chart-3" },
};

function Soort({ type }: { type: string }) {
  const soort = SOORT[type] ?? { label: type, kleur: "bg-muted-foreground/50" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden="true" className={cn("size-[7px] shrink-0 rounded-[2px]", soort.kleur)} />
      {soort.label}
    </span>
  );
}

interface RegelsPaneelProps {
  id: string;
  regels: Regel[];
  /** Bepaalt welke editor "Bewerken" opent — zie `/offertes/[id]/bewerken`. */
  bron?: "wizard" | "vrij";
  status: string;
  type: "aanleg" | "onderhoud";
  algemeenParams?: { bereikbaarheid?: string; achterstalligheid?: string };
  totalen: {
    materiaalkosten: number;
    arbeidskosten: number;
    totaalUren: number;
    subtotaal: number;
  };
  vrijeTeksten?: { aanhef?: string; voorwaarden?: string };
  notities?: string | null;
}

/**
 * Het hart van variant A: één paneel met alle regels, gegroepeerd per scope.
 * Onderaan de opbouw (materiaal · arbeid · subtotaal) en twee compacte rijen
 * voor inleiding/afsluiting en de interne notitie. Vervangt de losse kaarten
 * Werkzaamheden, Offerteregels, Teksten en Notities.
 *
 * Smal (container < 32rem): Soort en Prijs verdwijnen als kolom en staan als
 * gedempte regel onder de omschrijving — de tabel scrolt nooit zijwaarts.
 */
export function RegelsPaneel({
  id,
  regels,
  bron,
  status,
  type,
  algemeenParams,
  totalen,
  vrijeTeksten,
  notities,
}: RegelsPaneelProps) {
  // Bewerken kan zolang de offerte nog van kantoor is en niet van de klant —
  // dezelfde grens als `offertes.koppelKlant` en de bewerkroute zelf.
  const magBewerken = status === "concept" || status === "voorcalculatie";
  const bewerkPad = bron === "vrij" ? `/offertes/${id}/vrij` : `/offertes/${id}/bewerken`;
  const groepen = groepeerPerScope(regels);

  const condities = [
    algemeenParams?.bereikbaarheid &&
      `Bereikbaarheid ${(bereikbaarheidLabels[algemeenParams.bereikbaarheid] ?? algemeenParams.bereikbaarheid).toLowerCase()}`,
    algemeenParams?.achterstalligheid &&
      `achterstalligheid ${algemeenParams.achterstalligheid}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SectiePaneel
      titel="Offerteregels"
      kopbalk
      telling={regels.length}
      bijschrift={condities || undefined}
      acties={
        magBewerken && (
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={bewerkPad}>
              <Pencil />
              Bewerken
            </Link>
          </Button>
        )
      }
    >
      {regels.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Nog geen regels.</span>{" "}
            {magBewerken
              ? "Voeg werkzaamheden toe; de totalen rekenen mee."
              : "Deze offerte is zonder regels verstuurd."}
          </p>
          {magBewerken && (
            <Button asChild size="sm" variant="outline">
              <Link href={bewerkPad}>
                <Plus />
                Regels toevoegen
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-semibold">Omschrijving</th>
                <th scope="col" className="hidden px-4 py-2 font-semibold @lg/sectie:table-cell">Soort</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Hoeveelheid</th>
                <th scope="col" className="hidden px-4 py-2 text-right font-semibold @lg/sectie:table-cell">Prijs</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {groepen.map((groep) => {
                const label = scopeLabels[groep.scope] || groep.scope;
                const subtotaal = `${groep.uren > 0 ? `${uren(groep.uren)} · ` : ""}${formatCurrency(groep.bedrag)}`;
                return (
                  <Fragment key={groep.scope}>
                    <tr className="border-b bg-muted/55 text-xs font-semibold text-muted-foreground">
                      {/* Twee labelcellen: verborgen kolommen mogen de
                          colSpan niet laten doorschieten. */}
                      <th scope="rowgroup" colSpan={4} className="hidden px-4 py-2 text-left tracking-[0.06em] uppercase @lg/sectie:table-cell">
                        {label}
                      </th>
                      <th scope="rowgroup" colSpan={2} className="px-4 py-2 text-left tracking-[0.06em] uppercase @lg/sectie:hidden">
                        {label}
                      </th>
                      <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums">{subtotaal}</td>
                    </tr>
                    {groep.regels.map((regel) => (
                      <tr key={regel.id} className="border-b border-border/60 align-top transition-colors hover:bg-muted/30">
                        <td className="px-4 py-2.5 [overflow-wrap:anywhere]">
                          <span className="font-semibold">{regel.omschrijving}</span>
                          {regel.optioneel && (
                            <span className="ml-1.5 text-xs text-muted-foreground">optioneel</span>
                          )}
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 @lg/sectie:hidden">
                            <Soort type={regel.type} />
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatCurrency(regel.prijsPerEenheid)} / {regel.eenheid}
                            </span>
                          </span>
                        </td>
                        <td className="hidden px-4 py-2.5 @lg/sectie:table-cell">
                          <Soort type={regel.type} />
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                          {getal.format(regel.hoeveelheid)} {regel.eenheid}
                        </td>
                        <td className="hidden px-4 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums @lg/sectie:table-cell">
                          {formatCurrency(regel.prijsPerEenheid)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
                          {formatCurrency(regel.totaal)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <dl className="flex flex-wrap justify-end gap-x-7 gap-y-1 px-4 py-3 text-sm tabular-nums">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Materiaal</dt>
              <dd className="font-semibold">{formatCurrency(totalen.materiaalkosten)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Arbeid {uren(totalen.totaalUren)}</dt>
              <dd className="font-semibold">{formatCurrency(totalen.arbeidskosten)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Subtotaal</dt>
              <dd className="font-semibold">{formatCurrency(totalen.subtotaal)}</dd>
            </div>
          </dl>
        </>
      )}

      <div className="grid border-t @xl/sectie:grid-cols-2">
        <TekstenRij id={id} type={type} status={status} vrijeTeksten={vrijeTeksten} />
        <NotitieRij notities={notities} />
      </div>
    </SectiePaneel>
  );
}
