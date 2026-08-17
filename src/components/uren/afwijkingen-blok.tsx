"use client";

/**
 * Blok 2 · "Wat wijkt af?" — het hart van de Controlekamer.
 *
 * Controle op afwijking (onderzoek §2, "manage by exception"): kantoor klikt
 * niet veertig schone dagen door om er drie vreemde te vinden. Eén kaart is
 * één medewerker-dag die een regel raakt, met de dagbalk als bewijs en één zin
 * per reden. Beoordelen gebeurt per dág — nooit per segment (onderzoek §6).
 *
 * De drie acties zijn de drie uitkomsten van een blik:
 * - **In orde** — kwijting in het logboek (`keurDagGoed`), de dag verdwijnt uit
 *   de wachtrij. Géén schemastatus: dat is besluit Ricardo (plan §1).
 * - **Corrigeren** — de daginspector opent; daar leven de segmentmutations.
 * - **Dag heropenen** — terug naar de medewerker (`urenSegmenten.heropenDag`),
 *   het logboek schrijft mee.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { AlertTriangle, Film, ListChecks } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { formatHours } from "@/lib/format";
import { keurDagGoedRef } from "./controle-api";
import { afwijkingsZin, type DagKaart } from "./controle-types";
import { Dagbalk } from "./dagbalk";
import { dagLabelLang } from "./week";

export function AfwijkingenBlok({
  afwijkend,
  onCorrigeren,
  onDagFilm,
}: {
  afwijkend: DagKaart[];
  /** Opent de daginspector op deze medewerker-dag. */
  onCorrigeren: (dag: { medewerkerId: string; datum: string; naam: string }) => void;
  /**
   * WS-C: doorklik "Bekijk deze dag als film". Zonder deze prop blijft de knop
   * weg — een link naar een weergave die nog niet bestaat is erger dan geen link.
   */
  onDagFilm?: (dag: { medewerkerId: string; datum: string }) => void;
}) {
  if (afwijkend.length === 0) {
    return (
      <SectiePaneel
        kopbalk
        titel="Wat wijkt af?"
        icoon={<ListChecks aria-hidden />}
        legeRegel={{
          tekst: "Geen dag wijkt af.",
          hint: "Lange dagen, ontbrekende pauzes en gaten in de dag komen hier automatisch te staan.",
        }}
        uitleg="Dagen die een afwijkingsregel raken: meer dan 9,5 uur werken, meer dan 5,5 uur zonder pauze, werken zonder klus, een gat van meer dan een uur, handmatige invoer waar een voorstel stond, of een eerder heropende dag."
      />
    );
  }

  return (
    <SectiePaneel
      kopbalk
      titel="Wat wijkt af?"
      icoon={<AlertTriangle aria-hidden />}
      telling={afwijkend.length}
      gewicht="primair"
      className="bg-surface-aandacht"
      uitleg="Dagen die een afwijkingsregel raken. Beoordeel per dag: in orde, corrigeren, of terug naar de medewerker. De rest van de week stroomt stil door."
    >
      <ul className="divide-y divide-border/70">
        {afwijkend.map((dag) => (
          <li key={`${dag.medewerkerId}-${dag.datum}`}>
            <Dagkaart
              dag={dag}
              onCorrigeren={onCorrigeren}
              onDagFilm={onDagFilm}
            />
          </li>
        ))}
      </ul>
    </SectiePaneel>
  );
}

function Dagkaart({
  dag,
  onCorrigeren,
  onDagFilm,
}: {
  dag: DagKaart;
  onCorrigeren: (dag: { medewerkerId: string; datum: string; naam: string }) => void;
  onDagFilm?: (dag: { medewerkerId: string; datum: string }) => void;
}) {
  const keurDagGoed = useMutation(keurDagGoedRef);
  const heropenDag = useMutation(api.urenSegmenten.heropenDag);
  const [bezig, setBezig] = useState<"akkoord" | "heropenen" | null>(null);

  const handleAkkoord = async () => {
    setBezig("akkoord");
    try {
      await keurDagGoed({ medewerkerId: dag.medewerkerId, datum: dag.datum });
      showSuccessToast(`Dag van ${dag.naam} is akkoord`);
    } catch (fout) {
      showErrorToast(
        fout instanceof Error ? fout.message : "Akkoord geven is mislukt"
      );
    } finally {
      setBezig(null);
    }
  };

  const handleHeropenen = async () => {
    setBezig("heropenen");
    try {
      await heropenDag({
        medewerkerId: dag.medewerkerId as Id<"medewerkers">,
        datum: dag.datum,
      });
      showSuccessToast(`Dag staat weer open voor ${dag.naam}`);
    } catch (fout) {
      showErrorToast(
        fout instanceof Error ? fout.message : "Heropenen is mislukt"
      );
    } finally {
      setBezig(null);
    }
  };

  return (
    <article className="px-3 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="text-[13px] font-semibold">{dag.naam}</h3>
        <time
          dateTime={dag.datum}
          className="text-xs text-muted-foreground"
        >
          {dagLabelLang(dag.datum)}
        </time>
        <p className="ml-auto font-display text-sm font-semibold tabular-nums">
          {formatHours(dag.totaalUren)} uur
        </p>
      </div>

      <div className="mt-2">
        <Dagbalk
          segmenten={dag.segmenten}
          formaat="hero"
          label={`${dag.naam}, ${dagLabelLang(dag.datum)}`}
          legenda
        />
      </div>

      {/* Eén zin per reden — geen badge-soep, geen codes. */}
      <ul className="mt-2.5 flex flex-col gap-1">
        {dag.redenen.map((reden, i) => (
          <li
            key={`${reden.type}-${i}`}
            className="flex items-start gap-1.5 text-[12.5px] leading-5 font-medium text-status-verzonden-text"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {afwijkingsZin(reden)}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8" onClick={handleAkkoord} disabled={bezig !== null}>
          In orde
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() =>
            onCorrigeren({
              medewerkerId: dag.medewerkerId,
              datum: dag.datum,
              naam: dag.naam,
            })
          }
        >
          Corrigeren
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 font-normal text-muted-foreground"
          onClick={handleHeropenen}
          disabled={bezig !== null || dag.status !== "ingediend"}
          title={
            dag.status === "ingediend"
              ? undefined
              : "Deze dag staat al open bij de medewerker"
          }
        >
          Dag heropenen
        </Button>
        {onDagFilm && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 gap-1.5 font-normal text-muted-foreground"
            onClick={() =>
              onDagFilm({ medewerkerId: dag.medewerkerId, datum: dag.datum })
            }
          >
            <Film className="size-3.5" aria-hidden />
            Bekijk deze dag als film
          </Button>
        )}
      </div>
    </article>
  );
}
